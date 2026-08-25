/**
 * Comtus hosted-models proxy (Vercel Edge Function).
 *
 * The browser never holds the Anthropic key. Clients that purchased a
 * Smarter Models pass authenticate with an HMAC-signed pass token
 * (issued automatically by api/paypal/capture-order.ts at purchase time);
 * this function verifies the signature + expiry, enforces per-pass and
 * per-IP quotas (Upstash Redis REST, fail-closed), restricts traffic to
 * exactly POST /v1/messages on an allowlisted Claude model with bounded
 * max_tokens, and forwards to Anthropic with the server-held key,
 * streaming the SSE response straight back.
 *
 * Env (Vercel → Settings → Environment Variables):
 *   ANTHROPIC_HOSTED_KEY          sk-ant-… key, never in client code
 *   PASS_SIGNING_SECRET           same secret used by issuance
 *   UPSTASH_REDIS_REST_URL        REQUIRED — quota counting fails closed
 *   UPSTASH_REDIS_REST_TOKEN      REQUIRED
 *   HOSTED_PROXY_OFF              set to "1" as a global kill switch
 */

import { corsHeaders, json, withinIpThrottle } from "./_http";

export const config = { runtime: "nodejs" };

const ANTHROPIC_ORIGIN = "https://api.anthropic.com";
const PASS_PREFIX = "comtus-pass-v1.";

/** Only the two models sold with hosted passes may be invoked. */
const ALLOWED_MODELS = new Set(["claude-opus-5", "claude-sonnet-5"]);
const MAX_TOKENS_CEILING = 64000;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const IP_REQUESTS_PER_HOUR = 240;

interface PassPayload {
  j: string; // random id (quota counter key)
  q: number; // allowed requests
  e: number; // expiry, epoch seconds
  n?: string; // plan name, for logs/support
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
  const bytes = new Uint8Array(sig);
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Verify signature (timing-safe-ish) and expiry; returns the payload. */
async function verifyPass(token: string): Promise<PassPayload | null> {
  if (!token.startsWith(PASS_PREFIX)) return null;
  const rest = token.slice(PASS_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = rest.slice(0, dot);
  const sigHex = rest.slice(dot + 1);

  const expected = await hmac(payloadB64);
  if (sigHex.length !== expected.length) return null;
  // constant-time compare
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

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

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

  // Only the chat-completions surface is proxied. Rewrites carry SDK
  // subpaths as ?p=v1/messages; direct hits use the URL path.
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

  // Bound what a pass can spend per call: parseable JSON, allowlisted
  // model, max_tokens clamped under the ceiling. Re-serialize so upstream
  // receives exactly the fields we validated.
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

  // Quota is counted last, after every other gate — rejected requests
  // must never consume a paid request.
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
