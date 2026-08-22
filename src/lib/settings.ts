import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { AnthropicModelId, Effort, ProviderId, StoredKey } from "./types";
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
  /* Multiple BYOK Keys Vault */
  storedKeys: StoredKey[];
  /* Shared */
  effort: Effort;
  theme: "system" | "dark" | "light";
  lastBackupAt: number;
  setProvider: (p: ProviderId) => void;
  update: (patch: Partial<SettingsState>) => void;
  addRecentModel: (modelId: string) => void;
  addStoredKey: (key: Omit<StoredKey, "id" | "createdAt">) => StoredKey;
  removeStoredKey: (id: string) => void;
  updateStoredKey: (id: string, patch: Partial<StoredKey>) => void;
  applyStoredKey: (id: string) => void;
  hasKey: () => boolean;
}

/** Settings live in localStorage — tiny, synchronous, and on-device. */
export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      provider: "openai-compatible",
      anthropicKey: "",
      anthropicBaseUrl: "",
      anthropicModel: "claude-opus-5",
      compatKey: "",
      compatBaseUrl: "https://openrouter.ai/api/v1",
      compatModel: "openrouter/auto",
      recentModels: [
        "openrouter/auto",
        "deepseek/deepseek-r1:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "google/gemini-2.0-flash-exp:free",
      ],
      storedKeys: [],
      effort: "high",
      theme: "system",
      lastBackupAt: 0,
      setProvider: (provider) => set({ provider }),
      update: (patch) => set(patch),
      addRecentModel: (modelId) => {
        const id = modelId.trim();
        if (!id) return;
        const curr = get().recentModels.filter((m) => m !== id);
        set({ recentModels: [id, ...curr].slice(0, 5) });
      },
      addStoredKey: (keyData) => {
        const newKey: StoredKey = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          ...keyData,
          createdAt: Date.now(),
        };
        const current = get().storedKeys || [];
        set({ storedKeys: [newKey, ...current] });
        return newKey;
      },
      removeStoredKey: (id) => {
        const current = get().storedKeys || [];
        set({ storedKeys: current.filter((k) => k.id !== id) });
      },
      updateStoredKey: (id, patch) => {
        const current = get().storedKeys || [];
        set({
          storedKeys: current.map((k) => (k.id === id ? { ...k, ...patch } : k)),
        });
      },
      applyStoredKey: (id) => {
        const key = (get().storedKeys || []).find((k) => k.id === id);
        if (!key) return;
        set({
          provider: "openai-compatible",
          compatKey: key.apiKey,
          compatBaseUrl: key.baseUrl,
          compatModel: key.defaultModel || get().compatModel || "deepseek/deepseek-r1:free",
        });
      },
      hasKey: () => {
        const s = get();
        if (s.provider === "anthropic") return s.anthropicKey.trim().length > 10;
        return s.compatBaseUrl.trim().length > 8 && s.compatModel.trim().length > 0;
      },
    }),
    {
      name: "comtus-settings",
      version: 5,
      migrate: (persisted, version) => {
        const old = persisted as Partial<SettingsState> & {
          apiKey?: string;
          model?: string;
        };
        const base: Partial<SettingsState> = {
          recentModels: ["deepseek/deepseek-r1", "meta-llama/llama-3.3-70b-instruct", "qwen/qwen-2.5-72b-instruct"],
          ...old,
          storedKeys: old.storedKeys || [],
          theme: old.theme ?? "system",
          lastBackupAt: old.lastBackupAt ?? 0,
        };
        if (version < 2) {
          return {
            ...base,
            anthropicKey: old.apiKey ?? "",
            anthropicModel:
              old.model === "claude-sonnet-5" ? "claude-sonnet-5" : "claude-opus-5",
          };
        }
        if (version < 5) {
          return {
            ...base,
            theme: old.theme ?? "system",
            lastBackupAt: old.lastBackupAt ?? 0,
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
