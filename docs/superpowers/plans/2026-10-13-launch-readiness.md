# Launch Readiness Implementation Plan

> **For agentic workers:** Implement task-by-task. Do not start a task until the one before it in the same phase is green. Phases 1–4 are the sell gate. Phases 5–7 can ship after the first paid release.

**Goal:** Make the hosted Smarter Models pass safe to sell. New passes charge credits from each response’s real Anthropic token cost, old passes keep the request counts they were sold with, and the Claude and ChatGPT subscription sign-ins are removed. Desktop update, storage durability, and the deploy safety net follow.

**Architecture:** The edge proxy in `api/anthropic.ts` stays the only place that spends the hosted Anthropic key. It learns a second pass version. Version 1 (`q`) is unchanged request counting. Version 2 (`c`) reserves a worst-case cost, streams the reply, reads Anthropic’s `usage`, and settles the difference. Revocation is a Redis flag keyed by the pass id, set by a verified PayPal webhook. The client never becomes the source of truth for money.

**Tech stack:** Existing Vite 7, React 19, TypeScript 5.9, Vercel Edge + Node functions, Upstash Redis REST, PayPal Orders v2, Vitest 4. No new runtime dependencies.

**Decisions already made:**

- Meter new passes by actual token cost, not by request count.
- Remove both subscription sign-ins for launch. Official Sign in with ChatGPT is a later project, not this plan.
- Keep bring-your-own-key, OpenRouter sign-in, direct Anthropic API keys, and hosted passes.

## Global constraints

- Do not print, commit, or log secret values. The leaked key stays out of new diffs.
- `api/anthropic.ts`, `api/paypal.ts`, and `api/search.ts` stay free of cross-file imports. Each Vercel function is one file. Shared money math that the client must display is duplicated in `src/lib/credits.ts`, and a test asserts the two tables match.
- Passes already sold keep working. A payload with `q` and no `v` is a version-1 request pass. Never rewrite those tokens.
- Existing notebooks, settings, and BYOK keys survive. Settings migration only clears the removed sign-in.
- No new visual system. Copy changes use the words already on the desk.
- Every task ends with `pnpm exec tsc --noEmit` and the named tests green. Each phase ends with `pnpm lint` and `pnpm test`.

## Operator steps (not code)

Do these before deploying Phase 2. The agent cannot do them.

