/**
 * Comtus API — single file, no cross-module imports for Vercel nodejs runtime.
 *
 * Routes:
 *   POST /api/anthropic?p=v1/messages             — hosted-model proxy
 *   POST /api/anthropic/paypal/create-order        — server-side PayPal order creation
 *   POST /api/anthropic/paypal/capture-order       — capture + instant pass issuance
 */

export const config = { runtime: "nodejs" };

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

function corsHeaders(origin?: string | null): HeadersInit {
  return origin && ALLOWED_ORIGINS.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type,x-api-key,anthropic-version",
        "access-control-allow-methods": "POST,OPTIONS",
      }
    : {};
}

function json(status: number, body: Record<string, unknown>, origin?: string | null): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
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

/** Best-effort per-IP hourly throttle backed by Upstash (no-op if unconfigured). */
async function withinIpThrottle(req: Request, secret: string, limitPerHour: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !secret) return true;
  const ip =
    req.headers.get("x-real-ip") ??
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ??
    "unknown";
  const bucket = Math.floor(Date.now() / 3600_000);
  const key = `ipthrottle:${await hmacHex(`${ip}:${bucket}`, secret)}`;
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

/* ── Hosted-model pass system ───────────────────────────── */

const ANTHROPIC_ORIGIN = "https://api.anthropic.com";
const PASS_PREFIX = "comtus-pass-v1.";

/** Only the two models sold with hosted passes may be invoked. */
const ALLOWED_MODELS = new Set(["claude-opus-5", "claude-sonnet-5"]);
const MAX_TOKENS_CEILING = 64000;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const IP_REQUESTS_PER_HOUR = 240;

interface PassPayload {
  j: string;
  q: number;
  e: number;
  n?: string;
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "===".slice((b64.length + 3) % 4));
}

