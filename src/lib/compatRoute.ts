/**
 * Routing for OpenAI-compatible endpoints called from the browser.
 *
 * Some providers (OpenCode Zen, Mistral) answer the CORS preflight but
 * omit access-control-allow-origin on their real responses, so the
 * browser completes the request yet refuses to hand the body back to
 * JavaScript — the OpenAI SDK surfaces that as a bare "Connection
 * error." while the endpoint itself is perfectly healthy (verified
 * 2026-08-22: opencode.ai/zen/v1 answers OPTIONS with ACAO:*, then
 * sends GET/POST responses with no ACAO header at all).
 *
 * Those hosts are relayed through our same-origin /api/compat edge
 * function (a Vite dev middleware mirrors it for `pnpm dev`); the
 * caller's own API key rides along in the Authorization header and is
 * never stored anywhere. Everything else — OpenRouter, Groq, DeepSeek,
 * Together, Cerebras, Google, local Ollama/LM Studio, custom
 * endpoints — goes direct, exactly as before.
 */

/** Hosts served by the /api/compat relay (see api/compat.ts). */
const RELAY_HOSTS: { key: string; match: (hostname: string) => boolean }[] = [
  { key: "zen", match: (h) => h === "opencode.ai" || h.endsWith(".opencode.ai") },
  { key: "mistral", match: (h) => h === "api.mistral.ai" || h.endsWith(".mistral.ai") },
];

/** Same origin as the app in dev/web; the deployed site for the Tauri
 *  shell (mirrors the API_ORIGIN convention in llm.ts). */
function relayOrigin(): string {
  const env = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/+$/, "");
  return env || (typeof window !== "undefined" ? window.location.origin : "");
}

/** Map a direct endpoint base URL to its fetchable form — relayed for
 *  CORS-hostile hosts, untouched for everything else. */
export function compatFetchBase(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return trimmed;
  const relay = RELAY_HOSTS.find((r) => r.match(url.hostname.toLowerCase()));
  if (!relay) return trimmed;
  const origin = relayOrigin();
  if (!origin) return trimmed;
  return `${origin}/api/compat/${relay.key}${url.pathname}${url.search}`;
}