- [ ] In the Anthropic console, revoke the key that was committed in `8d4c3e1` (prefix `sk-ant-api03-k`, 108 characters) and review its usage.
- [ ] Create a new key with a monthly spend limit. Set it only as Vercel `ANTHROPIC_HOSTED_KEY`.
- [ ] Delete `VITE_HOSTED_ANTHROPIC_KEY` from local `.env` and `.env.local`. Confirm no source file reads `import.meta.env.VITE_HOSTED_ANTHROPIC_KEY`.
- [ ] Confirm the Vercel project is on Pro. Hobby forbids commercial use.
- [ ] In PayPal, add a webhook to `https://www.comtus-ai.xyz/api/paypal/webhook` for `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, and `CUSTOMER.DISPUTE.CREATED`. Put the webhook id in `PAYPAL_WEBHOOK_ID`.

---

## Phase 1 — Remove the subscription sign-ins

Claude sign-in uses Claude Code’s OAuth client, which Anthropic’s consumer terms forbid for third-party apps. ChatGPT sign-in impersonates the Codex CLI. Both go. OpenRouter OAuth stays.

### Task 1.1: Delete the relays and their dev mirrors

**Files:**

- Delete: `api/claude-auth.ts`, `api/claude-auth.test.ts`, `api/codex.ts`, `api/codex.test.ts`
- Modify: `vercel.json` (remove the `/api/codex/:path*` rewrite)
- Modify: `vite.config.ts` (delete `oauthRelay()` and its plugin registration; keep `compatRelay()`)

**Done when:** `rg "claude-auth|/api/codex" api vite.config.ts vercel.json` returns nothing, and `api/codex.test.ts` is gone.

### Task 1.2: Delete the client sign-in stack

**Files:**

- Delete: `src/lib/oauthProviders.ts`, `src/lib/oauthProviders.test.ts`, `src/lib/codexUsage.ts`, `src/lib/codexUsage.test.ts`, `src/lib/codexEffort.test.ts`, `src/studio/SubscriptionConnect.tsx`, `src/studio/UsageLimitsPanel.tsx`, `src/studio/UsageLimitsPanel.test.tsx`
- Modify: `src/lib/types.ts` — `ProviderId` becomes `"anthropic" | "openai-compatible"`. Remove `OAuthAccount`, `CodexModelInfo`, and `CodexUsage` if nothing else imports them.
- Modify: `src/lib/llm.ts` — delete `getResponses`, `streamCodex`, `codexText`, `codexEffort`, `codexUsesLite`, `CODEX_MODELS`, the `claude-oauth` branches in `getAnthropic`, `generateJSON`, vision, and `friendlyError`. Keep `isHostedPass` and the Anthropic and OpenAI-compatible paths.
- Modify: `src/lib/settings.ts` — remove the OAuth fields, actions, and `CODEX_FALLBACK_MODELS`. Bump persist `version` from 14 to 15. In `migrate`, if `provider` is `claude-oauth` or `codex`, set `provider` to `openai-compatible` and drop `claudeOAuth`, `codexOAuth`, `codexModels`, `codexUsage`, `claudeOauthModel`, and `codexModel`.
- Modify: `src/studio/SettingsModal.tsx`, `src/studio/ModelPickerMenu.tsx`, `src/studio/SourcesPane.tsx`, `src/studio/generators/AidsFlow.tsx` — remove the subscription cards, the Codex model roster, `<UsageLimitsPanel />`, and `provider === "claude-oauth"` checks. Anthropic means an API key or a hosted pass only.

**Done when:** `rg "claude-oauth|codexOAuth|SubscriptionConnect|chatgpt.com|platform.claude.com" src api` returns nothing, a settings fixture at version 14 with `provider: "codex"` migrates to `openai-compatible`, and `pnpm exec tsc --noEmit` is clean.

### Task 1.3: Update copy that names the removed sign-ins

**Files:**

- Modify: `README.md`, `OPENROUTER_BYOK_GUIDE.md`, `HOSTED_MODELS_OPS.md`, `src/landing/StaticPages.tsx`

Privacy currently lists model providers but should not describe a Claude or ChatGPT account relay. Terms stay silent on those sign-ins. Do not rewrite the redesign copy beyond those sentences.

---

## Phase 2 — Credit passes

### Money model

Prices are integer nano-USD (1e-9 USD) so cache rates stay whole.

| Model | Input | 5m cache write | 1h cache write | Cache read | Output |
|---|---:|---:|---:|---:|---:|
| `claude-opus-5` | 5,000 | 6,250 | 10,000 | 500 | 25,000 |
| `claude-sonnet-5` | 2,000 | 2,500 | 4,000 | 200 | 10,000 |

Per token. Source: Anthropic list prices, 2026-10-13. A model missing from this table is rejected even if it is allowlisted.

`CREDIT_MARKUP` is `2`. A pass’s included Anthropic budget is `priceUsd / 2`, converted to nano-USD. The buyer still pays the sticker price. The markup covers PayPal fees and thinking tokens. Change the constant in one place if the first month of logs says otherwise.

| Plan | Price | Included budget (`c`) |
|---|---:|---:|
| Sprint | $2.99 | $1.495 |
| Scholar | $6.99 | $3.495 |
| Mastery | $14.99 | $7.495 |

Version-2 payload: `{ v: 2, j, c, e, n }`. `c` is the included budget in nano-USD. `j` stays the 12-hex HMAC of the PayPal order id.

### Task 2.1: Pure cost function

**Files:**

- Create: `src/lib/credits.ts`, `src/lib/credits.test.ts`
- The same function body is pasted into `api/anthropic.ts` in Task 2.2. The test reads both and fails if they diverge.

```ts
costNano(usage, model) =
  input_tokens * input
  + cache_creation_input_tokens * cacheWrite5m
  + cache_read_input_tokens * cacheRead
  + output_tokens * output
