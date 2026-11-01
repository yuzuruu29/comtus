/**
 * Comtus hosted-model proxy — single file, no cross-module imports.
 *
 * Runs on the Edge runtime so pass-through streaming (SSE) reaches buyers
 * without buffering. PayPal checkout lives in api/paypal.ts (Node runtime —
 * PayPal's edge 403s Vercel Edge egress IPs).
 *
 * Route:
 *   POST /api/anthropic?p=v1/messages — hosted-model proxy
 */

export const config = { runtime: "edge" };

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

/** Every header @anthropic-ai/sdk sends from the browser (anthropic.test.ts
 *  checks this against the installed SDK); one missing name fails preflight. */
const ALLOWED_HEADERS = [
  "content-type",
  "x-api-key",
  "anthropic-version",
  "anthropic-beta",
  "anthropic-dangerous-direct-browser-access",
  "x-stainless-arch",
  "x-stainless-lang",
  "x-stainless-os",
  "x-stainless-package-version",
  "x-stainless-retry-count",
  "x-stainless-runtime",
  "x-stainless-runtime-version",
  "x-stainless-timeout",
  "x-stainless-helper",
  "x-stainless-helper-method",
].join(",");

function corsHeaders(origin?: string | null): HeadersInit {
  return origin && ALLOWED_ORIGINS.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": ALLOWED_HEADERS,
        "access-control-allow-methods": "POST,OPTIONS",
        "access-control-expose-headers": "retry-after,request-id",
        vary: "origin",
      }
    : {};
}

function json(status: number, body: Record<string, unknown>, origin?: string | null): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

function cleanEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