async function hmac(payloadB64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.PASS_SIGNING_SECRET ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

async function verifyPass(token: string): Promise<PassPayload | null> {
  if (!token.startsWith(PASS_PREFIX)) return null;
  const rest = token.slice(PASS_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = rest.slice(0, dot);
  const sigHex = rest.slice(dot + 1);

  const expected = await hmac(payloadB64);
  if (sigHex.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= sigHex.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const payload = JSON.parse(b64urlDecode(payloadB64)) as PassPayload;
    if (!payload?.j || typeof payload.e !== "number" || payload.e * 1000 < Date.now()) return null;
    if (typeof payload.q !== "number" || payload.q <= 0) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Per-pass request count. Fails CLOSED: without a working counter the
    proxy refuses to spend Anthropic money it cannot bound. */
async function withinQuota(jti: string, quota: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("quota backend not configured");
  const res = await fetch(`${url}/incr/pass:${jti}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { result } = (await res.json()) as { result?: number };
  if (typeof result !== "number") throw new Error("quota counter unreadable");
  return result <= quota;
}

/* ── PayPal helpers ─────────────────────────────────────── */

interface ServerPlan {
  id: "sprint" | "scholar" | "mastery";
  name: string;
  price: string;
  currency: "USD";
  requests: number;
  days: number;
}

const SERVER_PLANS: Record<string, ServerPlan> = {
  sprint: { id: "sprint", name: "Sprint Pass", price: "2.99", currency: "USD", requests: 60, days: 60 },
  scholar: { id: "scholar", name: "Scholar Pass", price: "6.99", currency: "USD", requests: 200, days: 120 },
  mastery: { id: "mastery", name: "Mastery Pass", price: "14.99", currency: "USD", requests: 500, days: 180 },
};

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function deterministicJti(orderId: string, secret: string): Promise<string> {
  return (await hmacHex(`jti:${orderId}`, secret)).slice(0, 12);
}

/** Mint the buyer's pass token for a verified PayPal order (idempotent). */
async function issuePassForOrder(plan: ServerPlan, orderId: string): Promise<string> {
  const secret = process.env.PASS_SIGNING_SECRET ?? "";
  if (!secret) throw new Error("PASS_SIGNING_SECRET is not configured");
  const j = await deterministicJti(orderId, secret);
  const payload = {
    j,
    q: plan.requests,
    e: Math.floor(Date.now() / 1000) + plan.days * 86400,
    n: plan.name,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = await hmac(payloadB64);
  return `comtus-pass-v1.${payloadB64}.${sig}`;
}

const PAYPAL_BASE = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";

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

async function paypal(
  path: string,
  method: "GET" | "POST",
  token: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(method === "POST" ? { "paypal-request-id": `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

/* ── Route dispatch ─────────────────────────────────────── */

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);

  // PayPal routes live under the same file to avoid Vercel nodejs module
  // resolution issues with nested directories.
  if (url.pathname.startsWith("/api/anthropic/paypal/")) {
    return handlePayPal(req, origin);
  }

  // Default: hosted-model proxy
  return handleAnthropicProxy(req, origin);
}

/* ── PayPal: create-order ───────────────────────────────── */

async function handlePayPalCreateOrder(req: Request, origin: string | null): Promise<Response> {
  const clientId = process.env.PAYPAL_CLIENT_ID ||
    "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientSecret) {
    return json(503, { error: "Checkout is temporarily unavailable. Please try again later." }, origin);
  }

  let body: { planId?: string };
  try {
    body = (await req.json()) as { planId?: string };
  } catch {
    return json(400, { error: "Invalid JSON body." }, origin);
  }

  const plan = body.planId ? SERVER_PLANS[body.planId] : undefined;
  if (!plan) return json(400, { error: "Unknown plan." }, origin);

  try {
    const token = await paypalOauthToken(clientId, clientSecret);
    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
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
            description: `Comtus ${plan.name} — ${plan.requests} hosted requests`,
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
    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok || !data.id) {
      console.error("PayPal create-order failed:", res.status, data.message);
      return json(502, { error: "Could not start checkout. Please try again." }, origin);
    }
    return json(200, { orderId: data.id }, origin);
  } catch (e) {
    console.error("create-order error:", e instanceof Error ? e.message : e);
    return json(502, { error: "Could not start checkout. Please try again." }, origin);
  }
}

/* ── PayPal: capture-order ──────────────────────────────── */

async function handlePayPalCaptureOrder(req: Request, origin: string | null): Promise<Response> {
  const clientId = process.env.PAYPAL_CLIENT_ID ||
    "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientSecret || !process.env.PASS_SIGNING_SECRET) {
    return json(503, { error: "Fulfillment is temporarily unavailable. Payment was not captured." }, origin);
  }

  if (!(await withinIpThrottle(req, process.env.PASS_SIGNING_SECRET, 60))) {
    return json(429, { error: "Too many requests. Try again later." }, origin);
  }

  let body: { orderId?: string; planId?: string };
  try {
    body = (await req.json()) as { orderId?: string; planId?: string };
  } catch {
    return json(400, { error: "Invalid JSON body." }, origin);
  }
  const { orderId } = body;
  const plan = body.planId ? SERVER_PLANS[body.planId] : undefined;
  if (!orderId || !/^[A-Z0-9]{5,32}$/i.test(orderId) || !plan) {
    return json(400, { error: "Missing or invalid order reference." }, origin);
  }

  try {
    const token = await paypalOauthToken(clientId, clientSecret);

    const { status, data: order } = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token);
    if (status === 404) return json(404, { error: "Order not found." }, origin);
    if (status !== 200 || !order.purchase_units?.length) {
      return json(502, { error: "Could not verify the order with PayPal." }, origin);
    }

    const unit = (order.purchase_units as Array<{ amount?: { value?: string; currency_code?: string } }>)[0];
    const amountOk = unit?.amount?.value === plan.price && unit?.amount?.currency_code === plan.currency;
    if (!amountOk) {
      console.error(`capture-order amount mismatch: order ${orderId} vs plan ${plan.id}`);
      return json(400, { error: "This order does not match the selected plan." }, origin);
    }
    if (!["APPROVED", "COMPLETED"].includes((order.status as string) ?? "")) {
      return json(409, { error: "The order is not approved for capture yet." }, origin);
    }

    if (order.status !== "COMPLETED") {
      const cap = await paypal(`/v2/checkout/orders/${orderId}/capture`, "POST", token);
      const alreadyCaptured =
        cap.status === 422 && (cap.data.details as Array<{ issue?: string }> | undefined)?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED");
      if (cap.status !== 201 && !alreadyCaptured) {
        console.error("PayPal capture failed:", cap.status, JSON.stringify(cap.data).slice(0, 300));
        return json(502, { error: "Payment capture failed. If you were charged, contact support." }, origin);
      }
      const recheck = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token);
      if (recheck.status !== 200) {
        return json(502, { error: "Could not confirm the captured payment." }, origin);
      }
      order = recheck.data;
    }

    const captureStatus = ((order.purchase_units as Array<{ payments?: { captures?: Array<{ status?: string }> } }>)[0]?.payments?.captures?.[0]?.status);
    if (order.status !== "COMPLETED" || (captureStatus && captureStatus !== "COMPLETED")) {
      return json(409, { error: "The payment has not completed yet." }, origin);
    }

    const passToken = await issuePassForOrder(plan, orderId);

    return json(
      200,
      { passToken, requests: plan.requests, expiresDays: plan.days, orderId },
      origin,
    );
  } catch (e) {
    console.error("capture-order error:", e instanceof Error ? e.message : e);
    return json(502, { error: "Fulfillment failed. If you were charged, contact support." }, origin);
  }
}

