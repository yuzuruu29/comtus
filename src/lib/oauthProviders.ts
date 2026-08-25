import { useSettings } from "./settings";
import { isTauri } from "./desktop";
import type { OAuthAccount, ProviderId } from "./types";

/**
 * Sign in with an existing Claude (Pro/Max) or ChatGPT (Plus/Pro)
 * subscription and use it as a chat provider — the subscription
 * equivalent of BYOK.
 *
 * Both providers speak OAuth 2.0 + PKCE, but neither lets a third-party
 * web app register its own redirect URI, so Comtus uses the manual
 * hand-off both ecosystems already expose to CLIs:
 *  - Claude authorizes onto a platform.claude.com page that displays the
 *    verification code for copy-paste (the flow Claude Code itself uses
 *    on terminals). The code comes back as "code#state".
 *  - ChatGPT/Codex redirects to a localhost loopback URL that nothing is
 *    listening on; the code sits in the dead URL's query string and the
 *    student copies the whole address bar contents back into Comtus.
 *
 * Tokens live only in the browser's settings store (localStorage). The
 * same-origin relays exist purely for network reachability: Claude's
 * token endpoint sends no CORS headers to third-party origins, and the
 * Codex inference endpoint blocks cross-origin reads entirely.
 */

/* ── Endpoints & clients ──────────────────────────────────── */

const CLAUDE = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorize: "https://claude.ai/oauth/authorize",
  // The manual-copy callback page — it renders the code for pasting.
  redirect: "https://platform.claude.com/oauth/code/callback",
  scopes: "org:create_api_key user:profile user:inference",
  token: "https://platform.claude.com/v1/oauth/token",
} as const;

const CODEX = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorize: "https://auth.openai.com/oauth/authorize",
  // Codex CLI's loopback. Nothing listens on it here — the student
  // copies the dead URL from the address bar instead.
  redirect: "http://localhost:1455/auth/callback",
  scopes: "openid profile email offline_access",
  token: "https://auth.openai.com/oauth/token",
} as const;

/* Same-origin relay base — mirrors API_ORIGIN in llm.ts. Claude's token
   endpoint is CORS-hostile, so its exchange/refresh is proxied; Codex's
   auth.openai.com allows browser calls and goes direct. */
const API_ORIGIN =
  (import.meta.env.VITE_API_ORIGIN as string) ||
  (typeof window !== "undefined" ? window.location.origin : "");

/* ── PKCE ─────────────────────────────────────────────────── */

function randomString(length = 64): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (x) => alphabet[x % alphabet.length]).join("");
}

