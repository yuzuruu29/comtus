# Hosted Smarter Models — Ops Runbook

How the paid Claude tier works now, and what you (the operator) must keep
healthy. Fulfillment is **automatic**: the buyer's pass is issued at capture
time, no manual step.

## Architecture

```
Browser ──▶ /api/paypal/create-order  (server-owned prices)
        ◀── orderId; buyer approves in PayPal popup
Browser ──▶ /api/paypal/capture-order
              ├─ re-verifies status/amount against PayPal's API
              ├─ captures server-side
              ├─ captures with PayPal-Request-Id comtus-capture-<orderId> (retry-safe)
              └─ mints deterministic comtus-pass-v1 token (idempotent per order;
                 expiry counts from the capture time, so re-submitting an
                 old order returns the same pass instead of extending it)
Browser (pass token only) ──▶ /api/anthropic (Vercel Edge)
                                ├─ verify HMAC signature + expiry
                                ├─ per-pass + per-IP quotas via Upstash (fail closed)
                                ├─ only POST /v1/messages, allowlisted models,
                                │   max_tokens clamped, 8 MB body cap
                                ├─ forwards with ANTHROPIC_HOSTED_KEY ──▶ api.anthropic.com
                                │     ◀── SSE stream passthrough ──
                                └─ non-2xx or unreachable upstream → the request is
                                   refunded to the pass (DECR); Anthropic doesn't bill it
```

- The Anthropic key exists **only** as a Vercel env var. Nothing in the
  client bundle, nothing in git.
- Pass tokens are `comtus-pass-v1.<payload>.<hmac>` — signed, carry a
  request quota + expiry, cannot be forged or self-issued in the browser.
- Users' own `sk-ant-` keys still go direct from their browser (their key,
  their responsibility). BYOK OpenRouter/Groq/Zen/etc. is unchanged.
- Set `HOSTED_PROXY_OFF=1` on Vercel to pause all hosted traffic instantly
  (kill switch); redeploy without it to resume.

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_HOSTED_KEY` | yes | The hosted-tier Anthropic key. **Rotate this on a schedule.** |
| `PASS_SIGNING_SECRET` | yes | HMAC secret shared by issuance + proxy. Must match `.env.local`. |
| `PAYPAL_CLIENT_SECRET` | yes | Server-side order create/capture. Checkout fails closed without it. |
| `PAYPAL_CLIENT_ID` | no | Defaults to the public web SDK id. |
| `PAYPAL_API_BASE` | no | Default live `https://api-m.paypal.com`; point at sandbox for testing. |
| `UPSTASH_REDIS_REST_URL` | yes | Per-pass + per-IP quota counters — the proxy refuses traffic without them. Pass counters expire 30 days after their pass. Also holds device transfers (below). |
| `UPSTASH_REDIS_REST_TOKEN` | yes | Same. |
| `HOSTED_PROXY_OFF` | no | `1` = global kill switch (503 for all proxied calls). |

## After a PayPal payment

Nothing — fulfillment is automated by `/api/paypal/capture-order`, which
verifies the captured amount against the server plan table and returns the
pass to the buyer's app instantly. Use `scripts/issue-pass.mjs` only to
re-issue or comp a replacement pass:

```bash
node scripts/issue-pass.mjs --plan scholar            # 200 requests · 120 days
node scripts/issue-pass.mjs --plan sprint --days 30   # overrides allowed
node scripts/issue-pass.mjs --plan mastery --note "Mark"
```

Then have the buyer paste the printed `comtus-pass-v1.…` token in
Settings → Smarter Models.

## Rotating the Anthropic key

1. Create a new key in the Anthropic console (keep the spend limit low).
2. Vercel → Settings → Env Vars → update `ANTHROPIC_HOSTED_KEY` → redeploy.
3. Revoke the old key.

No client change or pass re-issue needed — passes are independent of the key.

## Rotating the signing secret

Only if it leaks (it lives in `.env.local` and Vercel only). Update both,
then re-issue passes to active buyers.

## Desktop (Tauri) builds

The desktop shell calls the proxy at `https://comtus-ai.vercel.app/api/anthropic`
via `VITE_API_ORIGIN` — set it when building the native app (already allowed
in the Tauri CSP).

## Device transfers (`/api/relay`)

"Send to another device" relays a notebook through `api/relay.ts`, which
uses the same Upstash database. What it stores is sealed on the sending
device (AES-GCM, key derived from the transfer code); the code travels
only between the two devices, so the relay holds text it cannot read.

- Keys: `relay:<id>:meta`, `relay:<id>:<part>`, `relay:<id>:done`, all with
  a one-hour TTL and deleted once the receiver has the notebook. Budget
  counters are `relaybudget:<hashed ip>`, one hour.
- Limits: 32 parts of 700,000 characters per transfer (about 16 MB sealed,
  after gzip), 20 new transfers and 600 reads per network per hour.
- Without the Upstash variables the relay answers 503 and the app tells the
  student sending isn't set up; exporting a file still works.
