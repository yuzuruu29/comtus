/* Ollama local-model detection for the desk's first-run setup. The native
   API (no /v1) serves /api/tags with CORS allowed for localhost origins;
   the chat calls themselves go through the OpenAI-compatible /v1 base in
   the user's settings. */

export const OLLAMA_BASE_URL = "http://localhost:11434/v1";

/** The model the setup guide offers to pull. Small enough for a lecture
    laptop, capable enough for grounded study chat. */
export const RECOMMENDED_MODEL = "qwen3:4b";

export interface OllamaStatus {
  reachable: boolean;
  models: string[];
  /** The origin that answered, so settings can pin the same host. */
  origin: string | null;
}

const PROBE_ORIGINS = ["http://127.0.0.1:11434", "http://localhost:11434"];

/** Ask the local Ollama daemon what it is serving. Resolves unreachable
    instead of throwing; a refused connection and a CORS rejection look the
    same from the page, and both mean "not usable yet". */
export async function probeOllama(timeoutMs = 2500): Promise<OllamaStatus> {
  for (const origin of PROBE_ORIGINS) {
    try {
      const response = await fetch(`${origin}/api/tags`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) continue;
      const body = (await response.json()) as { models?: { name?: string; model?: string }[] };
      const models = (body.models ?? [])
        .map((m) => m.name || m.model || "")
        .filter((name): name is string => Boolean(name));
      return { reachable: true, models, origin };
    } catch {
      /* try the next origin */
    }
  }
  return { reachable: false, models: [], origin: null };
}

/** Prefer a known-good study model already on the machine; else the first
    installed model; empty when Ollama has none. */
export function pickOllamaModel(models: string[]): string {
  const preferences = [RECOMMENDED_MODEL, "llama3.2:3b", "gemma3:4b", "qwen2.5:3b", "llama3.2:1b"];
  for (const preferred of preferences) {
    const hit = models.find((m) => m === preferred || m.split(":")[0] === preferred.split(":")[0]);
    if (hit) return hit;
  }
  return models[0] ?? "";
}
