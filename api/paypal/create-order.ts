/**
 * Server-side PayPal order creation (Vercel Edge Function).
 *
 * The browser never decides prices: it sends a plan id, the server looks
 * up the canonical amount from SERVER_PLANS and asks PayPal to create the
 * order. Complements capture-order.ts, which verifies + captures server-side
 * and issues the access pass automatically.
 *
 * Env:
 *   PAYPAL_CLIENT_ID       defaults to the public web SDK id
 *   PAYPAL_CLIENT_SECRET   required — order creation fails closed without it
 *   PAYPAL_API_BASE        optional; default https://api-m.paypal.com (live)
 */

import { json } from "../_http";
import { SERVER_PLANS } from "../_pass";

export const config = { runtime: "nodejs" };

const PAYPAL_BASE = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";

async function oauthToken(id: string, secret: string): Promise<string> {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal auth returned no token");
  return data.access_token;
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return json(204, {}, origin);
  if (req.method !== "POST") return json(405, { error: "POST only" }, origin);

  const clientId = process.env.PAYPAL_CLIENT_ID ||
    "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientSecret) {
    return json(
      503,
      { error: "Checkout is temporarily unavailable. Please try again later." },
      origin,
    );
  }

  let body: { planId?: string };
  try {
    body = (await req.json()) as { planId?: string };
  } catch {
    return json(400, { error: "Invalid JSON body." }, origin);
  }

  // Prices come from the server table only — never from the request.
  const plan = body.planId ? SERVER_PLANS[body.planId] : undefined;
  if (!plan) return json(400, { error: "Unknown plan." }, origin);

  try {
    const token = await oauthToken(clientId, clientSecret);
    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "paypal-request-id": `comtus-${plan.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: `Comtus ${plan.name} — ${plan.requests} hosted requests`,
            amount: { currency_code: plan.currency, value: plan.price },
          },
        ],
        application_context: {
          brand_name: "Comtus",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
        },
      }),
    });
    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok || !data.id) {
      console.error("PayPal create-order failed:", res.status, data.message);
      return json(502, { error: "Could not start checkout. Please try again." }, origin);
    }
    return json(200, { orderId: data.id }, origin);
  } catch (e) {
    console.error("create-order error:", e instanceof Error ? e.message : e);
    return json(502, { error: "Could not start checkout. Please try again." }, origin);
  }
}
