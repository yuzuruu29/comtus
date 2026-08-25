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

function proxyReq(body: object, pass?: string): Request {
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

function mockFetch(opts: { incrResult?: number; upstream?: Response } = {}) {
  return vi.fn(async (input: string | URL | Request) => {
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

    const upstreamCall = fetchMock.mock.calls.find(([, init]) =>
      Boolean(init && typeof init === "object" && "body" in init),
    );
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
});

describe("PayPal sub-routes", () => {
  it("create-order: rejects missing secret and unknown plans", async () => {
    delete process.env.PAYPAL_CLIENT_SECRET;
    const res = await handler(
      new Request("http://localhost:3000/api/anthropic/paypal/create-order", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://www.comtus-ai.xyz" },
        body: JSON.stringify({ planId: "schlor" }),
      }),
    );
    expect(res.status).toBe(503);
  });

  it("create-order: returns orderId from PayPal for valid plan", async () => {
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    process.env.PAYPAL_CLIENT_ID = "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const u = String(input instanceof Request ? input.url : input);
      if (u.includes("/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "paypal-token" }), { status: 200 });
      }
      if (u.includes("/v2/checkout/orders")) {
        return new Response(JSON.stringify({ id: "ORDER123" }), { status: 201, headers: { "content-type": "application/json" } });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await handler(
      new Request("http://localhost:3000/api/anthropic/paypal/create-order", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://www.comtus-ai.xyz" },
        body: JSON.stringify({ planId: "scholar" }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { orderId?: string };
    expect(data.orderId).toBe("ORDER123");
    expect(fetchMock).toHaveBeenCalledTimes(2); // OAuth + create order
  });

  it("capture-order: issues deterministic pass for same order", async () => {
    process.env.PASS_SIGNING_SECRET = SECRET;
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    process.env.PAYPAL_CLIENT_ID = "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const u = String(input instanceof Request ? input.url : input);
      if (u.includes("/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "paypal-token" }), { status: 200 });
      }
      if (u.includes("/v2/checkout/orders/ORDER123")) {
        return new Response(
          JSON.stringify({
            status: "COMPLETED",
            purchase_units: [{ amount: { value: "6.99", currency_code: "USD" }, payments: { captures: [{ status: "COMPLETED" }] } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res1 = await handler(
      new Request("http://localhost:3000/api/anthropic/paypal/capture-order", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://www.comtus-ai.xyz" },
        body: JSON.stringify({ orderId: "ORDER123", planId: "scholar" }),
      }),
    );
    expect(res1.status).toBe(200);
    const d1 = (await res1.json()) as { passToken?: string };
    expect(d1.passToken).toBeTruthy();

    const res2 = await handler(
      new Request("http://localhost:3000/api/anthropic/paypal/capture-order", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://www.comtus-ai.xyz" },
        body: JSON.stringify({ orderId: "ORDER123", planId: "scholar" }),
      }),
    );
    const d2 = await res2.json();
    expect(d2.passToken).toBe(d1.passToken);
  });
});
