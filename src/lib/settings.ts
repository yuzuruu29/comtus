import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { AnthropicModelId, Effort, ProviderId } from "./types";
import type { CallSettings } from "./llm";

interface SettingsState {
  provider: ProviderId;
  /* Anthropic — official API by default, or any Anthropic-shaped gateway. */
  anthropicKey: string;
  anthropicBaseUrl: string; // "" = official api.anthropic.com
  anthropicModel: AnthropicModelId;
  /* OpenAI-compatible — OpenRouter, Ollama, LM Studio, Groq, DeepSeek… */
  compatKey: string;
  compatBaseUrl: string; // full base URL, includes /v1
  compatModel: string; // free-text model id
  recentModels: string[];
  /* Shared */
  effort: Effort;
  setProvider: (p: ProviderId) => void;
  update: (patch: Partial<SettingsState>) => void;
  addRecentModel: (modelId: string) => void;
  hasKey: () => boolean;
}

/** Settings live in localStorage — tiny, synchronous, and on-device. */
export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      provider: "anthropic",
      anthropicKey: "",
      anthropicBaseUrl: "",
      anthropicModel: "claude-opus-5",
      compatKey: "",
      compatBaseUrl: "https://openrouter.ai/api/v1",
      compatModel: "",
      recentModels: ["deepseek/deepseek-r1", "meta-llama/llama-3.3-70b-instruct", "qwen/qwen-2.5-72b-instruct"],
      effort: "high",
      setProvider: (provider) => set({ provider }),
      update: (patch) => set(patch),
      addRecentModel: (modelId) => {
        const id = modelId.trim();
        if (!id) return;
        const curr = get().recentModels.filter((m) => m !== id);
        set({ recentModels: [id, ...curr].slice(0, 5) });
      },
      hasKey: () => {
        const s = get();
        if (s.provider === "anthropic") return s.anthropicKey.trim().length > 10;
        return s.compatBaseUrl.trim().length > 8 && s.compatModel.trim().length > 0;
      },
    }),
    {
      name: "comtus-settings",
      version: 3,
      migrate: (persisted, version) => {
        const old = persisted as Partial<SettingsState> & {
          apiKey?: string;
          model?: string;
        };
        const base = {
          recentModels: ["deepseek/deepseek-r1", "meta-llama/llama-3.3-70b-instruct", "qwen/qwen-2.5-72b-instruct"],
          ...old,
        };
        if (version < 2) {
          return {
            ...base,
            anthropicKey: old.apiKey ?? "",
            anthropicModel:
              old.model === "claude-sonnet-5" ? "claude-sonnet-5" : "claude-opus-5",
          };
        }
        return base;
      },
    },
  ),
);

/** The active provider's config, resolved into one passable object.
 *  useShallow is required: the selector builds a new object each call,
 *  and zustand v5 compares snapshots with Object.is — without it the
 *  workspace re-renders in a loop and React tears the pane down. */
export function useCallSettings(): CallSettings {
  return useSettings(
    useShallow((s) =>
      s.provider === "anthropic"
        ? {
            provider: "anthropic" as const,
            apiKey: s.anthropicKey,
            baseUrl: s.anthropicBaseUrl,
            model: s.anthropicModel,
            effort: s.effort,
          }
        : {
            provider: "openai-compatible" as const,
            apiKey: s.compatKey,
            baseUrl: s.compatBaseUrl,
            model: s.compatModel,
            effort: s.effort,
          },
    ),
  );
}
