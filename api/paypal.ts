/**
 * Comtus PayPal checkout — server-side order creation, capture, pass issuance.
 *
 * Runs on the Node.js runtime on purpose: PayPal's edge (Akamai) 403s most
 * Vercel Edge egress IPs, so OAuth fails there with "PayPal auth failed (403)".
 * Node-runtime handlers receive classic (req, res) objects, not Web Request.
 * The hosted-model proxy stays in api/anthropic.ts (Edge) for SSE streaming;
 * this file is deliberately self-contained with no cross-module imports.
 *
 * Routes:
 *   POST /api/paypal/create-order   — server-side PayPal order creation
 *   POST /api/paypal/capture-order  — capture + instant deterministic pass
 */

import type { IncomingMessage, ServerResponse } from "node:http";

/* ── Shared HTTP plumbing ───────────────────────────────── */

const ALLOWED_ORIGINS = new Set([
  "https://comtus-ai.vercel.app",
  "https://www.comtus-ai.xyz",
  "http://tauri.localhost",
  "tauri://localhost",
  "http://localhost:5173",
  "http://localhost:5199",
  "http://127.0.0.1:5199",
  "http://localhost:4173",
]);

type Json = Record<string, unknown>;

function corsHeaders(origin?: string | string[] | null): Array<[string, string]> {
  const o = Array.isArray(origin) ? origin[0] : origin;
  if (!o || !ALLOWED_ORIGINS.has(o)) return [];
  return [
    ["access-control-allow-origin", o],
    ["access-control-allow-headers", "content-type,x-api-key,anthropic-version"],
    ["access-control-allow-methods", "POST,OPTIONS"],
  ];
}

function sendJson(res: ServerResponse, status: number, body: Json, origin?: string | string[] | null): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  for (const [k, v] of corsHeaders(origin)) res.setHeader(k, v);
  res.end(status === 204 ? undefined : JSON.stringify(body));
}