function cleanRedisUrl(): string {
  return cleanEnv(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/, "");
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

/** Refuse hosted spending when the network throttle cannot be checked. */
async function withinIpThrottle(req: Request, secret: string, limitPerHour: number): Promise<boolean> {
  const url = cleanRedisUrl();
  const token = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token || !secret) throw new Error("throttle backend not configured");
  const ip =
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  const bucket = Math.floor(Date.now() / 3600_000);
  const key = `ipthrottle:${await hmacHex(`${ip}:${bucket}`, secret)}`;
  try {
    const res = await fetch(`${url}/incr/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    const { result } = (await res.json()) as { result?: number };
    if (!res.ok || typeof result !== "number" || !Number.isSafeInteger(result) || result < 1) throw new Error("throttle counter unreadable");
    if (result === 1) {
      await fetch(`${url}/expire/${key}/3600`, { headers: { Authorization: `Bearer ${token}` } });
    }
    return result <= limitPerHour;
  } catch {
    throw new Error("throttle backend unavailable");
  }
}

/* ── Hosted-model pass system ───────────────────────────── */

const ANTHROPIC_ORIGIN = "https://api.anthropic.com";
const PASS_PREFIX = "comtus-pass-v1.";

/** Only models with a rate row may be invoked. HOSTED_MODELS may narrow this. */
const ALLOWED_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-5", "claude-sonnet-5"]);
const MODEL_RATES = {
  "claude-opus-5-5": { input: 5000, cacheWrite5m: 6250, cacheWrite1h: 10000, cacheRead: 500, output: 25000 },
  "claude-sonnet-5-5": { input: 2000, cacheWrite5m: 2500, cacheWrite1h: 4000, cacheRead: 200, output: 10000 },
  "claude-opus-5": { input: 5000, cacheWrite5m: 6250, cacheWrite1h: 10000, cacheRead: 500, output: 25000 },
  "claude-sonnet-5": { input: 2000, cacheWrite5m: 2500, cacheWrite1h: 4000, cacheRead: 200, output: 10000 },
} as const;
const REQUEST_MAX_TOKENS = 64000;
const CREDIT_MAX_TOKENS = 16000;
const INPUT_TOKEN_CAP = 100_000;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const IP_REQUESTS_PER_HOUR = 240;
const ALLOWED_BODY_KEYS = new Set([
  "model",
  "max_tokens",
  "system",
  "messages",
  "stream",
  "thinking",
  "output_config",
]);

interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
}

function whole(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** List-price cost in nano-USD. Keep identical to src/lib/credits.ts. */
export function costNano(usage: TokenUsage, model: string): number {
  const rate = MODEL_RATES[model as keyof typeof MODEL_RATES];
  if (!rate) throw new Error(`No hosted rate for ${model}`);
  const hour = whole(usage.cache_creation?.ephemeral_1h_input_tokens);
  const fiveSplit = whole(usage.cache_creation?.ephemeral_5m_input_tokens);
  const creation = whole(usage.cache_creation_input_tokens);
  const five = fiveSplit > 0 || hour > 0 ? fiveSplit : Math.max(0, creation - hour);
  return (
    whole(usage.input_tokens) * rate.input +
    five * rate.cacheWrite5m +
    hour * rate.cacheWrite1h +
    whole(usage.cache_read_input_tokens) * rate.cacheRead +
    whole(usage.output_tokens) * rate.output
  );
}

export function reserveNano(inputChars: number, maxTokens: number, model: string): number {
  const tokens = Math.ceil(Math.max(0, inputChars) / 4);
  return costNano(
    { input_tokens: tokens, output_tokens: Math.max(0, Math.floor(maxTokens)) },
    model,
  );
}

interface PassPayload {
  j: string;
  e: number;
  n?: string;
  /** Version-1 request quota. Absent on credit passes. */
  q?: number;
  /** 2 = credit pass. Missing means a request-count pass already sold. */
  v?: number;
  /** Included usage in nano-USD. */
  c?: number;
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "===".slice((b64.length + 3) % 4));
}

async function hmac(payloadB64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(cleanEnv(process.env.PASS_SIGNING_SECRET)),
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
    if (!payload || typeof payload.j !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.j) ||
        !Number.isSafeInteger(payload.e) || payload.e * 1000 <= Date.now()) return null;
    if (payload.v === 2) {
      if (!Number.isSafeInteger(payload.c) || payload.c! <= 0) return null;
      return payload;
    }
    if (!Number.isSafeInteger(payload.q) || payload.q! <= 0) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Counters outlive their pass by this long, then Redis drops them. */
const COUNTER_GRACE_S = 30 * 86400;

/** Per-pass request count. Fails CLOSED: without a working counter the
    proxy refuses to spend Anthropic money it cannot bound. */
async function withinQuota(pass: PassPayload): Promise<boolean> {
  const url = cleanRedisUrl();
  const token = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) throw new Error("quota backend not configured");
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const res = await fetch(`${url}/incr/pass:${pass.j}`, auth);
  const { result } = (await res.json()) as { result?: number };
  if (!res.ok || typeof result !== "number" || !Number.isSafeInteger(result) || result < 1) throw new Error("quota counter unreadable");
  if (result === 1) {
    // First use: let the counter expire after the pass does.
    await fetch(`${url}/expireat/pass:${pass.j}/${pass.e + COUNTER_GRACE_S}`, auth).catch(() => undefined);
  }
  return result <= (pass.q ?? 0);
}

/** Hands back a request Anthropic refused or never served - failed calls
    are not billed, so they shouldn't spend the buyer's pass either.
    Best effort: a lost refund errs toward the buyer paying one request. */
async function refundQuota(jti: string): Promise<void> {
  const url = cleanRedisUrl();
  const token = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) return;
  try {
    await fetch(`${url}/decr/pass:${jti}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    /* counted once - acceptable */
  }
}

async function redisResult(path: string): Promise<unknown> {
  const url = cleanRedisUrl();
  const token = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) throw new Error("quota backend not configured");
  const res = await fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as { result?: unknown; error?: unknown };
  if (!res.ok || data.error || !("result" in data)) throw new Error("quota backend unreadable");
  return data.result;
}

