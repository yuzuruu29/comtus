/**
 * ChatGPT/Codex inference + model relay (Vercel Node.js Function).
 *
 * The Codex backend (chatgpt.com/backend-api/codex) blocks cross-origin
 * browser reads entirely AND blocks most Vercel Edge egress IPs (verified
 * 2026-08-26: Edge fetch returns a 403 HTML bot-block page from
 * chatgpt.com's WAF/Cloudflare — same class of failure as the PayPal
 * edge 403s, see api/paypal.ts). This relay therefore runs on the Node
 * runtime, like paypal.ts, forwards the Responses-API request
 * server-side, and streams the SSE events back chunk-by-chunk.
 *
 * Blind proxy, like api/compat.ts: the caller's OAuth access token rides
 * in the Authorization header, account id in chatgpt-account-id, and
 * Codex-compat headers (OpenAI-Beta, session_id, conversation_id,
 * originator, version) are forwarded — nothing is stored or logged here.
 * Requests without a bearer are refused so the relay can't be used as an
 * open forwarder.
 *
 * Routes (via vercel.json rewrite):
 *   POST /api/codex/responses → chatgpt.com/backend-api/codex/responses
 *   GET  /api/codex/models    → chatgpt.com/backend-api/codex/models
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

export const config = { runtime: "nodejs" };

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

function corsHeaders(origin?: string | string[] | null): Array<[string, string]> {
  const o = Array.isArray(origin) ? origin[0] : origin;
  if (!o || !ALLOWED_ORIGINS.has(o)) return [];
  return [
    ["access-control-allow-origin", o],
    ["access-control-allow-headers", "content-type,authorization,chatgpt-account-id,openai-beta,session_id,conversation_id,originator,version"],
    ["access-control-allow-methods", "GET,POST,OPTIONS"],
  ];
}

function sendJson(res: ServerResponse, status: number, body: Record<string, string>, origin?: string | null): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  for (const [k, v] of corsHeaders(origin)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [k, v] of corsHeaders(origin)) res.setHeader(k, v);
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    sendJson(res, 405, { error: "GET or POST only" }, origin);
    return;
  }

  const authorization = String(req.headers.authorization ?? "");
  if (!authorization.startsWith("Bearer ")) {
    sendJson(res, 401, { error: "Sign in with your ChatGPT account in Comtus Settings first." }, origin);
    return;
  }

  const url = new URL(req.url ?? "/", "https://comtus.local");
  // Rewrites carry the subpath as ?path=; direct hits fall back to the URL.
  const viaRewrite = url.searchParams.get("path");
  const subPath = viaRewrite !== null
    ? `/${viaRewrite.replace(/^\/+/, "")}`
    : url.pathname.replace(/^\/api\/codex\/?/, "/");
  const upstream = `${UPSTREAM_ORIGIN}/backend-api/codex${subPath.startsWith("/") ? subPath : `/${subPath}`}`;

  const headers: Record<string, string> = {
    authorization,
    accept: String(req.headers.accept ?? "text/event-stream"),
  };
  if (req.method === "POST") headers["content-type"] = String(req.headers["content-type"] ?? "application/json");
  for (const name of ["chatgpt-account-id", "openai-beta", "session_id", "conversation_id", "originator", "version"]) {
    const value = req.headers[name];
    if (value) headers[name] = Array.isArray(value) ? value[0] : value;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, {
      method: req.method,
      headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
  } catch (err) {
    sendJson(res, 502, {
      error: `Codex relay couldn't reach chatgpt.com: ${err instanceof Error ? err.message : "unknown"}`,
    }, origin);
    return;
  }

  res.statusCode = upstreamRes.status;
  res.setHeader("content-type", upstreamRes.headers.get("content-type") ?? "application/json");
  res.setHeader("cache-control", "no-store");
  for (const [k, v] of corsHeaders(origin)) res.setHeader(k, v);

  if (!upstreamRes.body) {
    res.end();
    return;
  }
  if (req.method === "GET") {
    res.end(await upstreamRes.text());
    return;
  }
  // SSE must token-flow, not buffer until completion.
  await pipeline(
    Readable.fromWeb(upstreamRes.body as unknown as WebReadableStream<Uint8Array>),
    res,
  );
}
