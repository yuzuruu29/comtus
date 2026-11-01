import { createHmac } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./anthropic";

const SECRET = "test-signing-secret";
const UPSTASH = "https://test-upstash.example";
const HOSTED_KEY = "sk-ant-test-hosted-key";

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}

function signPass(payload: Record<string, unknown>): string {
  const payloadB64 = b64url(JSON.stringify({ q: 200, e: Math.floor(Date.now() / 1000) + 3600, ...payload }));
  const sig = createHmac("sha256", SECRET).update(payloadB64).digest("hex");
  return `comtus-pass-v1.${payloadB64}.${sig}`;
}

function proxyReq(body: object | string, pass?: string): Request {
  const headers: Record<string, string> = {
    origin: "http://127.0.0.1:5199",
    "content-type": "application/json",
  };
  if (pass) headers["x-api-key"] = pass;
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost:3000/api/anthropic?p=v1/messages", {
    method: "POST",
    headers,
    body: raw,
  });
}

function creditFetch(opts: { incrByResult?: number; upstream?: Response; denied?: boolean; inputTokens?: number } = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith("/count_tokens")) return new Response(JSON.stringify({ input_tokens: opts.inputTokens ?? 10 }));
    if (url.includes("/incr/ipthrottle:")) return new Response(JSON.stringify({ result: 1 }));
    if (url.includes("/get/passdeny:")) {
      return new Response(JSON.stringify({ result: opts.denied ? "1" : null }), { status: 200 });
    }
    const incr = url.match(/\/incrby\/[^/]+\/(\d+)$/);
    if (incr) return new Response(JSON.stringify({ result: opts.incrByResult ?? Number(incr[1]) }), { status: 200 });
    if (url.includes("/decrby/") || url.includes("/expireat/")) return new Response(JSON.stringify({ result: 1 }), { status: 200 });
    if (url.startsWith("https://api.anthropic.com")) {
      return opts.upstream ?? new Response(JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    void init;
    return new Response("{}", { status: 200 });
  });
}

function reservedFrom(fetchMock: ReturnType<typeof creditFetch>): number {
  const hit = fetchMock.mock.calls.map((call) => String(call[0])).find((url) => url.includes("/incrby/"));
  return Number(hit?.split("/").pop());
}

function mockFetch(opts: { incrResult?: number; upstream?: Response } = {}) {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    void _init;
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/get/passdeny:")) return new Response(JSON.stringify({ result: null }));
    if (url.includes("/incr/")) {
      if (url.includes("ipthrottle:")) return new Response(JSON.stringify({ result: 1 }));
      return new Response(JSON.stringify({ result: opts.incrResult ?? 1 }), { status: 200 });
    }
    if (url.startsWith("https://api.anthropic.com")) {
      return (
        opts.upstream ??
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    }
    return new Response("{}", { status: 200 });
  });
}

const ENV_KEYS = [
  "PASS_SIGNING_SECRET",
  "ANTHROPIC_HOSTED_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "HOSTED_PROXY_OFF",
];

