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
export async function exchangeOpenRouterCode(code: string): Promise<string> {
  const verifier = sessionStorage.getItem("comtus_or_verifier") || "";
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
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter key exchange failed (${res.status}): ${text.slice(0, 150)}`);
  }

  const data = (await res.json()) as { key?: string };
  if (!data?.key) {
    throw new Error("No API key returned from OpenRouter authorization.");
  }

  // Automatically save and activate the key in Comtus
  useSettings.getState().update({
    provider: "openai-compatible",
    compatKey: data.key,
    compatBaseUrl: "https://openrouter.ai/api/v1",
    compatModel: "dots-studio/dots-3-note-preview:free",
  });

  return data.key;
}
