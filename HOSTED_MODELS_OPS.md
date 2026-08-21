# Hosted Smarter Models — Ops Runbook

How the paid Claude tier works now, and what you (the operator) do after a
PayPal payment.

## Architecture

```
Browser (pass token only) ──▶ /api/anthropic (Vercel Edge)
                                ├─ verify HMAC signature + expiry
                                ├─ optional: request count vs quota (Upstash)
                                └─ forwards with ANTHROPIC_HOSTED_KEY ──▶ api.anthropic.com
                                      ◀── SSE stream passthrough ──
```

- The Anthropic key exists **only** as a Vercel env var. Nothing in the
  client bundle, nothing in git.
- Pass tokens are `comtus-pass-v1.<payload>.<hmac>` — signed, carry a
  request quota + expiry, cannot be forged or self-issued in the browser.
- Users' own `sk-ant-` keys still go direct from their browser (their key,
  their responsibility). BYOK OpenRouter/Groq/Zen/etc. is unchanged.

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_HOSTED_KEY` | yes | The hosted-tier Anthropic key. **Rotate this on a schedule.** |
| `PASS_SIGNING_SECRET` | yes | HMAC secret. Must match `.env.local` (used by the issuance script). |
| `UPSTASH_REDIS_REST_URL` | no | Enables per-pass request counting. |
| `UPSTASH_REDIS_REST_TOKEN` | no | Enables per-pass request counting. |

Without Upstash, passes are enforced by **expiry only** — set the Anthropic
workspace spend limit as the backstop. With Upstash (free tier works), each
pass is additionally capped at its request quota.

## After a PayPal payment

1. Confirm the payment in PayPal (order id is shown in the buyer's success
   message).
2. Issue the pass locally:

   ```bash
   node scripts/issue-pass.mjs --plan scholar            # 200 requests · 120 days
   node scripts/issue-pass.mjs --plan sprint --days 30   # overrides allowed
   node scripts/issue-pass.mjs --plan mastery --note "Mark"
   ```

3. Email the printed `comtus-pass-v1.…` token to the buyer. They paste it
   in Settings → Smarter Models.

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
