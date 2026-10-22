import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { AnthropicModelId, Effort, ProviderId, StoredKey } from "./types";
import {
  DEFAULT_LEADING,
  DEFAULT_READING,
  isReadingLeading,
  isReadingSize,
  type ReadingLeading,
  type ReadingSize,
} from "./fontPresets";
import type { CallSettings } from "./llm";

export type PlanTier = "free" | "sprint" | "scholar" | "mastery";

/** Which key sends a draft: Enter (Shift+Enter breaks the line), or
 *  Ctrl/⌘+Enter for students who write their questions in paragraphs. */
export type SendKey = "enter" | "mod-enter";

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
  /* Plan & Token Balance Management */
  isPro: boolean;
  planTier: PlanTier;
  tokenBalance: number;
  tokensUsed: number;
  activePassCode: string;
  /* Shared */
  effort: Effort;
  theme: "system" | "dark" | "light";
  /** Atmosphere & motion level: "none" (focus/static), "minimal" (quiet glow), "full" (tactile/arcade). */
  motionMode: "none" | "minimal" | "full";
  companion: boolean;
  companionSfx: boolean;
  /** Pixel accent chrome: display lettering only, never the palette. */
  pixelDesk: boolean;
  /** Reading measure. The faces themselves are fixed (spec 5.1). */
  reading: ReadingSize;
  /** Line spacing for sources and answers (html[data-leading]). */
  leading: ReadingLeading;
  sendKey: SendKey;
  lastBackupAt: number;
  setProvider: (p: ProviderId) => void;
  update: (patch: Partial<SettingsState>) => void;
  addRecentModel: (modelId: string) => void;
  addStoredKey: (key: Omit<StoredKey, "id" | "createdAt">) => StoredKey;
  removeStoredKey: (id: string) => void;
  updateStoredKey: (id: string, patch: Partial<StoredKey>) => void;
  applyStoredKey: (id: string) => void;
  activateProPass: (passCode: string, planTier?: PlanTier) => void;
  consumeTokens: (amount: number) => void;
  hasProPlan: () => boolean;
  hasKey: () => boolean;
}

const RETIRED_SIGN_IN = new Set(["claude-oauth", "codex"]);

/** Persist migration. Version 15 drops Claude and ChatGPT subscription
 *  sign-in; anyone still on those providers lands on OpenRouter-compatible. */
export function migrateSettings(persisted: unknown, version: number): Partial<SettingsState> {
  const source = { ...((persisted ?? {}) as Record<string, unknown>) };
  const apiKey = typeof source.apiKey === "string" ? source.apiKey : "";
  const model = typeof source.model === "string" ? source.model : "";
  const rawProvider = typeof source.provider === "string" ? source.provider : "";
  for (const key of [
    "claudeOAuth",
    "codexOAuth",
    "claudeOauthModel",
    "codexModel",
    "codexModels",
    "codexUsage",
    "apiKey",
    "model",
  ]) {
    delete source[key];
  }
  const old = source as Partial<SettingsState>;
  const provider: ProviderId =
    rawProvider === "anthropic" || rawProvider === "openai-compatible"
      ? rawProvider
      : "openai-compatible";
  const base: Partial<SettingsState> = {
    recentModels: ["openrouter/free", "dots-studio/dots-3-note-preview:free", "nvidia/nemotron-3.5-lightning:free"],
    ...old,
    provider: RETIRED_SIGN_IN.has(rawProvider) ? "openai-compatible" : provider,
    storedKeys: old.storedKeys || [],
    isPro: old.isPro ?? false,
    planTier: old.planTier ?? "free",
    tokenBalance: old.tokenBalance ?? 0,
    tokensUsed: old.tokensUsed ?? 0,
    activePassCode: old.activePassCode ?? "",
    theme: old.theme && old.theme !== "system" ? old.theme : "light",
    motionMode: old.motionMode ?? "full",
    companion: old.companion ?? true,
    companionSfx: old.companionSfx ?? true,
    pixelDesk: old.pixelDesk ?? true,
    reading: isReadingSize(old.reading) ? old.reading : DEFAULT_READING,
    leading: isReadingLeading(old.leading) ? old.leading : DEFAULT_LEADING,
    sendKey: old.sendKey === "mod-enter" ? "mod-enter" : "enter",
    lastBackupAt: old.lastBackupAt ?? 0,
  };
  if (version < 2) {
    return {
      ...base,
      anthropicKey: apiKey ?? "",
      anthropicModel: model === "claude-sonnet-5" ? "claude-sonnet-5" : "claude-opus-5",
    };
  }
  return base;
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
      isPro: false,
      planTier: "free",
      tokenBalance: 0,
      tokensUsed: 0,
      activePassCode: "",
      effort: "high",
      theme: "light",
      motionMode: "full",
      companion: true,
      companionSfx: true,
      // Pixel accent chrome is opt-in for new installs (spec 3.4). Existing
      // users keep their choice through migrate().
      pixelDesk: false,
      reading: DEFAULT_READING,
      leading: DEFAULT_LEADING,
      sendKey: "enter",
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
      activateProPass: (passCode: string, planTier: PlanTier = "scholar") => {
        set({
          isPro: true,
          planTier,
          activePassCode: passCode.trim(),
          provider: "anthropic",
          anthropicKey: passCode.trim(),
        });
      },
      consumeTokens: (amount: number) => {
        if (amount <= 0) return;
        set((prev) => ({
          tokensUsed: (prev.tokensUsed || 0) + amount,
        }));
      },
      hasProPlan: () => {
        const s = get();
        return Boolean(s.isPro && s.planTier && s.planTier !== "free");
      },
      hasKey: () => {
        const s = get();
        if (s.provider === "anthropic") return s.anthropicKey.trim().length > 10;
        return s.compatBaseUrl.trim().length > 8 && s.compatModel.trim().length > 0;
      },
    }),
    {
      name: "comtus-settings",
      version: 15,
      migrate: migrateSettings,
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
