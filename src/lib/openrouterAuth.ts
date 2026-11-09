import { useSettings } from "./settings";

/**
 * Generates a cryptographically secure random string for PKCE code verifier.
 */
function generateRandomString(length = 64): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join("");
}

/**
 * Computes SHA-256 hash and encodes as base64url string.
 */
async function sha256Base64Url(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Initiates the 1-Click OpenRouter PKCE OAuth flow.
 * Redirects the student directly to OpenRouter authorization without copy-pasting keys.
 */
export async function startOpenRouterOAuth(): Promise<void> {
  const verifier = generateRandomString(64);
  sessionStorage.setItem("comtus_or_verifier", verifier);

  const codeChallenge = await sha256Base64Url(verifier);
  const callbackUrl = `${window.location.origin}/auth/openrouter/callback`;

  const authUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(
    callbackUrl,
  )}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  window.location.href = authUrl;
}

/**
 * Exchanges the authorization code received from OpenRouter for an API key.
 */
const exchanges = new Map<string, Promise<string>>();

export async function exchangeOpenRouterCode(code: string): Promise<string> {
  const pending = exchanges.get(code);
  if (pending) return pending;

  const request = performExchange(code);
  exchanges.set(code, request);
  try {
    return await request;
  } finally {
    exchanges.delete(code);
  }
}

async function performExchange(code: string): Promise<string> {
  const verifier = sessionStorage.getItem("comtus_or_verifier");
  if (!code || !verifier || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
    throw new Error("Please start OpenRouter sign-in again from Comtus.");
  }
  // Callback effects may be replayed; exchange a one-use code only once.
  sessionStorage.removeItem("comtus_or_verifier");

  const res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      code_challenge_method: "S256",
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter key exchange failed (${res.status})`);
  }

  const data: unknown = await res.json();
  if (!data || typeof data !== "object" || !("key" in data) || typeof data.key !== "string" || !data.key.trim()) {
    throw new Error("No API key returned from OpenRouter authorization.");
  }

  // Automatically save and activate the key in Comtus
  useSettings.getState().update({
    provider: "openai-compatible",
    compatKey: data.key,
    compatBaseUrl: "https://openrouter.ai/api/v1",
    compatModel: "openrouter/free",
  });

  return data.key;
}