/** Vercel's Node body parser pre-parses JSON into req.body; fall back to "" */
function readBody<T>(req: IncomingMessage): T | null {
  const raw = (req as unknown as { body?: unknown }).body;
  if (raw == null) return null;
  if (typeof raw === "object") return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

async function hmacHex(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return hex.slice(0, 24);
}

function requestIp(req: IncomingMessage): string {
  const h = req.headers;
  const realIp = h["x-real-ip"];
  const fwd = h["x-forwarded-for"];
  return (
    (typeof realIp === "string" ? realIp : Array.isArray(realIp) ? realIp[0] : undefined) ??
    (typeof fwd === "string" ? fwd.split(",")[0].trim() : undefined) ??
    "unknown"
  );
}

/** Best-effort per-IP hourly throttle backed by Upstash (no-op if unconfigured). */
async function withinIpThrottle(req: IncomingMessage, secret: string, limitPerHour: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !secret) return true;
  const bucket = Math.floor(Date.now() / 3600_000);
  const key = `ipthrottle:${await hmacHex(`${requestIp(req)}:${bucket}`, secret)}`;
  try {
    const res = await fetch(`${url}/incr/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    const { result } = (await res.json()) as { result?: number };
    if (typeof result !== "number") return true;
    if (result === 1) {
      await fetch(`${url}/expire/${key}/3600`, { headers: { Authorization: `Bearer ${token}` } });
    }
    return result <= limitPerHour;
  } catch {
    return true;
  }
}

/* ── Pass minting ───────────────────────────────────────── */

interface ServerPlan {
  id: "sprint" | "scholar" | "mastery";
  name: string;
  price: string;
  currency: "USD";
  /** Included Anthropic usage in nano-USD (sticker price / 2). */
  budgetNano: number;
  days: number;
}

const SERVER_PLANS: Record<string, ServerPlan> = {
  sprint: { id: "sprint", name: "Sprint Pass", price: "2.99", currency: "USD", budgetNano: 1_495_000_000, days: 60 },
  scholar: { id: "scholar", name: "Scholar Pass", price: "6.99", currency: "USD", budgetNano: 3_495_000_000, days: 120 },
  mastery: { id: "mastery", name: "Mastery Pass", price: "14.99", currency: "USD", budgetNano: 7_495_000_000, days: 180 },
};

interface PassPayload {
  v: 2;
  j: string;
  c: number;
  e: number;
  n?: string;
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signPayload(payloadB64: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

async function deterministicJti(orderId: string, secret: string): Promise<string> {
  return (await hmacHex(`jti:${orderId}`, secret)).slice(0, 12);
}

/** Mint the buyer's pass token for a verified PayPal order. Idempotent:
 *  the jti derives from the order and the expiry from the capture time, so
 *  re-submitting an old order returns the same pass instead of restarting
 *  its clock. */
async function redisCommand(command: unknown[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = (await res.json()) as { result?: unknown };
  return data.result;
}

async function readStoredPass(orderId: string): Promise<string | null> {
  try {
    const result = await redisCommand(["GET", `passpayload:${orderId}`]);
    return typeof result === "string" && result.startsWith("comtus-pass-") ? result : null;
  } catch {
    return null;
  }
}

async function storePass(orderId: string, pass: string, ttlSec: number): Promise<void> {
  try {
    await redisCommand(["SET", `passpayload:${orderId}`, pass, "EX", ttlSec]);
  } catch {
    /* the token is still returned; a later capture mints the same payload */
  }
}

async function issuePassForOrder(plan: ServerPlan, orderId: string, paidAtMs: number): Promise<string> {
  const secret = process.env.PASS_SIGNING_SECRET ?? "";
  if (!secret) throw new Error("PASS_SIGNING_SECRET is not configured");
  const stored = await readStoredPass(orderId);
  if (stored) return stored;
  const j = await deterministicJti(orderId, secret);
  const payload: PassPayload = {
    v: 2,
    j,
    c: plan.budgetNano,
    e: Math.floor(paidAtMs / 1000) + plan.days * 86400,
    n: plan.name,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = await signPayload(payloadB64, secret);
  const token = `comtus-pass-v1.${payloadB64}.${sig}`;
  await storePass(orderId, token, plan.days * 86400 + 30 * 86400);
  return token;
}

/* ── PayPal client ──────────────────────────────────────── */

const PAYPAL_BASE = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";
const PAYPAL_CLIENT_ID_FALLBACK =
  "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";

async function paypalOauthToken(id: string, secret: string): Promise<string> {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal auth returned no token");
  return data.access_token;
}

/** `requestId` makes a POST idempotent at PayPal: a retry with the same id
 *  replays the first response instead of acting twice. */
async function paypal(
  path: string,
  method: "GET" | "POST",
  token: string,
  opts: { body?: unknown; requestId?: string } = {},
): Promise<{ status: number; data: Json }> {
  const { body, requestId } = opts;
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(method === "POST" && requestId ? { "paypal-request-id": requestId } : {}),
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  let data: Json = {};
  try {
    data = (await res.json()) as Json;
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

/* ── create-order ───────────────────────────────────────── */

async function handleCreateOrder(req: IncomingMessage, res: ServerResponse, origin?: string | string[]): Promise<void> {
  const clientId = process.env.PAYPAL_CLIENT_ID || PAYPAL_CLIENT_ID_FALLBACK;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientSecret) {
    return sendJson(res, 503, { error: "Checkout is temporarily unavailable. Please try again later." }, origin);
  }

  if (!(await withinIpThrottle(req, process.env.PASS_SIGNING_SECRET ?? "", 30))) {
    return sendJson(res, 429, { error: "Too many checkout attempts. Try again later." }, origin);
  }

  const body = readBody<{ planId?: string }>(req);
  if (!body) return sendJson(res, 400, { error: "Invalid JSON body." }, origin);

  const plan = body.planId ? SERVER_PLANS[body.planId] : undefined;
  if (!plan) return sendJson(res, 400, { error: "Unknown plan." }, origin);

  try {
    const token = await paypalOauthToken(clientId, clientSecret);
    const r = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "paypal-request-id": `comtus-${plan.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: `Comtus ${plan.name} — hosted model usage`,
            amount: { currency_code: plan.currency, value: plan.price },
          },
        ],
        application_context: {
          brand_name: "Comtus",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
        },
      }),
    });
    const data = (await r.json()) as { id?: string; message?: string };
    if (!r.ok || !data.id) {
      console.error("PayPal create-order failed:", r.status, data.message);
      return sendJson(res, 502, { error: "Could not start checkout. Please try again." }, origin);
    }
    return sendJson(res, 200, { orderId: data.id }, origin);
  } catch (e) {
    console.error("create-order error:", e instanceof Error ? e.message : e);
    return sendJson(res, 502, { error: "Could not start checkout. Please try again." }, origin);
  }
}