async function isDenied(jti: string): Promise<boolean> {
  const result = await redisResult(`/get/passdeny:${jti}`);
  if (result !== null && result !== "1" && result !== 1) throw new Error("revocation status unreadable");
  return result === "1" || result === 1;
}

async function incrBy(key: string, amount: number, expireAt?: number): Promise<number> {
  const result = await redisResult(`/incrby/${key}/${amount}`);
  if (typeof result !== "number" || !Number.isSafeInteger(result) || result < amount) throw new Error("quota counter unreadable");
  if (result === amount && expireAt) {
    await redisResult(`/expireat/${key}/${expireAt}`).catch(() => undefined);
  }
  return result;
}

async function decrBy(key: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  try {
    await redisResult(`/decrby/${key}/${amount}`);
  } catch {
    /* a lost refund errs toward the buyer */
  }
}

function allowedModel(model: string): boolean {
  if (!ALLOWED_MODELS.has(model) || !(model in MODEL_RATES)) return false;
  const env = cleanEnv(process.env.HOSTED_MODELS);
  if (!env) return true;
  const narrowed = new Set(env.split(",").map((item) => item.trim()).filter(Boolean));
  return narrowed.has(model);
}

function pickBody(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_BODY_KEYS) {
    if (key in raw) out[key] = raw[key];
  }
  return out;
}

