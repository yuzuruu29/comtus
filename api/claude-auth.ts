/**
 * Claude OAuth token relay (Vercel Edge Function).
 *
 * platform.claude.com/v1/oauth/token answers CORS preflights without an
 * access-control-allow-origin header for third-party origins (verified
 * 2026-08-25 — even localhost origins get none), so the browser can't
 * complete the Claude-subscription sign-in exchange directly. This relay
 * forwards the exchange/refresh POST server-side and returns the JSON.
 *
 * The relay is stateless and blind: the request body (grant_type, code,
 * code_verifier, refresh_token…) is forwarded verbatim and the tokens in
 * the response are only ever seen in transit — they live in the student's
 * browser, never here. No env, no storage, no logging.
 *
 * The Tauri shell reaches this through VITE_API_ORIGIN, mirroring
 * api/anthropic.ts and api/compat.ts.
 */

export const config = { runtime: "edge" };

const UPSTREAM = "https://platform.claude.com/v1/oauth/token";

/** The sign-in flow only ever exchanges a code or refreshes a token. */
const ALLOWED_GRANTS = new Set(["authorization_code", "refresh_token"]);
/** A token request is a few hundred bytes; 16 KB is generous. */
const MAX_BODY_BYTES = 16 * 1024;

/* Origins allowed to call the relay — mirrors api/compat.ts. */
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

function corsHeaders(origin: string | null): Record<string, string> {
  return origin && ALLOWED_ORIGINS.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "POST,OPTIONS",
      }
    : {};
}

function json(status: number, body: Record<string, string>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json(405, { error: "POST only" }, origin);

  const body = await req.text();
  if (!body) return json(400, { error: "Missing request body" }, origin);
  if (body.length > MAX_BODY_BYTES) return json(413, { error: "Request too large" }, origin);
  let grant: unknown;
  try {
    grant = (JSON.parse(body) as { grant_type?: unknown })?.grant_type;
  } catch {
    return json(400, { error: "Request body must be JSON" }, origin);
  }
  if (typeof grant !== "string" || !ALLOWED_GRANTS.has(grant)) {
    return json(400, { error: "Unsupported grant_type" }, origin);
  }

  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch (err) {
    return json(502, {
      error: `Claude sign-in relay couldn't reach the token endpoint: ${err instanceof Error ? err.message : "unknown"}`,
    }, origin);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
      ...corsHeaders(origin),
    },
  });
}