/* ── capture-order ──────────────────────────────────────── */

interface OrderShape {
  status?: string;
  create_time?: string;
  update_time?: string;
  purchase_units?: Array<{
    amount?: { value?: string; currency_code?: string };
    payments?: { captures?: Array<{ status?: string; create_time?: string }> };
  }>;
}

/** When the buyer paid: the capture's timestamp, else the order's. Never
 *  later than now, so a skewed clock can't extend a pass. */
function paidAt(order: OrderShape): number {
  const stamp =
    order.purchase_units?.[0]?.payments?.captures?.[0]?.create_time ?? order.update_time ?? order.create_time;
  const ms = stamp ? Date.parse(stamp) : NaN;
  return Number.isFinite(ms) ? Math.min(ms, Date.now()) : Date.now();
}

async function handleCaptureOrder(req: IncomingMessage, res: ServerResponse, origin?: string | string[]): Promise<void> {
  const clientId = process.env.PAYPAL_CLIENT_ID || PAYPAL_CLIENT_ID_FALLBACK;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientSecret || !process.env.PASS_SIGNING_SECRET) {
    return sendJson(res, 503, { error: "Fulfillment is temporarily unavailable. Payment was not captured." }, origin);
  }

  if (!(await withinIpThrottle(req, process.env.PASS_SIGNING_SECRET, 60))) {
    return sendJson(res, 429, { error: "Too many requests. Try again later." }, origin);
  }

  const body = readBody<{ orderId?: string; planId?: string }>(req);
  if (!body) return sendJson(res, 400, { error: "Invalid JSON body." }, origin);

  const { orderId } = body;
  const plan = body.planId ? SERVER_PLANS[body.planId] : undefined;
  if (!orderId || !/^[A-Z0-9]{5,32}$/i.test(orderId) || !plan) {
    return sendJson(res, 400, { error: "Missing or invalid order reference." }, origin);
  }

  try {
    const token = await paypalOauthToken(clientId, clientSecret);

    const initial = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token);
    if (initial.status === 404) return sendJson(res, 404, { error: "Order not found." }, origin);
    if (initial.status !== 200 || !(initial.data as OrderShape)?.purchase_units?.length) {
      return sendJson(res, 502, { error: "Could not verify the order with PayPal." }, origin);
    }
    let order = initial.data as OrderShape;

    const unit = order.purchase_units?.[0];
    const amountOk = unit?.amount?.value === plan.price && unit?.amount?.currency_code === plan.currency;
    if (!amountOk) {
      console.error(`capture-order amount mismatch: order ${orderId} vs plan ${plan.id}`);
      return sendJson(res, 400, { error: "This order does not match the selected plan." }, origin);
    }
    if (!["APPROVED", "COMPLETED"].includes((order.status as string) ?? "")) {
      return sendJson(res, 409, { error: "The order is not approved for capture yet." }, origin);
    }

    if (order.status !== "COMPLETED") {
      const cap = await paypal(`/v2/checkout/orders/${orderId}/capture`, "POST", token, {
        requestId: `comtus-capture-${orderId}`,
      });
      const alreadyCaptured =
        cap.status === 422 && (cap.data.details as Array<{ issue?: string }> | undefined)?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED");
      if (cap.status !== 201 && !alreadyCaptured) {
        console.error("PayPal capture failed:", cap.status, JSON.stringify(cap.data).slice(0, 300));
        return sendJson(res, 502, { error: "Payment capture failed. If you were charged, contact support." }, origin);
      }
      const recheck = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token);
      if (recheck.status !== 200) {
        return sendJson(res, 502, { error: "Could not confirm the captured payment." }, origin);
      }
      order = recheck.data as OrderShape;
    }

    const captureStatus = order.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (order.status !== "COMPLETED" || (captureStatus && captureStatus !== "COMPLETED")) {
      return sendJson(res, 409, { error: "The payment has not completed yet." }, origin);
    }

    const passToken = await issuePassForOrder(plan, orderId, paidAt(order));

    return sendJson(
      res,
      200,
      { passToken, budgetNano: plan.budgetNano, expiresDays: plan.days, orderId },
      origin,
    );
  } catch (e) {
    console.error("capture-order error:", e instanceof Error ? e.message : e);
    return sendJson(res, 502, { error: "Fulfillment failed. If you were charged, contact support." }, origin);
  }
}

