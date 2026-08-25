import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./paypal";

const SECRET = "test-signing-secret";

const ENV_KEYS = ["PASS_SIGNING_SECRET", "PAYPAL_CLIENT_SECRET", "PAYPAL_CLIENT_ID"];

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

async function call(spec: ReqInit): Promise<{ status: number; json: () => any; headers: Record<string, string> }> {
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
    expect(res.json().orderId).toBe("ORDER123");
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

    const res1 = await call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }));
    expect(res1.status).toBe(200);
    const d1 = res1.json() as { passToken?: string };
    expect(d1.passToken).toBeTruthy();

    const res2 = await call(paypalReq("capture-order", { orderId: "ORDER123", planId: "scholar" }));
    const d2 = res2.json();
    expect(d2.passToken).toBe(d1.passToken);
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
});