```

Anthropic reports 1-hour cache writes separately when present (`cache_creation.ephemeral_1h_input_tokens`). Count those at the 1h rate and the remainder at the 5m rate. Missing fields are zero. Unknown model throws.

Also export `reserveNano(inputChars, maxTokens, model)` = cost of `ceil(inputChars / 4)` input tokens plus `maxTokens` output tokens, with no cache discount. The reserve is the most the call can cost.

### Task 2.2: Proxy settlement

**Files:**

- Modify: `api/anthropic.ts`, `api/anthropic.test.ts`

For a version-1 pass, keep today’s path: `INCR pass:<j>`, compare to `q`, refund with `DECR` on upstream failure.

For a version-2 pass:

1. Reject the body unless it is JSON and its top-level keys are only `model`, `max_tokens`, `system`, `messages`, `stream`, `thinking`, `output_config`. Drop anything else, including `tools`. This is what the app sends, and it closes the “cheap Opus API” hole.
2. Allow `model` only when it is both in `ALLOWED_MODELS` and in the rate table. Default allowlist stays `claude-opus-5` and `claude-sonnet-5`. `HOSTED_MODELS` may narrow it, never widen it past the rate table.
3. Clamp `max_tokens` to 16,000. Reject estimated input over 100,000 tokens with 413 and a message that names bring-your-own-key for larger notebooks.
4. `GET passdeny:<j>`. If it is set, 401 with “This pass has been revoked.”
5. Reserve with `INCRBY pass:<j> <reserveNano>`. The counter’s first write sets the same expiry as today (`e + 30 days`). If the counter now exceeds `c`, `DECRBY` the reserve and return 402 with `{ error, remaining }`.
6. Forward the call. On network failure or non-2xx, `DECRBY` the full reserve.
7. On a 2xx stream, tee the body. Parse `message_start` and `message_delta` for `usage`. After the stream ends, `actual = costNano(usage)`. If `actual < reserve`, `DECRBY` the difference. If usage never arrived (client abort before any event), keep the reserve. Log `model`, `j`, reserve, actual, and status. Never log the prompt.

Version-1 tests stay. Add tests for: tools stripped, over-input 413, reserve refunded on 529, partial refund when usage is smaller than the reserve, 402 when the reserve exceeds `c`, and 401 when `passdeny:<j>` is set.

### Task 2.3: Issue version-2 passes

**Files:**

- Modify: `api/paypal.ts`, `api/paypal.test.ts`, `scripts/issue-pass.mjs`, `src/lib/paypal.ts`

`issuePassForOrder` writes `v: 2` and `c` from the plan table. It no longer writes `q`. Orders captured before this deploy keep their old tokens because the jti and expiry are derived from the order, and the payload is what was already signed. Do not re-sign an order that already has a stored payload. Store `passpayload:<orderId>` in Redis at first issue (TTL = pass expiry) and return that exact string on repeat capture. New orders get version 2.

`STUDY_PLANS` descriptions become budget statements, for example “$3.50 of hosted model usage”. Delete `compareAt` and the strikethrough percent in `SettingsModal.tsx`.

`decodePassInfo` returns either `{ kind: "requests", requests, expiresAtMs }` or `{ kind: "credits", budgetNano, expiresAtMs }`.

### Task 2.4: Show credits, and cache hosted prompts

**Files:**

- Modify: `src/lib/llm.ts`, `src/studio/SettingsModal.tsx`, `src/lib/settings.ts`

When the key is a hosted pass, add `cache_control: { type: "ephemeral" }` to the system block and to the last document block in `streamAnthropic` and the JSON generation call. That is two breakpoints. Bring-your-own-key calls stay unchanged.

Client display reads the pass payload. It does not decrement a local balance; the 402 body and the pass total are the numbers shown. Replace “N requests left” with “$X.XX of hosted usage included” for version 2, and keep “N requests” for version 1.

`activateProPass` stores the pass and sets the provider. Stop adding the old request quota into `tokenBalance`. Leave `consumeTokens` unused rather than inventing a second ledger.

Hosted effort: if the user picks `xhigh` on a pass, send `high`. The cap on output tokens is what bounds the bill.

### Task 2.5: Honest limit copy

**Files:**

- Modify: `src/studio/FreeLimitWarningModal.tsx`, `src/lib/llm.ts` (`friendlyError`)

Remove “No Daily Caps” and “dedicated hosted compute”. The hosted option says a pass is prepaid usage, metered by the tokens a reply actually uses.

The one-click Groq switch currently sets a model without requiring a key. Change that button to open AI Models. Keep a single free-model switch to `openrouter/free`, which is the router’s own alias, instead of the two hardcoded model ids.

---

## Phase 3 — Revoke and restore passes

### Task 3.1: PayPal webhook

**Files:**

- Modify: `api/paypal.ts`, `api/paypal.test.ts`
- Modify: `vercel.json` if the webhook path needs a rewrite. Prefer `POST /api/paypal/webhook` on the existing Node handler.

Verify `PAYPAL-TRANSMISSION-SIG` against PayPal’s verify-webhook-signature endpoint using `PAYPAL_WEBHOOK_ID`. Reject unverified events with 401.

On refund, reversal, or dispute created: read the order id, recompute `j`, and `SET passdeny:<j> 1` with expiry `e + 30 days` when the pass payload is still known. If the order id is missing, log the event id and return 200 so PayPal does not retry forever. A denied pass fails in Task 2.2 step 4.

### Task 3.2: Restore from an order id

**Files:**

- Modify: `api/paypal.ts`, `src/studio/SettingsModal.tsx`, `src/checkout/HostedCheckout.tsx`

`POST /api/paypal/recover` with `{ orderId }` loads the order from PayPal. If it is `COMPLETED` and the amount matches a plan, return the stored payload from `passpayload:<orderId>`, or mint the version-2 token if the order is new and no payload was stored. Same 60/hour IP throttle as capture. The settings field “Already paid? Enter the PayPal order id” calls this and runs `activateProPass`.

The checkout page keeps showing the full token once, and it also shows the full order id, not the last 8 characters.

---

## Phase 4 — Sell-gate copy and deploy

### Task 4.1: Privacy, terms, landing

**Files:**

- Modify: `src/landing/StaticPages.tsx`, `index.html` JSON-LD `operatingSystem`

Privacy gains two sentences: hosted usage is metered in token cost and stored as a pass counter; a refund or dispute disables the pass. Terms section 4 describes credits for new passes and request counts for passes already sold, plus the 14-day refund path that now matches the webhook. Add an effective date of the deploy day. Name the operator as the same Philippines contact already on the privacy page. Do not invent a legal entity.

JSON-LD `operatingSystem` becomes `"Web, macOS, Windows"`. The mobile folder is a prototype.

Remove the strikethrough prices if Task 2.3 left any.

### Task 4.2: Ship the redesign that is already in the working tree

Do not mix it into the money commits. Commit the current UI diff on its own, then Phases 1–4.

After deploy, one sandbox purchase of Sprint and one hosted Sonnet message. Confirm the Redis counter moves by the usage cost and a second capture of the same order returns the same token.

---

## Phase 5 — Desktop updates

Installed 0.3.1 apps request `https://comtus-ai.vercel.app/desktop/latest.json`. That URL currently returns `index.html` because `desktop-releases/` is gitignored and absent on Vercel. Keep the URL. Stop committing binaries to this private repo.