async function sha256Base64Url(plain: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ── Pasted-payload parsing ───────────────────────────────── */

export interface ParsedGrant {
  code: string;
  state?: string;
}

/** Accept every shape a student might reasonably paste back:
 *  - the raw code
 *  - Claude's manual-copy format "code#state"
 *  - a full redirected URL (Codex loopback) with ?code=…&state=…
 *  - a query string on its own ("?code=…")
 *  Returns null when nothing code-shaped is found. */
export function parseGrantInput(input: string): ParsedGrant | null {
  const text = input.trim();
  if (!text) return null;

  if (text.includes("://") || text.startsWith("?")) {
    try {
      const url = new URL(text, "http://parse.local");
      const code = url.searchParams.get("code");
      if (code) return { code, state: url.searchParams.get("state") ?? undefined };
    } catch {
      /* fall through to code#state handling */
    }
  }

  const hash = text.split("#", 2);
  if (hash[0] && /^[A-Za-z0-9._~-]{8,}$/.test(hash[0])) {
    return { code: hash[0], state: hash[1] || undefined };
  }
  return null;
}

/** Decode a JWT payload without verifying — just enough to read the
 *  ChatGPT account id and email claims that the Codex backend needs. */
export function jwtClaims(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/* ── Browser windows ──────────────────────────────────────── */

async function openAuthPage(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      /* fall through to window.open */
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ── Token exchange ───────────────────────────────────────── */

function relayBase(): string {
  return `${API_ORIGIN.replace(/\/+$/, "")}/api/claude-auth`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  error?: string;
  error_description?: string;
}

async function exchangeClaude(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(relayBase(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `Claude sign-in failed (${res.status}).`,
    );
  }
  return data;
}

async function exchangeCodex(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(CODEX.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `ChatGPT sign-in failed (${res.status}).`,
    );
  }
  return data;
}

/* ── Flow: Claude ─────────────────────────────────────────── */

export async function startClaudeOAuth(): Promise<void> {
  const verifier = randomString();
  const state = randomString(24);
  sessionStorage.setItem("comtus_claude_oauth", JSON.stringify({ verifier, state }));

  const params = new URLSearchParams({
    client_id: CLAUDE.clientId,
    response_type: "code",
    redirect_uri: CLAUDE.redirect,
    scope: CLAUDE.scopes,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: "S256",
    state,
  });
  await openAuthPage(`${CLAUDE.authorize}?${params}`);
}

export async function completeClaudeOAuth(input: string): Promise<void> {
  const grant = parseGrantInput(input);
  if (!grant) throw new Error("That doesn't look like a Claude verification code — paste the full code (or code#state) shown on the authorization page.");

  const staged = sessionStorage.getItem("comtus_claude_oauth");
  const verifier = staged ? (JSON.parse(staged) as { verifier?: string }).verifier ?? "" : "";
  const expectedState = staged ? (JSON.parse(staged) as { state?: string }).state : undefined;
  if (expectedState && grant.state && grant.state !== expectedState) {
    throw new Error("The authorization state didn't match this browser — start the sign-in again.");
  }
  sessionStorage.removeItem("comtus_claude_oauth");

  const data = await exchangeClaude({
    grant_type: "authorization_code",
    client_id: CLAUDE.clientId,
    code: grant.code,
    redirect_uri: CLAUDE.redirect,
    ...(grant.state ? { state: grant.state } : {}),
    ...(verifier ? { code_verifier: verifier } : {}),
  });

  const account: OAuthAccount = {
    provider: "claude-oauth",
    accessToken: data.access_token!,
    refreshToken: data.refresh_token ?? "",
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    connectedAt: Date.now(),
  };
  useSettings.getState().setOAuthAccount(account);
}

/* ── Flow: ChatGPT / Codex ────────────────────────────────── */

/* Preferred: the device flow. auth.openai.com mints a short code the
   student enters at the (OpenAI-hosted) device page — no redirect URI
   involved, so nothing ever lands on a dead localhost page. The Codex
   client's redirect allowlist is byte-exact (Ory Hydra) and contains
   only http://localhost:1455|1457/auth/callback — custom domains are
   rejected server-side, which is why the old paste-a-URL flow exists
   only as a fallback below. */
const CODEX_DEVICE = {
  usercode: "https://auth.openai.com/api/accounts/deviceauth/usercode",
  token: "https://auth.openai.com/api/accounts/deviceauth/token",
  verify: "https://auth.openai.com/codex/device",
} as const;

export interface CodexDeviceSession {
  deviceAuthId: string;
  userCode: string;
  intervalSec: number;
  expiresAt: number;
}

/** Classify one poll response — pure, so the retry loop stays simple
 *  and testable. The success shape isn't documented; accept tokens
 *  directly or an authorization code we can exchange. */
export function classifyDevicePoll(
  ok: boolean,
  data: Record<string, unknown>,
): "pending" | "expired" | "tokens" | "code" | "unknown" {
  if (ok && typeof data.access_token === "string") return "tokens";
  const code = typeof data.code === "string" ? data.code : "";
  if (ok && /^[A-Za-z0-9._~-]{8,}$/.test(code)) return "code";
  const err = (data.error ?? {}) as { code?: unknown; message?: unknown };
  const errCode = typeof err.code === "string" ? err.code : "";
  if (/pending/i.test(errCode)) return "pending";
  if (/expired|denied|reject/i.test(errCode)) return "expired";
  return "unknown";
}

export async function startCodexDeviceAuth(): Promise<CodexDeviceSession> {
  const res = await fetch(CODEX_DEVICE.usercode, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: CODEX.clientId }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const deviceAuthId = typeof data.device_auth_id === "string" ? data.device_auth_id : "";
  const userCode = typeof data.user_code === "string" ? data.user_code : "";
  if (!res.ok || !deviceAuthId || !userCode) {
    throw new Error("OpenAI's device sign-in didn't start — try again in a moment.");
  }
  return {
    deviceAuthId,
    userCode,
    intervalSec: Number(data.interval) > 0 ? Number(data.interval) : 5,
    expiresAt: typeof data.expires_at === "string" ? Date.parse(data.expires_at) : Date.now() + 15 * 60 * 1000,
  };
}

export async function openCodexDevicePage(): Promise<void> {
  await openAuthPage(CODEX_DEVICE.verify);
}

function codexAccountFromTokens(data: TokenResponse): OAuthAccount {
  const claims = jwtClaims(data.access_token!);
  const accountId = typeof claims.chatgpt_account_id === "string" ? claims.chatgpt_account_id : undefined;
  const email = typeof claims.email === "string" ? claims.email : undefined;
  return {
    provider: "codex",
    accessToken: data.access_token!,
    refreshToken: data.refresh_token ?? "",
    expiresAt: Date.now() + (data.expires_in ?? 8 * 24 * 3600) * 1000,
    ...(accountId ? { accountId } : {}),
    ...(email ? { email } : {}),
    connectedAt: Date.now(),
  };
}

/** Poll until the student approves (or the code expires/denies). The
 *  device page is OpenAI-hosted, so approval is one normal login away. */
export async function pollCodexDeviceAuth(
  session: CodexDeviceSession,
  signal?: AbortSignal,
): Promise<void> {
  const sleepMs = Math.max(2, session.intervalSec) * 1000;
  while (!signal?.aborted && Date.now() < session.expiresAt) {
    await new Promise((r) => setTimeout(r, sleepMs));
    if (signal?.aborted) return;
    let ok = false;
    let data: Record<string, unknown> = {};
    try {
      const res = await fetch(CODEX_DEVICE.token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: CODEX.clientId,
          device_auth_id: session.deviceAuthId,
          user_code: session.userCode,
        }),
        signal,
      });
      ok = res.ok;
      data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    } catch (err) {
      if (signal?.aborted) return;
      if (err instanceof TypeError) continue; // transient network blip — keep polling
      throw err;
    }

    switch (classifyDevicePoll(ok, data)) {
      case "tokens":
        useSettings.getState().setOAuthAccount(codexAccountFromTokens(data as TokenResponse));
        return;
      case "code": {
        const exchanged = await exchangeCodex(
          new URLSearchParams({
            grant_type: "authorization_code",
            client_id: CODEX.clientId,
            code: String(data.code),
          }),
        );
        useSettings.getState().setOAuthAccount(codexAccountFromTokens(exchanged));
        return;
      }
      case "pending":
        continue;
      case "expired":
        throw new Error("The code was denied or expired — start the sign-in again.");
      default: {
        const err = (data.error ?? {}) as { message?: unknown };
        throw new Error(
          typeof err.message === "string" && err.message
            ? err.message
            : "OpenAI's device sign-in hit an unexpected response — try again.",
        );
      }
    }
  }
  if (!signal?.aborted) {
    throw new Error("The code expired before approval — start the sign-in again for a fresh one.");
  }
}

