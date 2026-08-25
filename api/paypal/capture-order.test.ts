import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

beforeEach(() => {
  process.env.PASS_SIGNING_SECRET = "test-signing-secret";
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

async function loadCapture() {
  const mod = await import("./capture-order");
  return mod.default as (req: Request) => Promise<Response>;
}

function post(body: unknown): Request {
  return new Request("http://localhost:3000/api/paypal/capture-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("capture-order guard rails", () => {
  it("fails closed without PASS_SIGNING_SECRET or PAYPAL_CLIENT_SECRET", async () => {
    delete process.env.PASS_SIGNING_SECRET;
    const handler = await loadCapture();
    const res = await handler(post({ orderId: "8XA123456B7890123", planId: "scholar" }));
    expect(res.status).toBe(503);
  });

  it("fails closed without PAYPAL_CLIENT_SECRET", async () => {
    const handler = await loadCapture();
    const res = await handler(post({ orderId: "8XA123456B7890123", planId: "scholar" }));
    expect(res.status).toBe(503);
  });

  it("rejects unknown plans and malformed order ids", async () => {
    const handler = await loadCapture();
    process.env.PAYPAL_CLIENT_SECRET = "secret";

    const resBadPlan = await handler(post({ orderId: "8XA123456B7890123", planId: "lifetime" }));
    expect(resBadPlan.status).toBe(400);

    const resBadOrder = await handler(post({ orderId: "../etc/passwd", planId: "scholar" }));
    expect(resBadOrder.status).toBe(400);

    const resMissing = await handler(post({ planId: "scholar" }));
    expect(resMissing.status).toBe(400);
  });
});

describe("pass issuance is deterministic per order", () => {
  it("re-deriving a pass for the same order yields the identical token", async () => {
    const { issuePassForOrder, SERVER_PLANS } = await import("../_pass");
    const t1 = await issuePassForOrder(SERVER_PLANS.scholar, "ORDER123");
    const t2 = await issuePassForOrder(SERVER_PLANS.scholar, "ORDER123");
    expect(t1).toBe(t2);
    expect(t1.startsWith("comtus-pass-v1.")).toBe(true);

    const t3 = await issuePassForOrder(SERVER_PLANS.mastery, "ORDER124");
    expect(t3).not.toBe(t1);

    // payload carries the server-owned quota
    const payloadB64 = t1.slice("comtus-pass-v1.".length, t1.lastIndexOf("."));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(payload.q).toBe(200);
    expect(payload.n).toBe("Scholar Pass");

    // signature verifies with the shared secret
    const expected = createHmac("sha256", "test-signing-secret").update(payloadB64).digest("hex");
    expect(t1.slice(t1.lastIndexOf(".") + 1)).toBe(expected);
  });
});
