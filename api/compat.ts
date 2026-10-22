/**
 * Comtus OpenAI-compatible relay (Vercel Edge Function).
 *
 * A few providers answer the CORS preflight but omit
 * access-control-allow-origin on their real responses — the browser
 * then blocks JavaScript from reading a perfectly healthy reply
 * (verified 2026-08-22: opencode.ai/zen/v1 preflights with ACAO:*,
 * then sends GET/POST responses with no ACAO header at all). This
 * relay fetches upstream server-side and re-serves the bytes
 * same-origin; the caller's own API key rides in the Authorization
 * header and is never stored or logged here.
 *
 * Route shape (via vercel.json rewrite): /api/compat/:provider/:path*
 *   /api/compat/zen/v1/models → p=zen, path=v1/models
 *
 * Env: none required. The Tauri shell reaches this through
 * https://comtus-ai.vercel.app via VITE_API_ORIGIN (CSP already
 * allows that origin), mirroring api/anthropic.ts.
 */

export const config = { runtime: "edge" };

/** provider slug → upstream origin (no trailing slash, no path). */
const UPSTREAMS: Record<string, string> = {
  zen: "https://opencode.ai",
  mistral: "https://api.mistral.ai",
};

/* Origins allowed to call the relay: the web app, the Tauri desktop
   shells, and local dev servers — mirrors api/anthropic.ts. */
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
        "access-control-allow-headers": "content-type,authorization,x-title",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        vary: "origin",
      }
    : {};
}

/** Chat payloads with pasted sources run large; anything past this is abuse. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function json(status: number, body: Record<string, string>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "GET" && req.method !== "POST") {
    return json(405, { error: "GET or POST only" }, origin);
  }

  // Rewrites carry the provider slug as ?p=<slug>; direct hits fall
  // back to the URL path (/api/compat/zen/v1/... → provider "zen").
  const incoming = new URL(req.url);
  const rest = incoming.pathname.replace(/^\/api\/compat\/?/, "");
  const provider = (incoming.searchParams.get("p") || rest.split("/")[0] || "").toLowerCase();
  const upstreamOrigin = UPSTREAMS[provider];
  if (!upstreamOrigin) {
    return json(404, { error: `Unknown relay provider: ${provider || "(none)"}` }, origin);
  }

  let subPath: string;
  const viaRewrite = incoming.searchParams.get("path");
  if (viaRewrite !== null) {
    subPath = `/${viaRewrite.replace(/^\/+/, "")}`;
  } else {
    // Strip "/api/compat/<provider>" from the front of the path.
    subPath = rest.replace(/^[^/]+/, "") || "/";
    if (!subPath.startsWith("/")) subPath = `/${subPath}`;
  }
  // Only expose the API operations used by Comtus. Arbitrary provider paths
  // can reach redirectors or unrelated authenticated account operations.
  const allowedPaths = provider === "zen"
    ? new Set(["/zen/v1/models", "/zen/v1/chat/completions", "/zen/v1/audio/transcriptions", "/v1/models", "/v1/chat/completions", "/v1/audio/transcriptions"])
    : new Set(["/v1/models", "/v1/chat/completions", "/v1/audio/transcriptions"]);
  if (!allowedPaths.has(subPath) || (req.method === "GET") !== subPath.endsWith("/models")) {
    return json(404, { error: "Relay operation not supported." }, origin);
  }
  // Forward caller query params, but never the control params.
  const forwarded = new URLSearchParams(incoming.searchParams);
  forwarded.delete("p");
  forwarded.delete("path");
  const qs = forwarded.toString();
  const upstream = `${upstreamOrigin}${subPath}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  const authorization = req.headers.get("authorization");
  if (contentType) headers["content-type"] = contentType;
  if (authorization) headers["authorization"] = authorization;

  let body: string | ArrayBuffer | undefined;
  if (req.method === "POST") {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return json(413, { error: "Request too large." }, origin);
    }
    body = contentType?.startsWith("multipart/form-data") ? await req.arrayBuffer() : await req.text();
    const bytes = typeof body === "string" ? new TextEncoder().encode(body).byteLength : body.byteLength;
    if (bytes > MAX_BODY_BYTES) return json(413, { error: "Request too large." }, origin);
  }

  let res: Response;
  try {
    res = await fetch(upstream, { method: req.method, headers, redirect: "error", ...(body !== undefined ? { body } : {}) });
  } catch {
    return json(
      502,
      { error: `The ${provider} relay couldn't reach the provider. Please try again.` },
      origin,
    );
  }

  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
      ...corsHeaders(origin),
    },
  });
}
