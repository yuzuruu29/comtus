/**
 * ChatGPT/Codex inference relay (Vercel Edge Function).
 *
 * The Codex backend (chatgpt.com/backend-api/codex) blocks cross-origin
 * browser reads entirely, so a ChatGPT-subscription sign-in can't call it
 * directly. This relay forwards the Responses-API request server-side and
 * streams the SSE events back same-origin — token-flow, no buffering.
 *
 * Blind proxy, like api/compat.ts: the caller's OAuth access token rides
 * in the Authorization header and their ChatGPT account id in
 * chatgpt-account-id; both are forwarded and never stored or logged.
 * Requests without a bearer are refused here so the relay can't be used
 * as an open forwarder.
 *
 * Route shape (via vercel.json rewrite): /api/codex/:path*
 *   /api/codex/responses → chatgpt.com/backend-api/codex/responses
 */

export const config = { runtime: "edge" };

const UPSTREAM_ORIGIN = "https://chatgpt.com";

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
        "access-control-allow-headers": "content-type,authorization,chatgpt-account-id",
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

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json(401, { error: "Sign in with your ChatGPT account in Comtus Settings first." }, origin);
  }

  const incoming = new URL(req.url);
  // Rewrites carry the subpath as ?path=; direct hits fall back to the URL.
  const viaRewrite = incoming.searchParams.get("path");
  const subPath = viaRewrite !== null
    ? `/${viaRewrite.replace(/^\/+/, "")}`
    : incoming.pathname.replace(/^\/api\/codex\/?/, "/");
  const upstream = `${UPSTREAM_ORIGIN}/backend-api/codex${subPath.startsWith("/") ? subPath : `/${subPath}`}`;

  const headers: Record<string, string> = {
    authorization,
    "content-type": req.headers.get("content-type") ?? "application/json",
    accept: req.headers.get("accept") ?? "text/event-stream",
  };
  const accountId = req.headers.get("chatgpt-account-id");
  if (accountId) headers["chatgpt-account-id"] = accountId;
  const originator = req.headers.get("originator");
  if (originator) headers.originator = originator;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, {
      method: "POST",
      headers,
      body: await req.text(),
    });
  } catch (err) {
    return json(502, {
      error: `Codex relay couldn't reach chatgpt.com: ${err instanceof Error ? err.message : "unknown"}`,
    }, origin);
  }

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: {
      "content-type": upstreamRes.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
      ...corsHeaders(origin),
    },
  });
}
