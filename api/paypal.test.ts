import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function stubPaymentFetch(provider: typeof fetch, storage?: (command: unknown[]) => Response): void {
  const values = new Map<string, string>();
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://redis.example/")) return Response.json({ result: 2 });
    if (url === "https://redis.example") {
      const command = JSON.parse(String(init?.body)) as unknown[];
      if (storage) return storage(command);
      const key = String(command[1]);
      if (command[0] === "GET") return Response.json({ result: values.get(key) ?? null });
      if (command[0] === "SET") {
        if (command.includes("NX") && values.has(key)) return Response.json({ result: null });
        values.set(key, String(command[2]));
        return Response.json({ result: "OK" });
      }
      throw new Error("Unexpected Redis command");
    }
    return provider(input, init);
  });
}

beforeEach(() => {
  process.env.PASS_SIGNING_SECRET = SECRET;
  process.env.PAYPAL_CLIENT_ID = "client-id";
  process.env.PAYPAL_CLIENT_SECRET = "secret";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "redis-token";
});

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
    process.env.PAYPAL_CLIENT_ID = "client-id";
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
    stubPaymentFetch(fetchMock);

    const res = await call(paypalReq("create-order", { planId: "scholar" }));
    expect(res.status).toBe(200);
    expect((res.json() as { orderId?: string }).orderId).toBe("ORDER123");
    expect(fetchMock).toHaveBeenCalledTimes(2); // OAuth + create order
  });

  it("create-order: a network's AI usage does not count against checkout", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(1798300000000));
    try {
      // The hourly key api/anthropic.ts increments, after a full hour of AI calls.
      const bucket = Math.floor(Date.now() / 3600_000);
      const aiKey = `ipthrottle:${createHmac("sha256", SECRET).update(`unknown:${bucket}`).digest("hex").slice(0, 24)}`;
      const counts = new Map([[aiKey, 240]]);
      vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
        const u = String(input instanceof Request ? input.url : input);
        const incr = u.match(/^https:\/\/redis\.example\/incr\/(.+)$/);
        if (incr) {
          const n = (counts.get(incr[1]) ?? 0) + 1;
          counts.set(incr[1], n);
          return Response.json({ result: n });
        }
        if (u.startsWith("https://redis.example/")) return Response.json({ result: 1 });
        if (u.includes("/oauth2/token")) return Response.json({ access_token: "paypal-token" });
        if (u.includes("/v2/checkout/orders")) return Response.json({ id: "ORDER123" }, { status: 201 });
        return Response.json({});
      }));

      expect((await call(paypalReq("create-order", { planId: "scholar" }))).status).toBe(200);
      expect(counts.get(aiKey)).toBe(240);
    } finally {
      vi.useRealTimers();
    }
  });

  it("capture-order: issues deterministic pass for same order", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1798300000000));
    try {
      process.env.PASS_SIGNING_SECRET = SECRET;
      process.env.PAYPAL_CLIENT_SECRET = "secret";
      process.env.PAYPAL_CLIENT_ID = "client-id";
      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const u = String(input instanceof Request ? input.url : input);
        if (u.includes("/oauth2/token")) {
          return new Response(JSON.stringify({ access_token: "paypal-token" }), { status: 200 });
        }
        if (u.includes("/v2/checkout/orders/ORDER123")) {
          return new Response(
            JSON.stringify({
              status: "COMPLETED",
              purchase_units: [{ description: "Comtus Scholar Pass — hosted model usage", amount: { value: "6.99", currency_code: "USD" }, payments: { captures: [{ status: "COMPLETED", amount: { value: "6.99", currency_code: "USD" }, create_time: "2026-06-01T10:00:00Z" }] } }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 200 });
      });
      stubPaymentFetch(fetchMock);

      const res1 = await call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }));
      expect(res1.status).toBe(200);
      const d1 = res1.json() as { passToken?: string };
      expect(d1.passToken).toBeTruthy();

      vi.setSystemTime(new Date(1798300000000 + 2 * 86400_000));
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
            purchase_units: [{ description: "Comtus Scholar Pass — hosted model usage", amount: { value: "6.99", currency_code: "USD" }, payments: { captures: [{ status: "COMPLETED", amount: { value: "6.99", currency_code: "USD" }, create_time: "2026-06-01T10:00:00Z" }] } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200 });
    });
    stubPaymentFetch(fetchMock);

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
    stubPaymentFetch(
      vi.fn(async (input: string | URL | Request) => {
        const u = String(input instanceof Request ? input.url : input);
        if (u.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
        return new Response(
          JSON.stringify({
            status: "COMPLETED",
            purchase_units: [
              {
                description: "Comtus Scholar Pass — hosted model usage",
                amount: { value: "6.99", currency_code: "USD" },
                payments: { captures: [{ status: "COMPLETED", amount: { value: "6.99", currency_code: "USD" }, create_time: capturedAt }] },
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

  it.each([200, 201])("captures with an idempotency key tied to the order (HTTP %s)", async (captureStatus) => {
    process.env.PASS_SIGNING_SECRET = SECRET;
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    let captured = false;
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      void _init;
      const u = String(input instanceof Request ? input.url : input);
      if (u.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
      if (u.endsWith("/capture")) {
        captured = true;
        return new Response("{}", { status: captureStatus });
      }
      return new Response(
        JSON.stringify({
          status: captured ? "COMPLETED" : "APPROVED",
          purchase_units: [{ description: "Comtus Sprint Pass — hosted model usage", amount: { value: "2.99", currency_code: "USD" }, payments: { captures: [{ status: "COMPLETED", amount: { value: "2.99", currency_code: "USD" }, create_time: "2026-06-01T10:00:00Z" }] } }],
        }),
        { status: 200 },
      );
    });
    stubPaymentFetch(fetchMock);

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
    stubPaymentFetch(
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const u = String(input instanceof Request ? input.url : input);
        if (u.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
        if (u.includes("verify-webhook-signature")) {
          return new Response(JSON.stringify({ verification_status: "SUCCESS" }), { status: 200 });
        }
        void init;
        return new Response("{}", { status: 200 });
      }),
      (command) => {
        commands.push(command);
        return Response.json({ result: "OK" });
      },
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
    stubPaymentFetch(
      vi.fn(async (input: string | URL | Request) => {
        const u = String(input instanceof Request ? input.url : input);
        if (u.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
        if (u.includes("/v2/checkout/orders/ORDER123")) {
          return new Response(
            JSON.stringify({
              status: "COMPLETED",
              purchase_units: [
                {
                  description: "Comtus Scholar Pass — hosted model usage",
                  amount: { value: "6.99", currency_code: "USD" },
                  payments: { captures: [{ status: "COMPLETED", amount: { value: "6.99", currency_code: "USD" }, create_time: "2026-06-01T10:00:00Z" }] },
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

function completedOrder() {
  return {
    status: "COMPLETED",
    purchase_units: [{
      custom_id: "comtus:scholar",
      amount: { value: "6.99", currency_code: "USD" },
      payments: { captures: [{
        status: "COMPLETED",
        amount: { value: "6.99", currency_code: "USD" },
        create_time: "2026-06-01T10:00:00Z",
      }] },
    }],
  };
}

function providerForOrder(order: unknown): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/oauth2/token")) return Response.json({ access_token: "t" });
    return Response.json(order);
  });
}

const webhookHeaders = {
  "paypal-transmission-id": "id",
  "paypal-transmission-time": "time",
  "paypal-transmission-sig": "sig",
  "paypal-cert-url": "https://certs.example/cert",
  "paypal-auth-algo": "SHA256withRSA",
};

describe("PayPal fulfillment safeguards", () => {
  it.each([null, [], "null", 42])("rejects non-object bodies: %j", async (body) => {
    const fetchMock = vi.fn();
    stubPaymentFetch(fetchMock);
    expect((await call(paypalReq("capture-order", body))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["toString", "constructor", "__proto__", ["scholar"]])("rejects invalid plan ids: %j", async (planId) => {
    const fetchMock = vi.fn();
    stubPaymentFetch(fetchMock);
    expect((await call(paypalReq("create-order", { planId }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not start checkout when the rate limit cannot be checked", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/incr/ipthrottle:")) return new Response(JSON.stringify({ error: "down" }), { status: 500 });
      return new Response(JSON.stringify({ id: "ORDER123" }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await call(paypalReq("create-order", { planId: "scholar" }));
    expect(response.status).toBe(503);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/v2/checkout/orders"))).toBe(false);
  });

  it("revokes every capture named in a dispute, not only the related order", async () => {
    process.env.PAYPAL_WEBHOOK_ID = "WH-1";
    const commands: unknown[][] = [];
    stubPaymentFetch(vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/oauth2/token")) return Response.json({ access_token: "t" });
      if (url.includes("/v2/payments/captures/CAPTURE999")) {
        return Response.json({ supplementary_data: { related_ids: { order_id: "ORDER999" } } });
      }
      return Response.json({ verification_status: "SUCCESS" });
    }), (command) => {
      commands.push(command);
      return Response.json({ result: "OK" });
    });
    const response = await call({
      ...paypalReq("webhook", {
        event_type: "CUSTOMER.DISPUTE.CREATED",
        resource: {
          supplementary_data: { related_ids: { order_id: "ORDER123" } },
          disputed_transactions: [{ seller_transaction_id: "CAPTURE999" }],
        },
      }),
      headers: webhookHeaders,
    });
    expect(response.status).toBe(200);
    const denied = commands.filter((command) => command[0] === "SET").map((command) => command[1]);
    const jti = (orderId: string) => `passdeny:${createHmac("sha256", SECRET).update(`jti:${orderId}`).digest("hex").slice(0, 12)}`;
    expect(denied).toEqual(expect.arrayContaining([jti("ORDER123"), jti("ORDER999")]));
  });

  it.each(["PAYPAL_CLIENT_ID", "PASS_SIGNING_SECRET", "UPSTASH_REDIS_REST_TOKEN"])('does not create a chargeable order without %s', async (key) => {
    delete process.env[key];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await call(paypalReq("create-order", { planId: "scholar" }))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["capture-order", "recover", "webhook"])("returns 503 on %s without PAYPAL_CLIENT_ID", async (route) => {
    process.env.PAYPAL_WEBHOOK_ID = "WH-1";
    delete process.env.PAYPAL_CLIENT_ID;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await call(paypalReq(route, { orderId: "ORDER123", planId: "scholar" }))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["GET", "PUT", "DELETE"])("rejects %s requests before side effects", async (method) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await call({ ...paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }), method });
    expect(result.status).toBe(405);
    expect(result.headers.allow).toBe("POST, OPTIONS");
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  const invalidPayments: Array<[string, (order: ReturnType<typeof completedOrder>) => void]> = [
    ["missing captures", (order) => { order.purchase_units[0].payments.captures = []; }],
    ["missing status", (order) => { order.purchase_units[0].payments.captures[0].status = ""; }],
    ["pending capture", (order) => { order.purchase_units[0].payments.captures[0].status = "PENDING"; }],
    ["refunded capture", (order) => { order.purchase_units[0].payments.captures[0].status = "REFUNDED"; }],
    ["underpaid capture", (order) => { order.purchase_units[0].payments.captures[0].amount.value = "0.01"; }],
    ["wrong capture currency", (order) => { order.purchase_units[0].payments.captures[0].amount.currency_code = "EUR"; }],
    ["missing timestamp", (order) => { order.purchase_units[0].payments.captures[0].create_time = ""; }],
    ["invalid timestamp", (order) => { order.purchase_units[0].payments.captures[0].create_time = "invalid"; }],
    ["future timestamp", (order) => { order.purchase_units[0].payments.captures[0].create_time = "2099-01-01T00:00:00Z"; }],
    ["multiple captures", (order) => { order.purchase_units[0].payments.captures.push(order.purchase_units[0].payments.captures[0]); }],
    ["multiple purchase units", (order) => { order.purchase_units.push(order.purchase_units[0]); }],
    ["different product", (order) => { order.purchase_units[0].custom_id = "other-product"; }],
  ];

  it.each(invalidPayments)("never fulfills %s via capture or recovery", async (_name, change) => {
    const order = completedOrder();
    change(order);
    stubPaymentFetch(providerForOrder(order));
    for (const route of ["capture-order", "recover"]) {
      const response = await call(paypalReq(route, { orderId: "ORDER123", planId: "scholar" }));
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.json()).not.toHaveProperty("passToken");
    }
  });

  it("rechecks the final order amount after capturing", async () => {
    const approved = completedOrder();
    approved.status = "APPROVED";
    const changed = completedOrder();
    changed.purchase_units[0].amount.value = "0.01";
    let captured = false;
    stubPaymentFetch(vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/oauth2/token")) return Response.json({ access_token: "t" });
      if (url.endsWith("/capture")) {
        captured = true;
        return Response.json({}, { status: 201 });
      }
      return Response.json(captured ? changed : approved);
    }));
    const response = await call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }));
    expect(response.status).toBe(409);
    expect(response.json()).not.toHaveProperty("passToken");
  });

  it("rejects unbound legacy orders even when the captured amount matches", async () => {
    const order = completedOrder();
    const legacy = { ...order, purchase_units: order.purchase_units.map(({ custom_id: _customId, ...unit }) => {
      void _customId;
      return unit;
    }) };
    stubPaymentFetch(providerForOrder(legacy));
    const response = await call(paypalReq("recover", { orderId: "ORDER123" }));
    expect(response.status).toBe(409);
    expect(response.json()).not.toHaveProperty("passToken");
  });

  it.each(["capture-order", "recover"])("cannot recover a revoked pass through %s", async (route) => {
    stubPaymentFetch(providerForOrder(completedOrder()), (command) => Response.json({
      result: String(command[1]).startsWith("passdeny:") ? "1" : null,
    }));
    const response = await call(paypalReq(route, { orderId: "ORDER123", planId: "scholar" }));
    expect(response.status).toBe(401);
    expect(response.json()).not.toHaveProperty("passToken");
  });

  it.each([
    ["HTTP failure", () => Response.json({ result: null }, { status: 503 })],
    ["Redis error", () => Response.json({ error: "storage unavailable" })],
    ["invalid response", () => Response.json({})],
  ] satisfies Array<[string, () => Response]>)("fails closed before capture when storage has %s", async (_name, storage) => {
    const provider = providerForOrder(completedOrder());
    stubPaymentFetch(provider, storage);
    const response = await call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }));
    expect(response.status).toBe(502);
    expect(provider).not.toHaveBeenCalled();
  });

  it("does not return an unpersisted pass", async () => {
    stubPaymentFetch(providerForOrder(completedOrder()), (command) => command[0] === "SET"
      ? Response.json({ error: "storage unavailable" }) : Response.json({ result: null }));
    const response = await call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }));
    expect(response.status).toBe(502);
    expect(response.json()).not.toHaveProperty("passToken");
  });

  it("fulfills concurrent retries with the same persisted pass", async () => {
    stubPaymentFetch(providerForOrder(completedOrder()));
    const responses = await Promise.all(Array.from({ length: 4 }, () =>
      call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }))));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    expect(new Set(responses.map((response) => (response.json() as { passToken: string }).passToken)).size).toBe(1);
    expect(responses[0].headers["cache-control"]).toBe("no-store");
  });

  it.each(["missing order", "failed revocation"])("asks PayPal to retry a verified webhook with %s", async (failure) => {
    process.env.PAYPAL_WEBHOOK_ID = "WH-1";
    stubPaymentFetch(vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/oauth2/token")) return Response.json({ access_token: "t" });
      return Response.json({ verification_status: "SUCCESS" });
    }), () => Response.json({ error: "storage unavailable" }));
    const response = await call({
      ...paypalReq("webhook", {
        event_type: "PAYMENT.CAPTURE.REFUNDED",
        resource: failure === "missing order" ? {} : { supplementary_data: { related_ids: { order_id: "ORDER123" } } },
      }),
      headers: webhookHeaders,
    });
    expect(response.status).toBe(500);
  });

  it("resolves a refund capture reference before revoking its pass", async () => {
    process.env.PAYPAL_WEBHOOK_ID = "WH-1";
    const commands: unknown[][] = [];
    stubPaymentFetch(vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/oauth2/token")) return Response.json({ access_token: "t" });
      if (url.includes("/v2/payments/captures/CAPTURE123")) return Response.json({ supplementary_data: { related_ids: { order_id: "ORDER123" } } });
      return Response.json({ verification_status: "SUCCESS" });
    }), (command) => {
      commands.push(command);
      return Response.json({ result: "OK" });
    });
    const response = await call({
      ...paypalReq("webhook", { event_type: "PAYMENT.CAPTURE.REFUNDED", resource: { supplementary_data: { related_ids: { capture_id: "CAPTURE123" } } } }),
      headers: webhookHeaders,
    });
    expect(response.status).toBe(200);
    expect(commands).toContainEqual(["SET", `passdeny:${createHmac("sha256", SECRET).update("jti:ORDER123").digest("hex").slice(0, 12)}`, "1", "EX", 400 * 86400]);
  });
});
