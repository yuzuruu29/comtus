import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import handler from "./paypal";

// Opt in only with sandbox PayPal credentials and a deliberately selected test Redis.
describe.skipIf(process.env.COMTUS_SANDBOX_CHECK !== "1")("PayPal sandbox checkout", () => {
  it("creates an order through the application at the server-owned regular price", async () => {
    expect(process.env.PAYPAL_API_BASE).toBe("https://api-m.sandbox.paypal.com");
    const client = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;
    expect(client && secret && process.env.PASS_SIGNING_SECRET && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN).toBeTruthy();
    const req = {
      method: "POST", url: "/api/paypal?p=paypal/create-order",
      headers: { "content-type": "application/json", origin: "http://localhost:5199" },
      body: { planId: "sprint" },
    } as unknown as IncomingMessage;
    let body = "";
    const res = { statusCode: 0, setHeader() {}, end(value?: string) { body = value ?? ""; } };
    await handler(req, res as unknown as ServerResponse);
    expect(res.statusCode).toBe(200);
    const { orderId } = JSON.parse(body) as { orderId: string };
    expect(orderId).toMatch(/^[A-Z0-9]+$/i);
    const auth = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${client}:${secret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    expect(auth.ok).toBe(true);
    const { access_token: token } = await auth.json() as { access_token: string };
    const response = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}`, { headers: { authorization: `Bearer ${token}` } });
    expect(response.ok).toBe(true);
    const order = await response.json() as { status: string; purchase_units: Array<{ custom_id: string; amount: { value: string; currency_code: string } }> };
    expect(order.status).toBe("CREATED");
    expect(order.purchase_units).toMatchObject([{ custom_id: "comtus:sprint", amount: { value: "8.33", currency_code: "USD" } }]);
  }, 30_000);

  it.skipIf(!process.env.COMTUS_SANDBOX_APPROVED_ORDER)("applies the first-purchase offer, captures, and restores an approved sandbox order", async () => {
    expect(process.env.PAYPAL_API_BASE).toBe("https://api-m.sandbox.paypal.com");
    expect(process.env.UPSTASH_REDIS_REST_URL).toBe("https://sandbox-redis.invalid");
    const orderId = process.env.COMTUS_SANDBOX_APPROVED_ORDER!;
    const originalFetch = globalThis.fetch;
    const values = new Map<string, string>();
    const expiring = new Set<string>();
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.startsWith("https://sandbox-redis.invalid")) return originalFetch(input, init);
      if (url.startsWith("https://sandbox-redis.invalid/")) return Response.json({ result: 1 });
      const command = JSON.parse(String(init?.body)) as unknown[];
      const key = String(command[1]);
      if (command[0] === "GET") return Response.json({ result: values.get(key) ?? null });
      if (command[0] === "TTL") return Response.json({ result: values.has(key) ? (expiring.has(key) ? 10800 : -1) : -2 });
      if (command[0] === "SET") {
        if (command.includes("NX") && values.has(key)) return Response.json({ result: null });
        values.set(key, String(command[2]));
        if (command.includes("EX")) expiring.add(key); else expiring.delete(key);
        return Response.json({ result: "OK" });
      }
      if (command[0] === "EVAL") {
        const script = String(command[1]);
        const first = String(command[3]);
        if (command[2] === 2) {
          const marker = String(command[4]);
          if (values.has(first)) return Response.json({ result: 0 });
          values.set(first, String(command[5]));
          const prior = values.has(marker);
          values.set(marker, "1");
          return Response.json({ result: prior ? 2 : 1 });
        }
        if (values.get(first) !== String(command[4])) return Response.json({ result: 0 });
        if (script.includes("PERSIST")) { expiring.delete(first); return Response.json({ result: 1 }); }
        if (script.includes("DEL")) { values.delete(first); return Response.json({ result: 1 }); }
      }
      throw new Error("Unexpected isolated Redis command");
    });
    async function call(route: string, body: object) {
      const req = { method: "POST", url: `/api/paypal?p=paypal/${route}`, headers: { "content-type": "application/json", origin: "http://localhost:5199" }, body } as unknown as IncomingMessage;
      let text = "";
      const res = { statusCode: 0, setHeader() {}, end(value?: string) { text = value ?? ""; } };
      await handler(req, res as unknown as ServerResponse);
      return { status: res.statusCode, body: JSON.parse(text) as Record<string, unknown> };
    }
    try {
      const prepared = await call("prepare-order", { orderId, planId: "sprint" });
      expect(prepared.status).toBe(200);
      expect(prepared.body).toMatchObject({ price: "5.00", discounted: true });
      const captured = await call("capture-order", { orderId, planId: "sprint", reviewToken: prepared.body.reviewToken });
      expect(captured.status).toBe(200);
      expect(captured.body).toMatchObject({ budgetNano: 2_500_000_000, expiresDays: null });
      const recovered = await call("recover", { orderId });
      expect(recovered.status).toBe(200);
      expect(recovered.body.passToken).toBe(captured.body.passToken);
    } finally {
      vi.unstubAllGlobals();
    }
  }, 60_000);
});