### Task 5.1: Public release repo

**Files:**

- Modify: `.github/workflows/desktop-release.yml`
- Modify: `scripts/build-site-manifest.mjs` only if payload URLs must point at the public repo

Create public `yuzuruu29/comtus-releases` (operator). The workflow uploads the installers, `.sig` files, and updater payloads there with a `RELEASES_TOKEN` secret. `latest.json` stays generated as it is today, but each platform `url` is the public release asset URL. Commit only `desktop-releases/latest.json` (a few KB). Remove that one path from `.gitignore` and leave the binaries ignored.

Delete the workflow step that copies `.dmg`, `.exe`, and `.sig` into git. `copyDesktopReleases()` then publishes the manifest at `/desktop/latest.json`, which is all the installed apps need.

**Done when:** a dry-run manifest points every platform URL at the public repo, and `/desktop/latest.json` is JSON with `Content-Type: application/json`.

---

## Phase 6 — Durability and the safety net

### Task 6.1: Persistent storage and a backup nudge

**Files:**

- Modify: `src/lib/storageStats.ts`, `src/studio/DataTrustPanel.tsx`, `src/lib/db.ts` or the notebook-create call site

After the first notebook is created, call `navigator.storage.persist()` once. Ignore rejection. Show “Kept on this device” or “This browser may clear this site” in the data-trust panel from `navigator.storage.persisted()`.

