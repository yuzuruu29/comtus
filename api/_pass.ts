/**
 * Shared server-side primitives for the hosted-models pass system.
 * Used by api/paypal/* (automated issuance at purchase time) and
 * consumable by scripts/issue-pass.mjs's token format via api/anthropic.ts.
 *
 * Passes are HMAC-signed, deterministic per PayPal order id: capturing the
 * same order twice yields the identical token, so replays can't mint extra
 * credentials and no issuance database is required.
 */

export interface ServerPlan {
  id: "sprint" | "scholar" | "mastery";
  name: string;
  /** USD price the server charges — the browser never dictates amounts. */
  price: string;
  currency: "USD";
  requests: number;
  days: number;
}

/** Single source of truth for pricing + quotas. Keep in sync with src/lib/paypal.ts display copy. */
export const SERVER_PLANS: Record<string, ServerPlan> = {
  sprint: { id: "sprint", name: "Sprint Pass", price: "2.99", currency: "USD", requests: 60, days: 60 },
  scholar: { id: "scholar", name: "Scholar Pass", price: "6.99", currency: "USD", requests: 200, days: 120 },
  mastery: { id: "mastery", name: "Mastery Pass", price: "14.99", currency: "USD", requests: 500, days: 180 },
};

export const PASS_PREFIX = "comtus-pass-v1.";

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacHex(payloadB64: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

async function deterministicJti(orderId: string, secret: string): Promise<string> {
  return (await hmacHex(`jti:${orderId}`, secret)).slice(0, 12);
}

/** Mint the buyer's pass token for a verified PayPal order (idempotent). */
export async function issuePassForOrder(plan: ServerPlan, orderId: string): Promise<string> {
  const secret = process.env.PASS_SIGNING_SECRET ?? "";
  if (!secret) throw new Error("PASS_SIGNING_SECRET is not configured");
  const j = await deterministicJti(orderId, secret);
  const payload = {
    j,
    q: plan.requests,
    e: Math.floor(Date.now() / 1000) + plan.days * 86400,
    n: plan.name,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${PASS_PREFIX}${payloadB64}.${await hmacHex(payloadB64, secret)}`;
}