/* ── PayPal router ──────────────────────────────────────── */

async function handlePayPal(req: Request, origin: string | null): Promise<Response> {
  if (req.method === "OPTIONS") return json(204, {}, origin);
  if (req.method !== "POST") return json(405, { error: "POST only" }, origin);

  const path = new URL(req.url).pathname;
  if (path.endsWith("/create-order")) return handlePayPalCreateOrder(req, origin);
  if (path.endsWith("/capture-order")) return handlePayPalCaptureOrder(req, origin);
  return json(404, { error: "Not found." }, origin);
}

/* ── Hosted-model proxy ─────────────────────────────────── */

async function handleAnthropicProxy(req: Request, origin: string | null): Promise<Response> {
  if (req.method === "OPTIONS") return json(204, {}, origin);
  if (req.method !== "POST") return json(405, { error: "POST only" }, origin);

  if (process.env.HOSTED_PROXY_OFF === "1") {
    return json(503, { error: "Hosted models are paused for maintenance." }, origin);
  }

  const secret = process.env.PASS_SIGNING_SECRET ?? "";
  const key = process.env.ANTHROPIC_HOSTED_KEY ?? "";
  if (!secret || !key || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return json(
      503,
      { error: "Hosted models are temporarily unavailable. Please retry shortly or contact support." },
      origin,
    );
  }

  const auth = req.headers.get("x-api-key") ?? "";
  const pass = await verifyPass(auth);
  if (!pass) {
    return json(
      401,
      { error: "Invalid or expired pass. Use the Access Pass issued with your PayPal payment." },
      origin,
    );
  }

  if (!(await withinIpThrottle(req, secret, IP_REQUESTS_PER_HOUR))) {
    return json(429, { error: "Too many requests from this network. Try again later." }, origin);
  }

  const incoming = new URL(req.url);
  const subPathRaw =
    incoming.searchParams.get("p") ??
    (incoming.pathname.replace(/^\/api\/anthropic\/?/, "") || "v1/messages");
  if (subPathRaw.replace(/^\/+/, "").replace(/\/+$/, "") !== "v1/messages") {
    return json(404, { error: "Not found." }, origin);
  }

  const bodyText = await req.text();
  if (
    bodyText.length > MAX_BODY_BYTES ||
    Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES
  ) {
    return json(413, { error: "Request too large." }, origin);
  }

  let parsed: { model?: unknown; max_tokens?: unknown; stream?: unknown };
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return json(400, { error: "Request body must be JSON." }, origin);
  }
  if (typeof parsed.model !== "string" || !ALLOWED_MODELS.has(parsed.model)) {
    return json(403, { error: "Model not included in your pass." }, origin);
  }
  parsed.max_tokens =
    typeof parsed.max_tokens === "number" && parsed.max_tokens > 0
      ? Math.min(Math.floor(parsed.max_tokens), MAX_TOKENS_CEILING)
      : MAX_TOKENS_CEILING;

  try {
    if (!(await withinQuota(pass.j, pass.q))) {
      return json(402, { error: "This pass has reached its request limit." }, origin);
    }
  } catch (e) {
    console.error("quota backend error:", e instanceof Error ? e.message : e);
    return json(
      503,
      { error: "Usage tracking is briefly unavailable — please retry in a moment." }, origin,
    );
  }

  const upstream = await fetch(`${ANTHROPIC_ORIGIN}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(parsed),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
      ...corsHeaders(origin),
    },
  });
}