function withProxyEnv(): void {
  process.env.PASS_SIGNING_SECRET = SECRET;
  process.env.ANTHROPIC_HOSTED_KEY = HOSTED_KEY;
  process.env.UPSTASH_REDIS_REST_URL = UPSTASH;
  process.env.UPSTASH_REDIS_REST_TOKEN = "upstash-token";
  delete process.env.HOSTED_PROXY_OFF;
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("hosted Anthropic proxy", () => {
  it("allows the isolated Tauri development origin", async () => {
    const origin = "http://127.0.0.1:5199";
    const response = await handler(
      new Request("http://localhost:3000/api/anthropic/v1/messages", {
        method: "OPTIONS",
        headers: { origin },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it("preflight from an unknown origin gets no CORS grant", async () => {
    const res = await handler(
      new Request("http://localhost:3000/api/anthropic", { method: "OPTIONS", headers: { origin: "https://evil.example" } }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("preflight allows every header the installed SDK sends", async () => {
    const sent = new Set<string>();
    const client = new Anthropic({
      apiKey: "comtus-pass-v1.test",
      baseURL: "https://www.comtus-ai.xyz/api/anthropic",
      dangerouslyAllowBrowser: true,
      maxRetries: 0,
      fetch: async (_url: unknown, init?: RequestInit) => {
        new Headers(init?.headers).forEach((_value, name) => sent.add(name));
        return new Response("{}", { status: 500 });
      },
    });
    const params = { model: "claude-sonnet-5", max_tokens: 1, messages: [{ role: "user" as const, content: "hi" }] };
    await client.messages.create(params).catch(() => undefined);
    await client.messages.stream(params).finalMessage().catch(() => undefined);
    // Browsers send these without asking (or refuse to let scripts set them).
    for (const free of ["accept", "user-agent"]) sent.delete(free);
    expect(sent.size).toBeGreaterThan(3);

    const res = await handler(
      new Request("http://localhost:3000/api/anthropic", { method: "OPTIONS", headers: { origin: "http://tauri.localhost" } }),
    );
    const allowed = res.headers.get("access-control-allow-headers")?.split(",") ?? [];
    expect([...sent].filter((name) => !allowed.includes(name))).toEqual([]);
  });

  it("rejects non-POST methods", async () => {
    withProxyEnv();
    const res = await handler(new Request("http://localhost:3000/api/anthropic"));
    expect(res.status).toBe(405);
  });

  it("fails closed when required configuration is missing", async () => {
    const resNoConfig = await handler(proxyReq({ model: "claude-opus-5", max_tokens: 100 }));
    expect(resNoConfig.status).toBe(503);

    withProxyEnv();
    process.env.HOSTED_PROXY_OFF = "1";
    const resKilled = await handler(proxyReq({ model: "claude-opus-5", max_tokens: 100 }));
    expect(resKilled.status).toBe(503);
  });

  it("rejects missing, malformed, and forged passes with 401", async () => {
    withProxyEnv();

    const resNone = await handler(proxyReq({ model: "claude-opus-5", max_tokens: 100 }));
    expect(resNone.status).toBe(401);

    const resGarbage = await handler(proxyReq({ model: "claude-opus-5", max_tokens: 100 }, "comtus-pass-v1.abc.def"));
    expect(resGarbage.status).toBe(401);

    const forged = signPass({ j: "forged01" }).replace(/.$/, (c) => (c === "0" ? "1" : "0"));
    const resForged = await handler(proxyReq({ model: "claude-opus-5", max_tokens: 100 }, forged));
    expect(resForged.status).toBe(401);

    const expired = signPass({ j: "expired01", e: Math.floor(Date.now() / 1000) - 10 });
    const resExpired = await handler(proxyReq({ model: "claude-opus-5", max_tokens: 100 }, expired));
    expect(resExpired.status).toBe(401);
  });

  it("proxies only /v1/messages", async () => {
    withProxyEnv();
    vi.stubGlobal("fetch", mockFetch());
    const pass = signPass({ j: "pathcheck" });
    const req = new Request("http://localhost:3000/api/anthropic/v1/models", {
      method: "POST",
      headers: { "x-api-key": pass, "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-opus-5" }),
    });
    const res = await handler(req);
    expect(res.status).toBe(404);
  });

  it("forwards valid calls with clamped max_tokens and the server key", async () => {
    withProxyEnv();
    const fetchMock = mockFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const res = await handler(
      proxyReq({ model: "claude-opus-5", max_tokens: 999999, stream: true }, signPass({ j: "clampcheck" })),
    );
    expect(res.status).toBe(200);

    const upstreamCall = fetchMock.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined;
      return Boolean(init && typeof init === "object" && "body" in init);
    }) as [string | URL | Request, RequestInit] | undefined;
    const forwarded = JSON.parse((upstreamCall?.[1] as RequestInit).body as string);
    expect(forwarded.max_tokens).toBe(64000);
    expect(forwarded.model).toBe("claude-opus-5");
    const sentHeaders = (upstreamCall?.[1] as RequestInit).headers as Record<string, string>;
    expect(sentHeaders["x-api-key"]).toBe(HOSTED_KEY);
  });

  it("blocks models outside the allowlist", async () => {
    withProxyEnv();
    vi.stubGlobal("fetch", mockFetch({}));
    const res = await handler(proxyReq({ model: "claude-opus-4-20250514", max_tokens: 100 }, signPass({ j: "modcheck" })));
    expect(res.status).toBe(403);
  });

  it("enforces the per-pass request quota (402)", async () => {
    withProxyEnv();
    vi.stubGlobal("fetch", mockFetch({ incrResult: 201 }));
    const res = await handler(proxyReq({ model: "claude-sonnet-5", max_tokens: 100 }, signPass({ j: "quotacheck", q: 200 })));
    expect(res.status).toBe(402);
  });

  it("fails closed when the quota counter errors", async () => {
    withProxyEnv();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("redis down"); }));
    const res = await handler(proxyReq({ model: "claude-sonnet-5", max_tokens: 100 }, signPass({ j: "redisdown" })));
    expect(res.status).toBe(503);
  });

  it("returns 413 for oversized bodies and 400 for invalid JSON", async () => {
    withProxyEnv();
    vi.stubGlobal("fetch", mockFetch());
    const pass = signPass({ j: "sizecheck" });

    const big = JSON.stringify({ model: "claude-opus-5", max_tokens: 16, pad: "x".repeat(8 * 1024 * 1024 + 64) });
    const resBig = await handler(proxyReq(big, pass));
    expect(resBig.status).toBe(413);

    const resBadJson = await handler(proxyReq("{not json", pass));
    expect(resBadJson.status).toBe(400);
  });

  it("refunds the pass when Anthropic refuses the request", async () => {
    withProxyEnv();
    const fetchMock = mockFetch({
      upstream: new Response(JSON.stringify({ type: "error", error: { type: "overloaded_error" } }), {
        status: 529,
        headers: { "content-type": "application/json", "retry-after": "12" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await handler(proxyReq({ model: "claude-sonnet-5", max_tokens: 100 }, signPass({ j: "refund01" })));
    expect(res.status).toBe(529);
    expect(res.headers.get("retry-after")).toBe("12");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith("/decr/pass:refund01"))).toBe(true);
  });

  it("does not refund a served request", async () => {
    withProxyEnv();
    const fetchMock = mockFetch({});
    vi.stubGlobal("fetch", fetchMock);
    await handler(proxyReq({ model: "claude-sonnet-5", max_tokens: 100 }, signPass({ j: "served01" })));
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/decr/"))).toBe(false);
  });

  it("answers 502 with CORS and refunds when Anthropic is unreachable", async () => {
    withProxyEnv();
    const base = mockFetch({});
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).startsWith("https://api.anthropic.com")) throw new TypeError("fetch failed");
      return base(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await handler(proxyReq({ model: "claude-opus-5", max_tokens: 100 }, signPass({ j: "down01" })));
    expect(res.status).toBe(502);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5199");
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/decr/pass:down01"))).toBe(true);
  });

  it("strips tools and clamps a credit pass to 16000 output tokens", async () => {
    withProxyEnv();
    const fetchMock = creditFetch();
    vi.stubGlobal("fetch", fetchMock);
    const pass = signPass({ j: "credit01", v: 2, c: 5_000_000_000 });
    const res = await handler(
      proxyReq(
        {
          model: "claude-sonnet-5",
          max_tokens: 999999,
          tools: [{ name: "shell" }],
          messages: [{ role: "user", content: "hi" }],
        },
        pass,
      ),
    );
    expect(res.status).toBe(200);
    const upstreamCall = fetchMock.mock.calls.find((call) => String(call[0]) === "https://api.anthropic.com/v1/messages");
    const forwarded = JSON.parse((upstreamCall?.[1] as RequestInit).body as string);
    expect(forwarded.tools).toBeUndefined();
    expect(forwarded.max_tokens).toBe(16000);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/decrby/credit:credit01/"))).toBe(true);
  });

  it("rejects a credit pass whose notebook exceeds the input cap", async () => {
    withProxyEnv();
    vi.stubGlobal("fetch", creditFetch({ inputTokens: 100_001 }));
    const pass = signPass({ j: "big01", v: 2, c: 5_000_000_000 });
    const res = await handler(
      proxyReq(
        { model: "claude-sonnet-5", max_tokens: 100, messages: [{ role: "user", content: "x".repeat(400_001) }] },
        pass,
      ),
    );
    expect(res.status).toBe(413);
  });

  it("refunds the credit reserve when Anthropic refuses the request", async () => {
    withProxyEnv();
    const fetchMock = creditFetch({
      upstream: new Response("{}", { status: 529, headers: { "content-type": "application/json" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await handler(
      proxyReq({ model: "claude-sonnet-5", max_tokens: 100, messages: [{ role: "user", content: "hi" }] }, signPass({ j: "crefund", v: 2, c: 5_000_000_000 })),
    );
    expect(res.status).toBe(529);
    const reserved = reservedFrom(fetchMock);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith(`/decrby/credit:crefund/${reserved}`))).toBe(true);
  });

  it("settles a credit pass at the reported usage", async () => {
    withProxyEnv();
    const fetchMock = creditFetch({
      upstream: new Response(
        JSON.stringify({ usage: { input_tokens: 4, output_tokens: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    });
    vi.stubGlobal("fetch", fetchMock);
    await handler(
      proxyReq({ model: "claude-sonnet-5", max_tokens: 100, messages: [{ role: "user", content: "hi" }] }, signPass({ j: "settle1", v: 2, c: 5_000_000_000 })),
    );
    const reserved = reservedFrom(fetchMock);
    const actual = 4 * 2000 + 1 * 10000;
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith(`/decrby/credit:settle1/${reserved - actual}`))).toBe(true);
  });

  it("returns 402 when the credit reserve exceeds the included budget", async () => {
    withProxyEnv();
    const fetchMock = creditFetch({ incrByResult: 9_000_000_000 });
    vi.stubGlobal("fetch", fetchMock);
    const res = await handler(
      proxyReq({ model: "claude-opus-5", max_tokens: 100, messages: [{ role: "user", content: "hi" }] }, signPass({ j: "poor01", v: 2, c: 1000 })),
    );
    expect(res.status).toBe(402);
    expect(fetchMock.mock.calls.some((call) => String(call[0]) === "https://api.anthropic.com/v1/messages")).toBe(false);
  });

  it("rejects a revoked pass", async () => {
    withProxyEnv();
    vi.stubGlobal("fetch", creditFetch({ denied: true }));
    const res = await handler(proxyReq({ model: "claude-sonnet-5", max_tokens: 100 }, signPass({ j: "denied1", v: 2, c: 5_000_000_000 })));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "This pass has been revoked." });
  });

  it("lets a pass counter expire a month after the pass", async () => {
    withProxyEnv();
    const fetchMock = mockFetch({ incrResult: 1 });
    vi.stubGlobal("fetch", fetchMock);
    const e = Math.floor(Date.now() / 1000) + 3600;
    await handler(proxyReq({ model: "claude-opus-5", max_tokens: 100 }, signPass({ j: "ttl01", e })));
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(`${UPSTASH}/expireat/pass:ttl01/${e + 30 * 86400}`);
  });

  it("reserves provider-counted multilingual/image input at the highest cache-write rate", async () => {
    withProxyEnv();
    const fetchMock = creditFetch({ inputTokens: 50_000 });
    vi.stubGlobal("fetch", fetchMock);
    const response = await handler(proxyReq({ model: "claude-sonnet-5", max_tokens: 100,
      messages: [{ role: "user", content: [{ type: "text", text: "漢".repeat(1000), cache_control: { type: "ephemeral", ttl: "1h" } }] }],
    }, signPass({ j: "counted", v: 2, c: 5_000_000_000 })));
    expect(response.status).toBe(200);
    expect(reservedFrom(fetchMock)).toBe((55_000 + 1024) * 4000 + 100 * 10000);
    const count = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/count_tokens"));
    expect(count?.[1]).toMatchObject({ method: "POST", redirect: "error" });
  });

  it("retains the reservation when a stream is canceled after partial usage", async () => {
    withProxyEnv();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":1}}}\n\n'));
      },
    });
    const fetchMock = creditFetch({ upstream: new Response(stream, { headers: { "content-type": "text/event-stream" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await handler(proxyReq({ model: "claude-sonnet-5", max_tokens: 100, stream: true }, signPass({ j: "cancel", v: 2, c: 5_000_000_000 })));
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/decrby/"))).toBe(false);
  });

  it("settles only a complete SSE message, including chunked final events", async () => {
    withProxyEnv();
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      for (const chunk of ['data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":1}}}\n\n',
        'data: {"type":"message_delta","usage":{"output_tokens":20}}\n\ndata: {"type":"message_', 'stop"}\n\n']) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    } });
    const fetchMock = creditFetch({ upstream: new Response(stream, { headers: { "content-type": "text/event-stream" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await handler(proxyReq({ model: "claude-sonnet-5", max_tokens: 100, stream: true }, signPass({ j: "complete", v: 2, c: 5_000_000_000 })));
    await response.text();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/decrby/credit:complete/${reservedFrom(fetchMock) - 220000}`))).toBe(true);
  });

  it("does not spend when revocation Redis returns an error envelope", async () => {
    withProxyEnv();
    const base = mockFetch();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
      String(input).includes("/get/passdeny:") ? new Response(JSON.stringify({ error: "WRONGTYPE" })) : base(input, init));
    vi.stubGlobal("fetch", fetchMock);
    expect((await handler(proxyReq({ model: "claude-sonnet-5" }, signPass({ j: "rediserror" })))).status).toBe(503);
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("https://api.anthropic.com"))).toBe(false);
  });

  it("never infers when the input count is unavailable", async () => {
    withProxyEnv();
    const base = creditFetch();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
      String(input).endsWith("/count_tokens") ? new Response('{"error":"unavailable"}', { status: 503 }) : base(input, init));
    vi.stubGlobal("fetch", fetchMock);
    expect((await handler(proxyReq({ model: "claude-sonnet-5" }, signPass({ j: "nocount", v: 2, c: 5_000_000_000 })))).status).toBe(503);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "https://api.anthropic.com/v1/messages")).toBe(false);
  });

  it("keeps the reservation when a response omits final output usage", async () => {
    withProxyEnv();
    const fetchMock = creditFetch({ upstream: new Response('{"usage":{"input_tokens":10}}', { headers: { "content-type": "application/json" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await handler(proxyReq({ model: "claude-sonnet-5" }, signPass({ j: "partial", v: 2, c: 5_000_000_000 })));
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/decrby/"))).toBe(false);
  });

  it("strips wrapping quotes and trailing newlines from server env vars", async () => {
    withProxyEnv();
    process.env.PASS_SIGNING_SECRET = `"${SECRET}"\r\n`;
    process.env.ANTHROPIC_HOSTED_KEY = '  "sk-ant-hosted-secret"\r\n';
    process.env.UPSTASH_REDIS_REST_URL = `${UPSTASH}/\n`;
    process.env.UPSTASH_REDIS_REST_TOKEN = ' "upstash-token"\n';
    const fetchMock = creditFetch();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handler(proxyReq({ model: "claude-sonnet-5-5" }, `  ${signPass({ j: "trimmed", v: 2, c: 5_000_000_000 })}\n`));
    expect(response.status).toBe(200);
    const msgCall = fetchMock.mock.calls.find(([url]) => String(url) === "https://api.anthropic.com/v1/messages");
    expect((msgCall?.[1]?.headers as Record<string, string>)?.["x-api-key"]).toBe("sk-ant-hosted-secret");
  });

  it("returns 502 instead of a Redis 503 when count_tokens fails to connect", async () => {
    withProxyEnv();
    const base = creditFetch();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/count_tokens")) throw new TypeError("Invalid header value");
      return base(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await handler(proxyReq({ model: "claude-sonnet-5-5" }, signPass({ j: "neterr", v: 2, c: 5_000_000_000 })));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: "Claude could not be reached. This request was not counted against your pass.",
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/incrby/credit:"))).toBe(false);
  });

  it("returns 503 instead of blaming the buyer pass when Anthropic rejects the server key", async () => {
    withProxyEnv();
    const base = creditFetch({
      upstream: new Response('{"error":{"type":"authentication_error"}}', { status: 401, headers: { "content-type": "application/json" } }),
    });
    vi.stubGlobal("fetch", base);
    const response = await handler(proxyReq({ model: "claude-sonnet-5-5" }, signPass({ j: "srvkey", v: 2, c: 5_000_000_000 })));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "Hosted models are temporarily unavailable. This request was not counted against your pass.",
    });
    const reserved = reservedFrom(base);
    expect(base.mock.calls.some(([url]) => String(url).endsWith(`/decrby/credit:srvkey/${reserved}`))).toBe(true);
  });
});