function orderIdIn(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z0-9]{5,32}$/i.test(value) ? value : null;
}

function relatedOrderId(resource: Json | undefined): string | null {
  const related = (resource?.supplementary_data as Json | undefined)?.related_ids as Json | undefined;
  return orderIdIn(related?.order_id);
}

async function denyPass(orderId: string): Promise<void> {
  const secret = process.env.PASS_SIGNING_SECRET ?? "";
  if (!secret) return;
  const j = await deterministicJti(orderId, secret);
  await redisCommand(["SET", `passdeny:${j}`, "1", "EX", 400 * 86400]);
}

async function handleWebhook(req: IncomingMessage, res: ServerResponse, origin?: string | string[]): Promise<void> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const clientId = process.env.PAYPAL_CLIENT_ID || PAYPAL_CLIENT_ID_FALLBACK;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!webhookId || !clientSecret) {
    return sendJson(res, 503, { error: "Webhook is not configured." }, origin);
  }
  const event = readBody<Json>(req);
  if (!event) return sendJson(res, 400, { error: "Invalid JSON body." }, origin);

  const headers = req.headers;
  const transmissionId = headers["paypal-transmission-id"];
  const transmissionTime = headers["paypal-transmission-time"];
  const transmissionSig = headers["paypal-transmission-sig"];
  const certUrl = headers["paypal-cert-url"];
  const authAlgo = headers["paypal-auth-algo"];
  if (![transmissionId, transmissionTime, transmissionSig, certUrl, authAlgo].every((v) => typeof v === "string")) {
    return sendJson(res, 401, { error: "Missing webhook signature." }, origin);
  }

  try {
    const token = await paypalOauthToken(clientId, clientSecret);
    const verified = await paypal("/v1/notifications/verify-webhook-signature", "POST", token, {
      body: {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      },
    });
    const status = (verified.data as { verification_status?: string }).verification_status;
    if (verified.status !== 200 || status !== "SUCCESS") {
      return sendJson(res, 401, { error: "Webhook signature rejected." }, origin);
    }

    const type = typeof event.event_type === "string" ? event.event_type : "";
    const watched = new Set(["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED", "CUSTOMER.DISPUTE.CREATED"]);
    if (!watched.has(type)) return sendJson(res, 200, { ok: true }, origin);

    const resource = event.resource as Json | undefined;
    let orderId = relatedOrderId(resource);
    if (!orderId && type.startsWith("CUSTOMER.DISPUTE")) {
      const captureId = (resource?.disputed_transactions as Json[] | undefined)?.[0]?.seller_transaction_id;
      if (typeof captureId === "string" && captureId) {
        const capture = await paypal(`/v2/payments/captures/${captureId}`, "GET", token);
        orderId = relatedOrderId(capture.data);
      }
    }
    if (!orderId) {
      console.error("paypal webhook missing order id:", event.id);
      return sendJson(res, 200, { ok: true }, origin);
    }
    await denyPass(orderId);
    return sendJson(res, 200, { ok: true }, origin);
  } catch (e) {
    console.error("webhook error:", e instanceof Error ? e.message : e);
    return sendJson(res, 500, { error: "Webhook handling failed." }, origin);
  }
}

