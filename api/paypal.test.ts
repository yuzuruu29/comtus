import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./paypal";

const SECRET = "test-signing-secret";

const ENV_KEYS = [
  "PASS_SIGNING_SECRET",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_WEBHOOK_ID",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  text: string | undefined;
  setHeader: (k: string, v: string) => void;
  end: (b?: string) => void;
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 0,
    headers: {},
    text: undefined,
    setHeader(k, v) {
      res.headers[k.toLowerCase()] = v;
    },
    end(b) {
      res.text = b;
    },
  };
  return res;
}

interface ReqInit {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

async function call(spec: ReqInit): Promise<{ status: number; json: () => unknown; headers: Record<string, string> }> {
  const req = {
    method: spec.method ?? "POST",
    url: spec.url,
    headers: { "content-type": "application/json", origin: "https://www.comtus-ai.xyz", ...spec.headers },
    body: spec.body,
  } as unknown as IncomingMessage;
  const res = makeRes();
  await handler(req, res as unknown as ServerResponse);
  return {
    status: res.statusCode,
    json: () => JSON.parse(res.text ?? "{}"),
    headers: res.headers,
  };
}

function paypalReq(path: string, body: unknown): ReqInit {
  return { url: `/api/paypal?p=paypal/${path}`, body };
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("PayPal checkout", () => {
  it("create-order: rejects missing secret and unknown plans", async () => {
    delete process.env.PAYPAL_CLIENT_SECRET;
    const res = await call(paypalReq("create-order", { planId: "schlor" }));
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

    const res = await call(paypalReq("create-order", { planId: "scholar" }));
    expect(res.status).toBe(200);
    expect((res.json() as { orderId?: string }).orderId).toBe("ORDER123");
    expect(fetchMock).toHaveBeenCalledTimes(2); // OAuth + create order
  });

  it("capture-order: issues deterministic pass for same order", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1798300000000));
    try {
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

      const res1 = await call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }));
      expect(res1.status).toBe(200);
      const d1 = res1.json() as { passToken?: string };
      expect(d1.passToken).toBeTruthy();

      const res2 = await call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }));
      const d2 = res2.json() as { passToken?: string };
      expect(d2.passToken).toBe(d1.passToken);
    } finally {
      vi.useRealTimers();
    }
  });

  it("mints passes verifiable with PASS_SIGNING_SECRET", async () => {
    process.env.PASS_SIGNING_SECRET = SECRET;
    process.env.PAYPAL_CLIENT_SECRET = "secret";
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

    const res = await call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }));
    const { passToken } = res.json() as { passToken: string };
    const rest = passToken.slice("comtus-pass-v1.".length);
    const dot = rest.lastIndexOf(".");
    const payloadB64 = rest.slice(0, dot);
    const expected = createHmac("sha256", SECRET).update(payloadB64).digest("hex");
    expect(rest.slice(dot + 1)).toBe(expected);
  });

  it("anchors pass expiry to the capture, so re-submitting an order can't extend it", async () => {
    process.env.PASS_SIGNING_SECRET = SECRET;
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    const capturedAt = "2026-06-01T10:00:00Z";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const u = String(input instanceof Request ? input.url : input);
        if (u.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
        return new Response(
          JSON.stringify({
            status: "COMPLETED",
            purchase_units: [
              {
                amount: { value: "6.99", currency_code: "USD" },
                payments: { captures: [{ status: "COMPLETED", create_time: capturedAt }] },
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    const res = await call(paypalReq("capture-order", { orderId: "OLDORDER1", planId: "scholar" }));
    const { passToken } = res.json() as { passToken: string };
    const payloadB64 = passToken.slice("comtus-pass-v1.".length, passToken.lastIndexOf("."));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as { e: number };
    expect(payload.e).toBe(Date.parse(capturedAt) / 1000 + 120 * 86400);
  });

  it("captures with an idempotency key tied to the order", async () => {
    process.env.PASS_SIGNING_SECRET = SECRET;
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    let captured = false;
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      void _init;
      const u = String(input instanceof Request ? input.url : input);
      if (u.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
      if (u.endsWith("/capture")) {
        captured = true;
        return new Response("{}", { status: 201 });
      }
      return new Response(
        JSON.stringify({
          status: captured ? "COMPLETED" : "APPROVED",
          purchase_units: [{ amount: { value: "2.99", currency_code: "USD" }, payments: { captures: [{ status: "COMPLETED" }] } }],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await call(paypalReq("capture-order", { orderId: "NEWORDER1", planId: "sprint" }));
    expect(res.status).toBe(200);
    const captureCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/capture"));
    const headers = (captureCall?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers["paypal-request-id"]).toBe("comtus-capture-NEWORDER1");
  });

  it("rejects a webhook with no signature", async () => {
    process.env.PAYPAL_WEBHOOK_ID = "WH-1";
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    const res = await call(paypalReq("webhook", { event_type: "PAYMENT.CAPTURE.REFUNDED" }));
    expect(res.status).toBe(401);
  });

  it("denies a pass when a verified refund names the order", async () => {
    process.env.PAYPAL_WEBHOOK_ID = "WH-1";
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    process.env.PASS_SIGNING_SECRET = SECRET;
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "redis-token";
    const commands: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const u = String(input instanceof Request ? input.url : input);
        if (u.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
        if (u.includes("verify-webhook-signature")) {
          return new Response(JSON.stringify({ verification_status: "SUCCESS" }), { status: 200 });
        }
        if (u === "https://redis.example") {
          commands.push(JSON.parse(String(init?.body)));
          return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      }),
    );
    const res = await call({
      url: "/api/paypal?p=paypal/webhook",
      headers: {
        "paypal-transmission-id": "id",
        "paypal-transmission-time": "time",
        "paypal-transmission-sig": "sig",
        "paypal-cert-url": "https://certs.example/cert",
        "paypal-auth-algo": "SHA256withRSA",
      },
      body: {
        id: "WH-EVENT",
        event_type: "PAYMENT.CAPTURE.REFUNDED",
        resource: { supplementary_data: { related_ids: { order_id: "ORDER123" } } },
      },
    });
    expect(res.status).toBe(200);
    const set = commands.find((cmd) => Array.isArray(cmd) && cmd[0] === "SET") as string[] | undefined;
    expect(set?.[1]).toMatch(/^passdeny:[0-9a-f]{12}$/);
    expect(set?.[2]).toBe("1");
  });

  it("restores a pass from a completed order id", async () => {
    process.env.PASS_SIGNING_SECRET = SECRET;
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const u = String(input instanceof Request ? input.url : input);
        if (u.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
        if (u.includes("/v2/checkout/orders/ORDER123")) {
          return new Response(
            JSON.stringify({
              status: "COMPLETED",
              purchase_units: [
                {
                  amount: { value: "6.99", currency_code: "USD" },
                  payments: { captures: [{ status: "COMPLETED", create_time: "2026-06-01T10:00:00Z" }] },
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ result: null }), { status: 200 });
      }),
    );
    const res = await call(paypalReq("recover", { orderId: "ORDER123" }));
    expect(res.status).toBe(200);
    const { passToken } = res.json() as { passToken: string };
    const payloadB64 = passToken.slice("comtus-pass-v1.".length, passToken.lastIndexOf("."));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as { v: number; c: number };
    expect(payload.v).toBe(2);
    expect(payload.c).toBe(3_495_000_000);
  });
});
