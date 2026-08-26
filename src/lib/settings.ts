import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { AnthropicModelId, CodexModelInfo, CodexUsage, Effort, OAuthAccount, ProviderId, StoredKey } from "./types";
import { normalizeStoredCodexUsage } from "./codexUsage";
import type { CallSettings } from "./llm";

export type PlanTier = "free" | "sprint" | "scholar" | "mastery";

/** Fallback Codex model roster until discovery (`GET /codex/models`)
 *  refreshes it with the account's actual list. gpt-5.6 family uses the
 *  Responses-Lite wire format (see llm.ts). */
export const CODEX_FALLBACK_MODELS: CodexModelInfo[] = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", lite: true, ctx: "1M" },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", lite: true, ctx: "1M" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", lite: true, ctx: "1M" },
  { id: "gpt-5.5", label: "GPT-5.5", ctx: "272k" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", ctx: "272k" },
  { id: "gpt-5.4", label: "GPT-5.4", ctx: "272k" },
];

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
  /* Subscription sign-ins — Claude Pro/Max and ChatGPT (Codex). */
  claudeOAuth: OAuthAccount | null;
  codexOAuth: OAuthAccount | null;
  claudeOauthModel: AnthropicModelId;
  codexModel: string;
  codexModels: CodexModelInfo[];
  codexUsage: CodexUsage | null;
  /* Multiple BYOK Keys Vault */
  storedKeys: StoredKey[];
  /* Plan & Token Balance Management */
  isPro: boolean;
  planTier: PlanTier;
  tokenBalance: number;
  tokensUsed: number;
  activePassCode: string;
  /* Shared */
  effort: Effort;
  theme: "system" | "dark" | "light";
  companion: boolean;
  companionSfx: boolean;
  /** Studio pixel chrome (Pixelify on all desk text + arcade press). Scholar restores Fraunces + Inter. */
  pixelDesk: boolean;
  lastBackupAt: number;
  setProvider: (p: ProviderId) => void;
  update: (patch: Partial<SettingsState>) => void;
  addRecentModel: (modelId: string) => void;
  addStoredKey: (key: Omit<StoredKey, "id" | "createdAt">) => StoredKey;
  removeStoredKey: (id: string) => void;
  updateStoredKey: (id: string, patch: Partial<StoredKey>) => void;
  applyStoredKey: (id: string) => void;
  activateProPass: (passCode: string, planTier?: PlanTier, tokenAmount?: number) => void;
  consumeTokens: (amount: number) => void;
  setOAuthAccount: (account: OAuthAccount | null, which?: "claude-oauth" | "codex") => void;
  setCodexModels: (models: CodexModelInfo[]) => void;
  setCodexUsage: (usage: CodexUsage | null) => void;
  hasProPlan: () => boolean;
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
      compatModel: "openrouter/free",
      recentModels: [
        "openrouter/free",
        "dots-studio/dots-3-note-preview:free",
        "nvidia/nemotron-3.5-lightning:free",
      ],
      storedKeys: [],
      claudeOAuth: null,
      codexOAuth: null,
      claudeOauthModel: "claude-opus-5",
  codexModel: "gpt-5.6-luna",
  codexModels: CODEX_FALLBACK_MODELS,
  codexUsage: null,
  isPro: false,
      planTier: "free",
      tokenBalance: 0,
      tokensUsed: 0,
      activePassCode: "",
      effort: "high",
      theme: "system",
      companion: true,
      companionSfx: true,
      pixelDesk: true,
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
          compatModel: key.defaultModel || get().compatModel || "openrouter/free",
        });
      },
      activateProPass: (passCode: string, planTier: PlanTier = "scholar", tokenAmount?: number) => {
        // Balances are hosted-request quotas (matching the server proxy's
        // per-pass counting), never tokens — tokens are not metered.
        const defaultTokensByPlan: Record<PlanTier, number> = {
          free: 0,
          sprint: 60,
          scholar: 200,
          mastery: 500,
        };
        const tokensToAdd = tokenAmount ?? defaultTokensByPlan[planTier] ?? 200;
        set((prev) => ({
          isPro: true,
          planTier,
          tokenBalance: (prev.tokenBalance || 0) + tokensToAdd,
          activePassCode: passCode.trim(),
          provider: "anthropic",
          anthropicKey: passCode.trim(),
        }));
      },
      consumeTokens: (amount: number) => {
        if (amount <= 0) return;
        set((prev) => ({
          tokensUsed: (prev.tokensUsed || 0) + amount,
        }));
      },
      setOAuthAccount: (account, which) => {
        const slot = which ?? account?.provider;
        if (slot === "claude-oauth") {
          set(account ? { claudeOAuth: account, provider: "claude-oauth" } : { claudeOAuth: null });
        } else if (slot === "codex") {
          set(account ? { codexOAuth: account, provider: "codex" } : { codexOAuth: null });
        }
      },
      setCodexModels: (models) => {
        if (!Array.isArray(models) || models.length === 0) return;
        set({ codexModels: models });
      },
      setCodexUsage: (usage) => set(usage ? { codexUsage: usage } : { codexUsage: null }),
      hasProPlan: () => {
        const s = get();
        return Boolean(s.isPro && s.planTier && s.planTier !== "free");
      },
      hasKey: () => {
        const s = get();
        if (s.provider === "anthropic") return s.anthropicKey.trim().length > 10;
        if (s.provider === "claude-oauth") return Boolean(s.claudeOAuth?.accessToken);
        if (s.provider === "codex") return Boolean(s.codexOAuth?.accessToken);
        return s.compatBaseUrl.trim().length > 8 && s.compatModel.trim().length > 0;
      },
    }),
    {
      name: "comtus-settings",
      version: 11,
      migrate: (persisted, version) => {
        const old = persisted as Partial<SettingsState> & {
          apiKey?: string;
          model?: string;
        };
        const base: Partial<SettingsState> = {
          recentModels: ["openrouter/free", "dots-studio/dots-3-note-preview:free", "nvidia/nemotron-3.5-lightning:free"],
          ...old,
          storedKeys: old.storedKeys || [],
          claudeOAuth: old.claudeOAuth ?? null,
          codexOAuth: old.codexOAuth ?? null,
          claudeOauthModel: old.claudeOauthModel ?? "claude-opus-5",
          codexModel: old.codexModel && !(old.codexModel === "gpt-5-codex" || old.codexModel === "gpt-5")
            ? old.codexModel
            : "gpt-5.6-luna",
          codexModels: old.codexModels ?? CODEX_FALLBACK_MODELS,
          codexUsage: normalizeStoredCodexUsage(old.codexUsage) ?? null,
          isPro: old.isPro ?? false,
          planTier: old.planTier ?? "free",
          tokenBalance: old.tokenBalance ?? 0,
          tokensUsed: old.tokensUsed ?? 0,
          activePassCode: old.activePassCode ?? "",
          theme: old.theme ?? "system",
          companion: old.companion ?? true,
          companionSfx: old.companionSfx ?? true,
          pixelDesk: old.pixelDesk ?? true,
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
        if (version < 6) {
          return {
            ...base,
            isPro: old.isPro ?? false,
            planTier: old.planTier ?? "free",
            tokenBalance: old.tokenBalance ?? 0,
            tokensUsed: old.tokensUsed ?? 0,
            activePassCode: old.activePassCode ?? "",
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
    useShallow((s) => {
      if (s.provider === "anthropic") {
        return {
          provider: "anthropic" as const,
          apiKey: s.anthropicKey,
          baseUrl: s.anthropicBaseUrl,
          model: s.anthropicModel,
          effort: s.effort,
        };
      }
      if (s.provider === "claude-oauth") {
        return {
          provider: "claude-oauth" as const,
          apiKey: s.claudeOAuth?.accessToken ?? "",
          baseUrl: "",
          model: s.claudeOauthModel,
          effort: s.effort,
        };
      }
      if (s.provider === "codex") {
        return {
          provider: "codex" as const,
          apiKey: s.codexOAuth?.accessToken ?? "",
          baseUrl: "",
          model: s.codexModel,
          effort: s.effort,
        };
      }
      return {
        provider: "openai-compatible" as const,
        apiKey: s.compatKey,
        baseUrl: s.compatBaseUrl,
        model: s.compatModel,
        effort: s.effort,
      };
    }),
  );
}
