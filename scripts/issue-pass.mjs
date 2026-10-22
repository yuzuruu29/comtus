#!/usr/bin/env node
/**
 * Issue a signed Comtus Smarter Models pass.
 *
 *   node scripts/issue-pass.mjs --plan scholar [--days 90] [--note "Mark"]
 *   node scripts/issue-pass.mjs --plan scholar --requests 200
 *
 * Reads PASS_SIGNING_SECRET from the environment or .env.local (it must
 * match the Vercel env var the /api/anthropic proxy uses). Prints a
 * comtus-pass-v1 token. New passes carry a credit budget. --requests
 * mints a legacy request-count pass for a buyer who already paid for one.
 */

import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const PLANS = {
  sprint: { budgetNano: 1_495_000_000, days: 60, label: "Sprint" },
  scholar: { budgetNano: 3_495_000_000, days: 120, label: "Scholar" },
  mastery: { budgetNano: 7_495_000_000, days: 180, label: "Mastery" },
};

function loadSecret() {
  if (process.env.PASS_SIGNING_SECRET) return process.env.PASS_SIGNING_SECRET;
  try {
    const env = readFileSync(".env.local", "utf8");
    const m = env.match(/^PASS_SIGNING_SECRET=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* no .env.local */
  }
  console.error("Missing PASS_SIGNING_SECRET (env var or .env.local).");
  process.exit(1);
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};

const planId = get("--plan") ?? "scholar";
const plan = PLANS[planId];
if (!plan) {
  console.error(`Unknown plan "${planId}". Use: ${Object.keys(PLANS).join(", ")}`);
  process.exit(1);
}
const days = Number(get("--days") ?? plan.days);
const requests = get("--requests");
const note = get("--note");
const name = note ? `${plan.label} (${note})` : plan.label;
const payload = requests
  ? { j: randomBytes(6).toString("hex"), q: Number(requests), e: Math.floor(Date.now() / 1000) + days * 86400, n: name }
  : { v: 2, j: randomBytes(6).toString("hex"), c: plan.budgetNano, e: Math.floor(Date.now() / 1000) + days * 86400, n: name };

const payloadB64 = b64url(JSON.stringify(payload));
const sig = createHmac("sha256", loadSecret()).update(payloadB64).digest("hex");

console.log(`\nComtus pass — ${payload.n}`);
console.log(
  requests
    ? `  requests: ${requests} · expires in ${days} days (${new Date(payload.e * 1000).toISOString().slice(0, 10)})\n`
    : `  included usage: $${(plan.budgetNano / 1e9).toFixed(2)} · expires in ${days} days (${new Date(payload.e * 1000).toISOString().slice(0, 10)})\n`,
);
console.log(`comtus-pass-v1.${payloadB64}.${sig}\n`);