/** Count images, documents and multilingual text with the provider's tokenizer. */
async function countInputTokens(
  body: Record<string, unknown>,
  key: string,
  origin: string | null,
): Promise<{ ok: true; tokens: number } | { ok: false; response: Response }> {
  let counted: Response;
  try {
    counted = await fetch(`${ANTHROPIC_ORIGIN}/v1/messages/count_tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: body.model, system: body.system, messages: body.messages, thinking: body.thinking }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch (e) {
    console.error("anthropic count_tokens unreachable:", e instanceof Error ? e.message : e);
    return {
      ok: false,
      response: json(502, { error: "Claude could not be reached. This request was not counted against your pass." }, origin),
    };
  }
  if (!counted.ok) {
    if (counted.status === 401 || counted.status === 403) {
      console.error("anthropic hosted key rejected during count_tokens:", counted.status);
      return {
        ok: false,
        response: json(503, { error: "Hosted models are temporarily unavailable. This request was not counted against your pass." }, origin),
      };
    }
    return { ok: false, response: passthrough(counted, counted.body, origin) };
  }
  try {
    const data = (await counted.json()) as { input_tokens?: unknown };
    if (typeof data.input_tokens !== "number" || !Number.isSafeInteger(data.input_tokens) || data.input_tokens < 0) {
      return {
        ok: false,
        response: json(503, { error: "Hosted models are temporarily unavailable. This request was not counted against your pass." }, origin),
      };
    }
    return { ok: true, tokens: data.input_tokens };
  } catch {
    return {
      ok: false,
      response: json(503, { error: "Hosted models are temporarily unavailable. This request was not counted against your pass." }, origin),
    };
  }
}

function absorbUsage(usage: TokenUsage, event: { type?: string; message?: { usage?: TokenUsage }; usage?: TokenUsage }): TokenUsage {
  if (event.type === "message_start" && event.message?.usage) return { ...usage, ...event.message.usage };
  if (event.type === "message_delta" && event.usage) return { ...usage, output_tokens: event.usage.output_tokens };
  if (event.usage && event.type !== "message_delta") return { ...usage, ...event.usage };
  return usage;
}

function usageFromSse(text: string): TokenUsage {
  let usage: TokenUsage = {};
  for (const part of text.split("\n\n")) {
    const data = part
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data || data === "[DONE]") continue;
    try {
      usage = absorbUsage(usage, JSON.parse(data) as { type?: string; message?: { usage?: TokenUsage }; usage?: TokenUsage });
    } catch {
      /* a non-JSON keepalive is not usage */
    }
  }
  return usage;
}

function usageKnown(usage: TokenUsage): boolean {
  return [usage.input_tokens, usage.output_tokens].every(
    (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
  );
}

/** Upstream headers worth passing through to the client. */
const FORWARDED_HEADERS = ["retry-after", "request-id"] as const;

/* ── Route dispatch ─────────────────────────────────────── */

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  return handleAnthropicProxy(req, origin);
}

/* ── Hosted-model proxy ─────────────────────────────────── */

async function handleAnthropicProxy(req: Request, origin: string | null): Promise<Response> {
  if (req.method === "OPTIONS") return json(204, {}, origin);
  if (req.method !== "POST") return json(405, { error: "POST only" }, origin);

  if (cleanEnv(process.env.HOSTED_PROXY_OFF) === "1") {
    return json(503, { error: "Hosted models are paused for maintenance." }, origin);
  }

  const secret = cleanEnv(process.env.PASS_SIGNING_SECRET);
  const key = cleanEnv(process.env.ANTHROPIC_HOSTED_KEY);
  if (!secret || !key || !cleanRedisUrl() || !cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN)) {
    return json(
      503,
      { error: "Hosted models are temporarily unavailable. Please retry shortly or contact support." },
      origin,
    );
  }

  const auth = (req.headers.get("x-api-key") ?? "").trim();
  const pass = await verifyPass(auth);
  if (!pass) {
    return json(
      401,
      { error: "Invalid or expired pass. Use the Access Pass issued with your PayPal payment." },
      origin,
    );
  }

  try {
    if (!(await withinIpThrottle(req, secret, IP_REQUESTS_PER_HOUR))) {
      return json(429, { error: "Too many requests from this network. Try again later." }, origin);
    }
  } catch {
    return json(503, { error: "Usage tracking is briefly unavailable - please retry in a moment." }, origin);
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
    new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES ||
    Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES
  ) {
    return json(413, { error: "Request too large." }, origin);
  }

  let rawBody: Record<string, unknown>;
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json(400, { error: "Request body must be a JSON object." }, origin);
    }
    rawBody = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "Request body must be JSON." }, origin);
  }
  const body = pickBody(rawBody);
  const credit = pass.v === 2;
  if (typeof body.model !== "string" || !allowedModel(body.model)) {
    return json(403, { error: "Model not included in your pass." }, origin);
  }
  const ceiling = credit ? CREDIT_MAX_TOKENS : REQUEST_MAX_TOKENS;
  body.max_tokens =
    typeof body.max_tokens === "number" && Number.isFinite(body.max_tokens) && body.max_tokens >= 1
      ? Math.min(Math.floor(body.max_tokens), ceiling)
      : ceiling;

  const creditKey = `credit:${pass.j}`;
  try {
    if (await isDenied(pass.j)) {
      return json(401, { error: "This pass has been revoked." }, origin);
    }
  } catch (e) {
    console.error("quota backend error:", e instanceof Error ? e.message : e);
    return json(503, { error: "Usage tracking is briefly unavailable - please retry in a moment." }, origin);
  }

  let inputTokens = 0;
  if (credit) {
    const counted = await countInputTokens(body, key, origin);
    if (!counted.ok) return counted.response;
    inputTokens = counted.tokens;
    if (inputTokens > INPUT_TOKEN_CAP) {
      return json(
        413,
        { error: "This notebook is too large for a hosted pass. Use your own key for a larger notebook." },
        origin,
      );
    }
  }

  let reserved = 0;
  try {
    if (credit) {
      // Token counts are estimates. Include headroom and the highest cache-write rate;
      // assuming English chars/4 or a cache discount lets parallel calls overspend.
      const paddedTokens = Math.ceil(inputTokens * 110 / 100) + 1024;
      reserved = costNano({ cache_creation: { ephemeral_1h_input_tokens: paddedTokens }, output_tokens: body.max_tokens as number }, body.model);
      const used = await incrBy(creditKey, reserved, pass.e + COUNTER_GRACE_S);
      if (used > (pass.c ?? 0)) {
        await decrBy(creditKey, reserved);
        return json(
          402,
          {
            error: "This pass does not have enough hosted usage left for this reply.",
            remaining: Math.max(0, (pass.c ?? 0) - (used - reserved)),
          },
          origin,
        );
      }
    } else if (!(await withinQuota(pass))) {
      return json(402, { error: "This pass has reached its request limit." }, origin);
    }
  } catch (e) {
    console.error("quota backend error:", e instanceof Error ? e.message : e);
    return json(503, { error: "Usage tracking is briefly unavailable - please retry in a moment." }, origin);
  }

  const release = async () => {
    if (credit) await decrBy(creditKey, reserved);
    else await refundQuota(pass.j);
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${ANTHROPIC_ORIGIN}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      redirect: "error",
    });
  } catch (e) {
    console.error("anthropic upstream unreachable:", e instanceof Error ? e.message : e);
    await release();
    return json(
      502,
      { error: "Claude could not be reached. This request was not counted against your pass." },
      origin,
    );
  }

  if (!upstream.ok) {
    await release();
    if (upstream.status === 401 || upstream.status === 403) {
      console.error("anthropic hosted key rejected:", upstream.status);
      return json(
        503,
        { error: "Hosted models are temporarily unavailable. This request was not counted against your pass." },
        origin,
      );
    }
    return passthrough(upstream, upstream.body, origin);
  }

  if (!credit) return passthrough(upstream, upstream.body, origin);

  const settle = async (usage: TokenUsage) => {
    if (!usageKnown(usage)) {
      console.log(JSON.stringify({ model: body.model, j: pass.j, reserve: reserved, actual: null, status: "kept" }));
      return;
    }
    let actual = reserved;
    try {
      actual = costNano(usage, body.model as string);
    } catch {
      actual = reserved;
    }
    const delta = reserved - actual;
    if (delta > 0) await decrBy(creditKey, delta);
    else if (delta < 0) {
      try {
        await incrBy(creditKey, -delta);
      } catch {
        /* the reply already went out; the overage is logged below */
      }
    }
    console.log(JSON.stringify({ model: body.model, j: pass.j, reserve: reserved, actual, status: "settled" }));
  };

  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream") && upstream.body) {
    return passthrough(upstream, meterStream(upstream.body, settle), origin);
  }

  const text = await upstream.text();
  let usage: TokenUsage = {};
  try {
    const parsed = JSON.parse(text) as { usage?: TokenUsage };
    if (parsed.usage) usage = parsed.usage;
  } catch {
    /* no usage — the reserve stands */
  }
  await settle(usage);
  return passthrough(upstream, text, origin);
}

function passthrough(upstream: Response, body: BodyInit | null, origin: string | null): Response {
  const headers: Record<string, string> = {};
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
      ...headers,
      ...corsHeaders(origin),
    },
  });
}

function meterStream(
  source: ReadableStream<Uint8Array>,
  onDone: (usage: TokenUsage) => Promise<void>,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: TokenUsage = {};
  let finished = false;
  let complete = false;
  const absorb = (text: string) => {
    usage = { ...usage, ...usageFromSse(text) };
    if (text.split("\n").some((line) => {
      if (!line.startsWith("data:")) return false;
      try { return JSON.parse(line.slice(5)).type === "message_stop"; } catch { return false; }
    })) complete = true;
  };
  const finish = async () => {
    if (finished) return;
    finished = true;
    if (buffer) absorb(buffer);
    // Cancellation or a truncated stream is not final usage; keep its reserve.
    if (complete) await onDone(usage);
  };
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        controller.close();
        await finish();
        return;
      }
      controller.enqueue(value);
      buffer += decoder.decode(value, { stream: true });
      const splitAt = buffer.lastIndexOf("\n\n");
      if (splitAt >= 0) {
        absorb(buffer.slice(0, splitAt + 2));
        buffer = buffer.slice(splitAt + 2);
      }
    },
    async cancel() {
      await reader.cancel().catch(() => undefined);
      await finish();
    },
  });
}
