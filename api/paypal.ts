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
  res.setHeader("cache-control", "no-store");
  res.setHeader("vary", "Origin");
  for (const [k, v] of corsHeaders(origin)) res.setHeader(k, v);
  res.end(status === 204 ? undefined : JSON.stringify(body));
}

/** Vercel's Node body parser pre-parses JSON into req.body; fall back to "" */
function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBody(req: IncomingMessage): Json | null {
  const raw = (req as unknown as { body?: unknown }).body;
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    return isObject(parsed) ? parsed : null;
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

function cleanEnv(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function cleanRedisUrl(raw: string | undefined): string {
  return cleanEnv(raw).replace(/\/+$/, "");
}

/** Refuse checkout when the network throttle cannot be checked. Each route
 *  counts on its own key: api/anthropic.ts throttles AI calls under the bare
 *  `ipthrottle:` key, and sharing it let a busy study session block payment. */
async function withinIpThrottle(req: IncomingMessage, secret: string, scope: string, limitPerHour: number): Promise<boolean> {
  const url = cleanRedisUrl(process.env.UPSTASH_REDIS_REST_URL);
  const token = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token || !secret) throw new Error("throttle backend not configured");
  const bucket = Math.floor(Date.now() / 3600_000);
  const key = `ipthrottle:paypal-${scope}:${await hmacHex(`${requestIp(req)}:${bucket}`, secret)}`;
  try {
    const res = await fetch(`${url}/incr/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as { result?: number; error?: unknown };
    if (!res.ok || data.error || typeof data.result !== "number" || !Number.isSafeInteger(data.result) || data.result < 1) {
      throw new Error("throttle counter unreadable");
    }
    if (data.result === 1) {
      await fetch(`${url}/expire/${key}/3600`, { headers: { Authorization: `Bearer ${token}` } });
    }
    return data.result <= limitPerHour;
  } catch (err) {
    if (err instanceof Error && err.message === "throttle counter unreadable") throw err;
    throw new Error("throttle backend unavailable");
  }
}

async function throttleResponse(
  req: IncomingMessage,
  res: ServerResponse,
  origin: string | string[] | undefined,
  scope: string,
  limit: number,
  limited: string,
  unavailable: string,
): Promise<boolean> {
  try {
    if (await withinIpThrottle(req, cleanEnv(process.env.PASS_SIGNING_SECRET), scope, limit)) return false;
    sendJson(res, 429, { error: limited }, origin);
  } catch {
    sendJson(res, 503, { error: unavailable }, origin);
  }
  return true;
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

function planById(id: unknown): ServerPlan | undefined {
  return Object.values(SERVER_PLANS).find((plan) => plan.id === id);
}

function storageConfigured(): boolean {
  return Boolean(cleanRedisUrl(process.env.UPSTASH_REDIS_REST_URL) && cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN));
}

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

async function redisCommand(command: unknown[]): Promise<unknown> {
  const url = cleanRedisUrl(process.env.UPSTASH_REDIS_REST_URL);
  const token = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) throw new Error("Pass storage is not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  const data: unknown = await res.json();
  if (!res.ok || !isObject(data) || data.error || !("result" in data)) {
    throw new Error("Pass storage command failed");
  }
  return data.result;
}

async function readStoredPass(orderId: string): Promise<string | null> {
  const result = await redisCommand(["GET", `passpayload:${orderId}`]);
  if (result === null) return null;
  if (typeof result !== "string" || !result.startsWith("comtus-pass-v1.")) throw new Error("Invalid stored pass");
  return result;
}

async function passDenied(orderId: string): Promise<boolean> {
  const j = await deterministicJti(orderId, cleanEnv(process.env.PASS_SIGNING_SECRET));
  const result = await redisCommand(["GET", `passdeny:${j}`]);
  if (result !== null && result !== "1") throw new Error("Invalid pass revocation state");
  return result === "1";
}

/** The order and capture time fix both the usage identity and expiry across retries. */
async function issuePassForOrder(plan: ServerPlan, orderId: string, paidAtMs: number): Promise<string> {
  const secret = cleanEnv(process.env.PASS_SIGNING_SECRET);
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
  const saved = await redisCommand(["SET", `passpayload:${orderId}`, token, "EX", plan.days * 86400 + 30 * 86400, "NX"]);
  if (saved === "OK") return token;
  if (saved !== null) throw new Error("Pass persistence failed");
  const winner = await readStoredPass(orderId);
  if (!winner) throw new Error("Pass persistence failed");
  return winner;
}

/* ── PayPal client ──────────────────────────────────────── */

function paypalBase(): string {
  return cleanRedisUrl(process.env.PAYPAL_API_BASE) || "https://api-m.paypal.com";
}

async function paypalOauthToken(id: string, secret: string): Promise<string> {
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
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
  const res = await fetch(`${paypalBase()}${path}`, {
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
  const clientId = cleanEnv(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = cleanEnv(process.env.PAYPAL_CLIENT_SECRET);
  if (!clientId || !clientSecret || !cleanEnv(process.env.PASS_SIGNING_SECRET) || !storageConfigured()) {
    return sendJson(res, 503, { error: "Checkout is temporarily unavailable. Please try again later." }, origin);
  }

  if (await throttleResponse(req, res, origin, "checkout", 30, "Too many checkout attempts. Try again later.", "Checkout is temporarily unavailable. Please try again later.")) return;

  const body = readBody(req);
  if (!body) return sendJson(res, 400, { error: "Invalid JSON body." }, origin);

  const plan = planById(body.planId);
  if (!plan) return sendJson(res, 400, { error: "Unknown plan." }, origin);

  try {
    const token = await paypalOauthToken(clientId, clientSecret);
    const r = await fetch(`${paypalBase()}/v2/checkout/orders`, {
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
            custom_id: `comtus:${plan.id}`,
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
  purchase_units?: Array<{
    custom_id?: string;
    description?: string;
    amount?: { value?: string; currency_code?: string };
    payments?: { captures?: Array<{ status?: string; create_time?: string; amount?: { value?: string; currency_code?: string } }> };
  }>;
}

function orderMatchesPlan(order: OrderShape, plan: ServerPlan): boolean {
  if (!Array.isArray(order.purchase_units) || order.purchase_units.length !== 1) return false;
  const unit = order.purchase_units[0];
  return unit?.amount?.value === plan.price && unit?.amount?.currency_code === plan.currency &&
    (unit.custom_id === `comtus:${plan.id}` ||
      (unit.custom_id === undefined && unit.description === `Comtus ${plan.name} — hosted model usage`));
}

/** An order's COMPLETED status alone does not prove a full, settled capture. */
function verifiedPaidAt(order: OrderShape, plan: ServerPlan): number | null {
  if (order.status !== "COMPLETED" || !orderMatchesPlan(order, plan)) return null;
  const captures = order.purchase_units?.[0]?.payments?.captures;
  if (!Array.isArray(captures) || captures.length !== 1) return null;
  const capture = captures[0];
  if (capture?.status !== "COMPLETED" || capture.amount?.value !== plan.price || capture.amount.currency_code !== plan.currency) return null;
  const ms = typeof capture.create_time === "string" ? Date.parse(capture.create_time) : NaN;
  // Keep the original timestamp (including minor provider clock skew) stable on retries.
  return Number.isFinite(ms) && ms > 0 && ms <= Date.now() + 300_000 ? ms : null;
}

async function handleCaptureOrder(req: IncomingMessage, res: ServerResponse, origin?: string | string[]): Promise<void> {
  const clientId = cleanEnv(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = cleanEnv(process.env.PAYPAL_CLIENT_SECRET);
  if (!clientId || !clientSecret || !cleanEnv(process.env.PASS_SIGNING_SECRET) || !storageConfigured()) {
    return sendJson(res, 503, { error: "Fulfillment is temporarily unavailable. Payment was not captured." }, origin);
  }

  if (await throttleResponse(req, res, origin, "capture", 60, "Too many requests. Try again later.", "Fulfillment is temporarily unavailable. Payment was not captured.")) return;

  const body = readBody(req);
  if (!body) return sendJson(res, 400, { error: "Invalid JSON body." }, origin);

  const orderId = orderIdIn(body.orderId);
  const plan = planById(body.planId);
  if (!orderId || !plan) {
    return sendJson(res, 400, { error: "Missing or invalid order reference." }, origin);
  }

  try {
    if (await passDenied(orderId)) return sendJson(res, 401, { error: "This pass has been revoked." }, origin);
    const token = await paypalOauthToken(clientId, clientSecret);

    const initial = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token);
    if (initial.status === 404) return sendJson(res, 404, { error: "Order not found." }, origin);
    if (initial.status !== 200 || !(initial.data as OrderShape)?.purchase_units?.length) {
      return sendJson(res, 502, { error: "Could not verify the order with PayPal." }, origin);
    }
    let order = initial.data as OrderShape;

    if (!orderMatchesPlan(order, plan)) {
      console.error(`capture-order amount mismatch: order ${orderId} vs plan ${plan.id}`);
      return sendJson(res, 400, { error: "This order does not match the selected plan." }, origin);
    }
    if (order.status !== "APPROVED" && order.status !== "COMPLETED") {
      return sendJson(res, 409, { error: "The order is not approved for capture yet." }, origin);
    }

    if (order.status !== "COMPLETED") {
      const cap = await paypal(`/v2/checkout/orders/${orderId}/capture`, "POST", token, {
        requestId: `comtus-capture-${orderId}`,
      });
      const alreadyCaptured =
        cap.status === 422 && (cap.data.details as Array<{ issue?: string }> | undefined)?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED");
      if (cap.status !== 201 && cap.status !== 200 && !alreadyCaptured) {
        console.error("PayPal capture failed:", cap.status, JSON.stringify(cap.data).slice(0, 300));
        return sendJson(res, 502, { error: "Payment capture failed. If you were charged, contact support." }, origin);
      }
      const recheck = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token);
      if (recheck.status !== 200) {
        return sendJson(res, 502, { error: "Could not confirm the captured payment." }, origin);
      }
      order = recheck.data as OrderShape;
    }

    const paidAtMs = verifiedPaidAt(order, plan);
    if (paidAtMs === null) {
      return sendJson(res, 409, { error: "The payment has not completed yet." }, origin);
    }

    if (await passDenied(orderId)) return sendJson(res, 401, { error: "This pass has been revoked." }, origin);
    const passToken = await issuePassForOrder(plan, orderId, paidAtMs);

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
  const related = relatedIds(resource);
  return orderIdIn(related?.order_id);
}

function relatedIds(resource: Json | undefined): Json | null {
  const supplementary = resource?.supplementary_data;
  const related = isObject(supplementary) ? supplementary.related_ids : undefined;
  return isObject(related) ? related : null;
}

async function denyPass(orderId: string): Promise<void> {
  const secret = cleanEnv(process.env.PASS_SIGNING_SECRET);
  if (!secret) throw new Error("PASS_SIGNING_SECRET is not configured");
  const j = await deterministicJti(orderId, secret);
  const saved = await redisCommand(["SET", `passdeny:${j}`, "1", "EX", 400 * 86400]);
  if (saved !== "OK") throw new Error("Pass revocation failed");
}

async function handleWebhook(req: IncomingMessage, res: ServerResponse, origin?: string | string[]): Promise<void> {
  const webhookId = cleanEnv(process.env.PAYPAL_WEBHOOK_ID);
  const clientId = cleanEnv(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = cleanEnv(process.env.PAYPAL_CLIENT_SECRET);
  if (!webhookId || !clientId || !clientSecret || !cleanEnv(process.env.PASS_SIGNING_SECRET) || !storageConfigured()) {
    return sendJson(res, 503, { error: "Webhook is not configured." }, origin);
  }
  const event = readBody(req);
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

    const resource = isObject(event.resource) ? event.resource : undefined;
    const orderIds = new Set<string>();
    const directOrderId = relatedOrderId(resource);
    if (directOrderId) orderIds.add(directOrderId);
    const transactions = resource?.disputed_transactions;
    const captureIds = type === "CUSTOMER.DISPUTE.CREATED" && Array.isArray(transactions)
      ? transactions.map((transaction: unknown) => isObject(transaction) ? orderIdIn(transaction.seller_transaction_id) : null)
      : directOrderId
        ? []
        : [orderIdIn(relatedIds(resource)?.capture_id) ?? (type === "PAYMENT.CAPTURE.REVERSED" ? orderIdIn(resource?.id) : null)];
    if (!directOrderId && (!captureIds.length || captureIds.some((id) => !id))) throw new Error("Webhook has no capture reference");
    if (captureIds.some((id) => !id)) throw new Error("Webhook has an unreadable disputed transaction");
    for (const captureId of captureIds) {
      const capture = await paypal(`/v2/payments/captures/${captureId}`, "GET", token);
      const orderId = capture.status === 200 ? relatedOrderId(capture.data) : null;
      if (!orderId) throw new Error("Could not resolve webhook capture");
      orderIds.add(orderId);
    }
    for (const orderId of orderIds) await denyPass(orderId);
    return sendJson(res, 200, { ok: true }, origin);
  } catch (e) {
    console.error("webhook error:", e instanceof Error ? e.message : e);
    return sendJson(res, 500, { error: "Webhook handling failed." }, origin);
  }
}

async function handleRecover(req: IncomingMessage, res: ServerResponse, origin?: string | string[]): Promise<void> {
  const clientId = cleanEnv(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = cleanEnv(process.env.PAYPAL_CLIENT_SECRET);
  if (!clientId || !clientSecret || !cleanEnv(process.env.PASS_SIGNING_SECRET) || !storageConfigured()) {
    return sendJson(res, 503, { error: "Restore is temporarily unavailable." }, origin);
  }
  if (await throttleResponse(req, res, origin, "recover", 60, "Too many requests. Try again later.", "Restore is temporarily unavailable.")) return;
  const body = readBody(req);
  const orderId = orderIdIn(body?.orderId);
  if (!orderId) {
    return sendJson(res, 400, { error: "Enter the PayPal order id from your receipt." }, origin);
  }
  try {
    const token = await paypalOauthToken(clientId, clientSecret);
    const loaded = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token);
    if (loaded.status === 404) return sendJson(res, 404, { error: "Order not found." }, origin);
    if (loaded.status !== 200) return sendJson(res, 502, { error: "Could not verify the order with PayPal." }, origin);
    const order = loaded.data as OrderShape;
    const plan = Object.values(SERVER_PLANS).find((candidate) => orderMatchesPlan(order, candidate));
    const paidAtMs = plan ? verifiedPaidAt(order, plan) : null;
    if (!plan || paidAtMs === null) {
      return sendJson(res, 409, { error: "That order is not a completed Comtus pass." }, origin);
    }
    if (await passDenied(orderId)) return sendJson(res, 401, { error: "This pass has been revoked." }, origin);
    const passToken = await issuePassForOrder(plan, orderId, paidAtMs);
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
  if (req.method !== "POST") {
    res.setHeader("allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed." }, origin);
  }

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