If `lastBackupAt` is 0 and any notebook has a source, show a single line near the shelf: “Export a backup. This browser can remove site data.” `backup.ts` already stamps `lastBackupAt`.

### Task 6.2: Enforce a CSP that still allows BYOK

**Files:**

- Modify: `vercel.json`, `index.html`

The theme script in `index.html` is inline. Hash it and use that hash in `script-src`. Keep `style-src 'unsafe-inline'` because the crawlable fallback and Tailwind use inline styles. `connect-src` is `'self' https: http://localhost:* http://127.0.0.1:*` so custom OpenAI-compatible endpoints and local Ollama keep working. `frame-src` stays PayPal. `worker-src 'self' blob:`.

Ship one deploy as `Content-Security-Policy-Report-Only`. The next deploy renames the header to `Content-Security-Policy` if the browser console is clean on landing, desk, settings, and checkout.

### Task 6.3: Throttle the search relay

**Files:**

- Modify: `api/search.ts`, `api/search.test.ts`

Copy the Upstash hourly counter pattern from `api/relay.ts`. 60 searches per IP per hour. If Redis is unset, allow the request. Keep `access-control-allow-origin: *` so the desktop shell can call it, but count by IP.

### Task 6.4: CI on every push

**Files:**

- Create: `.github/workflows/ci.yml`

On pull request and push to `master`: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`. Node 22, pnpm from `packageManager`. Do not use the 120-second budget in `scripts/launch-check.sh`; the suite measured 392 seconds locally on 2026-10-13.

### Task 6.5: Client error log

**Files:**

- Create: `api/report.ts`
- Modify: `src/lib/ErrorBoundary.tsx`

`POST /api/report` accepts `{ message, stack }` up to 4 KB, rate-limits per IP, and `console.error`s it so it shows in Vercel logs. Strip the body if it contains `sk-`, `comtus-pass-`, or `Bearer `. The error boundary sends that payload and still renders the existing fallback. No notebook text.

---

## Phase 7 — Explicitly later

Not this plan:

- Official Sign in with ChatGPT, after registering Comtus with OpenAI.
- Accounts, recurring billing, and GCash or Maya.
- Adding Claude Opus 5.5 or Sonnet 5.5. That is a rate-table row plus an allowlist change, done when a pass should sell those models.
- A merchant-of-record or tax registration. Ask an accountant before volume grows.
- The mobile prototype.

## Suggested commit split

1. `chore(ui): land the study-desk redesign` — the current working tree, before this plan’s edits.
2. `feat(auth): remove Claude and ChatGPT subscription sign-in` — Phase 1.
3. `feat(billing): meter new passes by token cost` — Phase 2.
4. `feat(billing): revoke refunded passes and restore from an order id` — Phase 3.
5. `docs(legal): describe credit passes` — Phase 4.
6. `ci(desktop): publish updater payloads to a public release repo` — Phase 5.
7. `chore(reliability): persist storage, CSP, search throttle, CI, error log` — Phase 6.