async function planForCompletedOrder(order: OrderShape): Promise<ServerPlan | null> {
  const unit = order.purchase_units?.[0];
  const price = unit?.amount?.value;
  const currency = unit?.amount?.currency_code;
  return (
    Object.values(SERVER_PLANS).find((plan) => plan.price === price && plan.currency === currency) ?? null
  );
}

async function handleRecover(req: IncomingMessage, res: ServerResponse, origin?: string | string[]): Promise<void> {
  const clientId = process.env.PAYPAL_CLIENT_ID || PAYPAL_CLIENT_ID_FALLBACK;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientSecret || !process.env.PASS_SIGNING_SECRET) {
    return sendJson(res, 503, { error: "Restore is temporarily unavailable." }, origin);
  }
  if (!(await withinIpThrottle(req, process.env.PASS_SIGNING_SECRET, 60))) {
    return sendJson(res, 429, { error: "Too many requests. Try again later." }, origin);
  }
  const body = readBody<{ orderId?: string }>(req);
  const orderId = body?.orderId ?? "";
  if (!/^[A-Z0-9]{5,32}$/i.test(orderId)) {
    return sendJson(res, 400, { error: "Enter the PayPal order id from your receipt." }, origin);
  }
  try {
    const token = await paypalOauthToken(clientId, clientSecret);
    const loaded = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token);
    if (loaded.status === 404) return sendJson(res, 404, { error: "Order not found." }, origin);
    if (loaded.status !== 200) return sendJson(res, 502, { error: "Could not verify the order with PayPal." }, origin);
    const order = loaded.data as OrderShape;
    const plan = await planForCompletedOrder(order);
    if (!plan || order.status !== "COMPLETED") {
      return sendJson(res, 409, { error: "That order is not a completed Comtus pass." }, origin);
    }
    const captureStatus = order.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (captureStatus && captureStatus !== "COMPLETED") {
      return sendJson(res, 409, { error: "That payment has not completed." }, origin);
    }
    const j = await deterministicJti(orderId, process.env.PASS_SIGNING_SECRET);
    const denied = await redisCommand(["GET", `passdeny:${j}`]);
    if (denied === "1") return sendJson(res, 401, { error: "This pass has been revoked." }, origin);
    const passToken = await issuePassForOrder(plan, orderId, paidAt(order));
    return sendJson(res, 200, { passToken, orderId, budgetNano: plan.budgetNano }, origin);
  } catch (e) {
    console.error("recover error:", e instanceof Error ? e.message : e);
    return sendJson(res, 502, { error: "Could not restore that pass." }, origin);
  }
}

/* ── Route dispatch ─────────────────────────────────────── */

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") return sendJson(res, 204, {}, origin);

  const rawUrl = req.url ?? "";
  const query = rawUrl.includes("?") ? new URLSearchParams(rawUrl.slice(rawUrl.indexOf("?") + 1)) : undefined;
  const pathname = query && query.has("p") ? "" : rawUrl.split("?")[0];
  const p = ((query?.get("p") ?? "") || pathname)
    .replace(/^\/+/, "")
    .replace(/^api\/paypal\/?/, "")
    .replace(/^\/api\/paypal\/?/, "");

  if (p.endsWith("create-order")) return handleCreateOrder(req, res, origin);
  if (p.endsWith("capture-order")) return handleCaptureOrder(req, res, origin);
  if (p.endsWith("recover")) return handleRecover(req, res, origin);
  if (p.endsWith("webhook")) return handleWebhook(req, res, origin);
  return sendJson(res, 404, { error: "Not found." }, origin);
}
