import { createHmac } from "node:crypto";
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

function creditFetch(opts: { incrByResult?: number; upstream?: Response; denied?: boolean } = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
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
    if (url.includes("/incr/")) {
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
    const upstreamCall = fetchMock.mock.calls.find((call) => String(call[0]).startsWith("https://api.anthropic.com"));
    const forwarded = JSON.parse((upstreamCall?.[1] as RequestInit).body as string);
    expect(forwarded.tools).toBeUndefined();
    expect(forwarded.max_tokens).toBe(16000);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/decrby/credit:credit01/"))).toBe(true);
  });

  it("rejects a credit pass whose notebook exceeds the input cap", async () => {
    withProxyEnv();
    vi.stubGlobal("fetch", creditFetch());
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
    expect(fetchMock.mock.calls.some((call) => String(call[0]).startsWith("https://api.anthropic.com"))).toBe(false);
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
});
