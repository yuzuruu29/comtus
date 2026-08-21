/**
 * Comtus hosted-models proxy (Vercel Edge Function).
 *
 * The browser never holds the Anthropic key. Clients that purchased a
 * Smarter Models pass authenticate with an HMAC-signed pass token
 * (issued via scripts/issue-pass.mjs); this function verifies the
 * signature + expiry, optionally enforces a per-pass request quota
 * (Upstash Redis REST), and forwards the request to Anthropic with the
 * server-held key, streaming the SSE response straight back.
 *
 * Env (Vercel → Settings → Environment Variables):
 *   ANTHROPIC_HOSTED_KEY          sk-ant-… key, never in client code
 *   PASS_SIGNING_SECRET           same secret used by the issuance script
 *   UPSTASH_REDIS_REST_URL        optional — enables request counting
 *   UPSTASH_REDIS_REST_TOKEN      optional — enables request counting
 */

export const config = { runtime: "edge" };

const ANTHROPIC_ORIGIN = "https://api.anthropic.com";
const PASS_PREFIX = "comtus-pass-v1.";

/* Origins allowed to call the proxy: the web app, the Tauri desktop
   shells, and local dev servers. */
const ALLOWED_ORIGINS = new Set([
  "https://comtus-ai.vercel.app",
  "http://tauri.localhost",
  "tauri://localhost",
  "http://localhost:5173",
  "http://localhost:5199",
  "http://localhost:4173",
]);

interface PassPayload {
  j: string; // random id (quota counter key)
  q: number; // allowed requests
  e: number; // expiry, epoch seconds
  n?: string; // plan name, for logs/support
}

function json(status: number, body: Record<string, string>, origin?: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...(origin && ALLOWED_ORIGINS.has(origin)
        ? {
            "access-control-allow-origin": origin,
            "access-control-allow-headers": "content-type,x-api-key,anthropic-version",
            "access-control-allow-methods": "POST,OPTIONS",
          }
        : {}),
    },
  });
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
    return payload;
  } catch {
    return null;
  }
}

/** Request counting when Upstash is configured; otherwise allow. */
async function withinQuota(jti: string, quota: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;
  try {
    const res = await fetch(`${url}/incr/pass:${jti}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { result } = (await res.json()) as { result?: number };
    return typeof result === "number" ? result <= quota : true;
  } catch {
    return true; // counter unavailable → don't punish paying users
  }
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return json(204, {}, origin);
  if (req.method !== "POST") return json(405, { error: "POST only" }, origin);

  const auth = req.headers.get("x-api-key") ?? "";
  const pass = await verifyPass(auth);
  if (!pass) {
    return json(
      401,
      { error: "Invalid or expired pass. Paste the token received with your PayPal payment." },
      origin,
    );
  }

  if (!(await withinQuota(pass.j, pass.q))) {
    return json(402, { error: "This pass has reached its request limit." }, origin);
  }

  const key = process.env.ANTHROPIC_HOSTED_KEY;
  if (!key) {
    return json(503, { error: "Hosted models are not configured. Contact support." }, origin);
  }

  const incoming = new URL(req.url);
  const upstream = await fetch(`${ANTHROPIC_ORIGIN}${incoming.pathname}${incoming.search}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": req.headers.get("anthropic-version") ?? "2023-06-01",
    },
    body: await req.text(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
      ...(origin && ALLOWED_ORIGINS.has(origin)
        ? { "access-control-allow-origin": origin }
        : {}),
    },
  });
}
