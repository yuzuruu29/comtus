/**
 * Server-side PayPal capture + automated pass issuance (Vercel Edge Function).
 *
 * Flow: the buyer approves in the PayPal popup → this endpoint re-verifies
 * the order against PayPal (status, amount, currency — all from PayPal's
 * API, never from the browser), captures it, and mints the HMAC pass
 * immediately. Fulfillment is instant and idempotent: the token is derived
 * deterministically from the order id, so replays return the same pass.
 *
 * Env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PASS_SIGNING_SECRET,
 *      UPSTASH_REDIS_REST_URL/TOKEN (optional ops record), PAYPAL_API_BASE.
 */

import { json, withinIpThrottle } from "../_http";
import { issuePassForOrder, SERVER_PLANS } from "../_pass";

export const config = { runtime: "nodejs" };

const PAYPAL_BASE = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";

interface PayPalOrder {
  id?: string;
  status?: string;
  purchase_units?: {
    amount?: { value?: string; currency_code?: string };
    payments?: {
      captures?: { id: string; status: string }[];
    };
  }[];
}

async function paypal(
  path: string,
  method: "GET" | "POST",
  token: string,
  body?: unknown,
): Promise<{ status: number; data: PayPalOrder & { message?: string; details?: { issue?: string }[] }}> {
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(method === "POST" ? { "paypal-request-id": `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  let data: PayPalOrder & { message?: string; details?: { issue?: string }[] } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

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

/** Ops visibility only — issuance correctness doesn't depend on Upstash. */
async function recordIssued(orderId: string, planId: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(`${url}/set/order:${orderId}/${planId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* best effort */
  }
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return json(204, {}, origin);
  if (req.method !== "POST") return json(405, { error: "POST only" }, origin);

  const clientId = process.env.PAYPAL_CLIENT_ID ||
    "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientSecret || !process.env.PASS_SIGNING_SECRET) {
    return json(503, { error: "Fulfillment is temporarily unavailable. Payment was not captured." }, origin);
  }

  if (!(await withinIpThrottle(req, process.env.PASS_SIGNING_SECRET, 60))) {
    return json(429, { error: "Too many requests. Try again later." }, origin);
  }

  let body: { orderId?: string; planId?: string };
  try {
    body = (await req.json()) as { orderId?: string; planId?: string };
  } catch {
    return json(400, { error: "Invalid JSON body." }, origin);
  }
  const { orderId } = body;
  const plan = body.planId ? SERVER_PLANS[body.planId] : undefined;
  if (!orderId || !/^[A-Z0-9]{5,32}$/i.test(orderId) || !plan) {
    return json(400, { error: "Missing or invalid order reference." }, origin);
  }

  try {
    const token = await oauthToken(clientId, clientSecret);

    // Everything below is verified against PayPal's own records.
    let { status, data: order } = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token);
    if (status === 404) return json(404, { error: "Order not found." }, origin);
    if (status !== 200 || !order.purchase_units?.length) {
      return json(502, { error: "Could not verify the order with PayPal." }, origin);
    }

    const unit = order.purchase_units[0];
    const amountOk =
      unit.amount?.value === plan.price && unit.amount?.currency_code === plan.currency;
    if (!amountOk) {
      console.error(`capture-order amount mismatch: order ${orderId} vs plan ${plan.id}`);
      return json(400, { error: "This order does not match the selected plan." }, origin);
    }
    if (!["APPROVED", "COMPLETED"].includes(order.status ?? "")) {
      return json(409, { error: "The order is not approved for capture yet." }, origin);
    }

    if (order.status !== "COMPLETED") {
      const cap = await paypal(`/v2/checkout/orders/${orderId}/capture`, "POST", token);
      const alreadyCaptured =
        cap.status === 422 && cap.data.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED");
      if (cap.status !== 201 && !alreadyCaptured) {
        console.error("PayPal capture failed:", cap.status, JSON.stringify(cap.data).slice(0, 300));
        return json(502, { error: "Payment capture failed. If you were charged, contact support." }, origin);
      }
      ({ status, data: order } = await paypal(`/v2/checkout/orders/${orderId}`, "GET", token));
      if (status !== 200) {
        return json(502, { error: "Could not confirm the captured payment." }, origin);
      }
    }

    const captureStatus = order.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (order.status !== "COMPLETED" || (captureStatus && captureStatus !== "COMPLETED")) {
      return json(409, { error: "The payment has not completed yet." }, origin);
    }

    const passToken = await issuePassForOrder(plan, orderId);
    void recordIssued(orderId, plan.id);

    return json(
      200,
      { passToken, requests: plan.requests, expiresDays: plan.days, orderId },
      origin,
    );
  } catch (e) {
    console.error("capture-order error:", e instanceof Error ? e.message : e);
    return json(502, { error: "Fulfillment failed. If you were charged, contact support." }, origin);
  }
}