export async function startCodexOAuth(): Promise<void> {
  const verifier = randomString();
  const state = randomString(24);
  sessionStorage.setItem("comtus_codex_oauth", JSON.stringify({ verifier, state }));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CODEX.clientId,
    redirect_uri: CODEX.redirect,
    scope: CODEX.scopes,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: "S256",
    state,
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
  });
  await openAuthPage(`${CODEX.authorize}?${params}`);
}

export async function completeCodexOAuth(input: string): Promise<void> {
  const grant = parseGrantInput(input);
  if (!grant) throw new Error("That doesn't look like a ChatGPT authorization — after approving, copy the full address-bar URL (it starts with localhost) and paste it here.");

  const staged = sessionStorage.getItem("comtus_codex_oauth");
  const verifier = staged ? (JSON.parse(staged) as { verifier?: string }).verifier ?? "" : "";
  const expectedState = staged ? (JSON.parse(staged) as { state?: string }).state : undefined;
  if (expectedState && grant.state && grant.state !== expectedState) {
    throw new Error("The authorization state didn't match this browser — start the sign-in again.");
  }
  sessionStorage.removeItem("comtus_codex_oauth");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CODEX.clientId,
    code: grant.code,
    redirect_uri: CODEX.redirect,
    ...(verifier ? { code_verifier: verifier } : {}),
  });
  const data = await exchangeCodex(body);
  useSettings.getState().setOAuthAccount(codexAccountFromTokens(data));
}

/* ── Refresh ──────────────────────────────────────────────── */

async function refreshAccount(account: OAuthAccount): Promise<OAuthAccount> {
  if (!account.refreshToken) {
    throw new Error(
      account.provider === "claude-oauth"
        ? "Your Claude session expired — sign in again in Settings."
        : "Your ChatGPT session expired — sign in again in Settings.",
    );
  }
  let next: TokenResponse;
  if (account.provider === "claude-oauth") {
    next = await exchangeClaude({
      grant_type: "refresh_token",
      client_id: CLAUDE.clientId,
      refresh_token: account.refreshToken,
    });
  } else {
    next = await exchangeCodex(
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: CODEX.clientId,
        refresh_token: account.refreshToken,
        scope: CODEX.scopes,
      }),
    );
  }
  const refreshed: OAuthAccount = {
    ...account,
    accessToken: next.access_token!,
    refreshToken: next.refresh_token ?? account.refreshToken,
    expiresAt: Date.now() + (next.expires_in ?? 3600) * 1000,
  };
  useSettings.getState().setOAuthAccount(refreshed);
  return refreshed;
}

const inflight = new Map<ProviderId, Promise<string>>();

/** A valid access token for an OAuth provider, refreshing it (single
 *  flight) when it's within five minutes of expiring. */
export async function ensureFreshAccessToken(provider: "claude-oauth" | "codex"): Promise<string> {
  const account =
    provider === "claude-oauth"
      ? useSettings.getState().claudeOAuth
      : useSettings.getState().codexOAuth;
  if (!account?.accessToken) {
    throw new Error(
      provider === "claude-oauth"
        ? "Connect your Claude account in Settings first."
        : "Connect your ChatGPT account in Settings first.",
    );
  }
  if (Date.now() < account.expiresAt - 5 * 60 * 1000) return account.accessToken;

  const pending = inflight.get(provider);
  if (pending) return pending;
  const job = refreshAccount(account)
    .then((a) => a.accessToken)
    .finally(() => inflight.delete(provider));
  inflight.set(provider, job);
  return job;
}

export function disconnectOAuth(provider: "claude-oauth" | "codex"): void {
  useSettings.getState().setOAuthAccount(null, provider);
}
