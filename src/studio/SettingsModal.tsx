import { useEffect, useState, useCallback } from "react";
import {
  ArrowClockwise,
  Bookmark,
  CaretDown,
  CaretUp,
  Check,
  Cpu,
  CreditCard,
  Crown,
  Eye,
  EyeSlash,
  Gauge,
  Key,
  Lightning,
  Plus,
  Sliders,
  Sparkle,
  SpeakerHigh,
  SpeakerSimpleSlash,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { Modal, Field, inputCls, btnLamp, btnGhost, ErrorNote, LampPulse } from "./ui";
import { BorderBeam } from "./fx";
import { useSettings } from "../lib/settings";
import { FONT_PRESETS } from "../lib/fontPresets";
import {
  startAmbient,
  stopAmbient,
  setAmbientVolume,
  getAmbientVolume,
  setSfxVolume,
  getSfxVolume,
  setMuted,
  isMuted,
  getActiveAmbient,
  playSfx as playEngineSfx,
  subscribeAudioEngine,
  type AmbientSoundType,
  type SfxType,
} from "../lib/soundEngine";
import {
  EFFORTS,
  COMPAT_PRESETS,
  validateConnection,
  listCompatModels,
  friendlyError,
  type CallSettings,
} from "../lib/llm";
import type { ProviderId, StoredKey } from "../lib/types";
import { STUDY_PLANS, decodePassInfo, planTierForRequests, type StudyPlan } from "../lib/paypal";
import PayPalCheckout from "./PayPalCheckout";
import DataTrustPanel from "./DataTrustPanel";
import SubscriptionConnect from "./SubscriptionConnect";
import { isTauri } from "../lib/desktop";
import { requestUpdateCheck } from "./useUpdater";
import { startOpenRouterOAuth } from "../lib/openrouterAuth";

/* Curated, verified working free study models for the Starter / Basic view */
export interface CuratedFreeModel {
  id: string;
  name: string;
  badge: string;
  badgeType: "popular" | "speed" | "vision" | "logic" | "math" | "auto";
  desc: string;
  bestFor: string;
  context: string;
  icon: typeof Sparkle;
}

export const CURATED_FREE_MODELS: CuratedFreeModel[] = [
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots3-Note Synthesizer",
    badge: "Top Pick for Notes",
    badgeType: "popular",
    desc: "Best for reading uploaded PDFs, synthesizing multi-chapter notes, and creating study outlines.",
    bestFor: "Lecture Notes & Reading",
    context: "512k Context",
    icon: Sparkle,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning",
    badge: "500+ tok/s · 1M Ctx",
    badgeType: "speed",
    desc: "Fastest engine. Best for instant flashcard drills, rapid Q&A, and indexing entire syllabi.",
    bestFor: "Flashcards & Speed Drills",
    context: "1M Context",
    icon: Lightning,
  },
  {
    id: "poolside/laguna-s-2.1:free",
    name: "Poolside Laguna STEM",
    badge: "Math & Code Drills",
    badgeType: "math",
    desc: "Formulates step-by-step mathematical proofs, LaTeX equations, and programming logic.",
    bestFor: "Math & Code Solutions",
    context: "262k Context",
    icon: Cpu,
  },
  {
    id: "openrouter/free",
    name: "Auto Free Router",
    badge: "Auto-Fallback",
    badgeType: "auto",
    desc: "Automatically routes your prompts to the healthiest, lowest-latency free model available.",
    bestFor: "Always-Available Study",
    context: "Dynamic Failover",
    icon: ArrowClockwise,
  },
];


export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const s = useSettings();
  // Draft state mirrors the store; "Save & test" validates before committing.
  const [draft, setDraft] = useState(() => snapshot(s));
  const [settingsMode, setSettingsMode] = useState<"starter" | "advanced" | "smarter">(
    s.provider === "anthropic" ? "smarter" : "starter"
  );
  const [manualKeyOpen, setManualKeyOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const snap = snapshot(useSettings.getState());
      setDraft(snap);
      if (snap.provider === "anthropic") {
        setSettingsMode("smarter");
      }
    }
  }, [open]);

  const [showCompatKey, setShowCompatKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [okProvider, setOkProvider] = useState<ProviderId | null>(null);
  const [err, setErr] = useState("");
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [modelsNote, setModelsNote] = useState("");
  const [, setLastFetchedAt] = useState<number | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan>(STUDY_PLANS[1]);

  // Multiple Stored Keys state
  const storedKeys = useSettings((st) => st.storedKeys) ?? [];
  const addStoredKey = useSettings((st) => st.addStoredKey);
  const removeStoredKey = useSettings((st) => st.removeStoredKey);
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyProvider, setNewKeyProvider] = useState<StoredKey["provider"]>("openrouter");
  const [newKeyVal, setNewKeyVal] = useState("");
  const [newKeyBaseUrl, setNewKeyBaseUrl] = useState("https://openrouter.ai/api/v1");
  const [newKeyModel, setNewKeyModel] = useState("dots-studio/dots-3-note-preview:free");
  const [quickSaveName, setQuickSaveName] = useState("");
  const closeAddKeyModal = useCallback(() => setShowAddKeyModal(false), []);

  const theme = useSettings((st) => st.theme) ?? "light";
  const motionMode = useSettings((st) => st.motionMode) ?? "full";
  const companionOn = useSettings((st) => st.companion !== false);
  const sfxOn = useSettings((st) => st.companionSfx !== false);
  const pixelOn = useSettings((st) => st.pixelDesk !== false);
  const fontPreset = useSettings((st) => st.fontPreset);

  // Procedural Sound Engine state
  const [audioMuted, setAudioMuted] = useState(() => isMuted());
  const [ambientType, setAmbientType] = useState<AmbientSoundType | null>(() => getActiveAmbient());
  const [ambientVol, setAmbientVol] = useState(() => getAmbientVolume());
  const [sfxVol, setSfxVol] = useState(() => getSfxVolume());

  useEffect(() => {
    return subscribeAudioEngine((state) => {
      setAudioMuted(state.muted);
      setAmbientType(state.activeAmbient);
      setAmbientVol(state.ambientVolume);
      setSfxVol(state.sfxVolume);
    });
  }, []);

  // Live model sync for advanced mode
  useEffect(() => {
    if (!open || draft.provider !== "openai-compatible" || !draft.compatBaseUrl.trim()) return;
    const isLocal = draft.compatBaseUrl.includes("localhost") || draft.compatBaseUrl.includes("127.0.0.1");
    if (!isLocal && !draft.compatKey.trim() && !draft.compatBaseUrl.includes("openrouter")) return;

    let cancel = false;
    const requestedBase = draft.compatBaseUrl.trim();
    const runFetch = async () => {
      setFetchingModels(true);
      try {
        const ids = await listCompatModels(draft.compatKey.trim(), requestedBase);
        if (!cancel && ids.length > 0 && draft.compatBaseUrl.trim() === requestedBase) {
          setModelIds(ids);
          setLastFetchedAt(Date.now());
          setModelsNote(`${ids.length} models auto-updated live from endpoint.`);
        }
      } catch {
        // Silent fallback in background
      } finally {
        if (!cancel) setFetchingModels(false);
      }
    };

    const timer = setTimeout(runFetch, 350);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [open, draft.provider, draft.compatBaseUrl, draft.compatKey]);

  const set = (patch: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setOkProvider(null);
    setErr("");
  };

  const activeSettings = (): CallSettings =>
    draft.provider === "anthropic"
      ? {
          provider: "anthropic",
          apiKey: draft.anthropicKey.trim(),
          baseUrl: draft.anthropicBaseUrl.trim(),
          model: draft.anthropicModel,
          effort: draft.effort,
        }
      : {
          provider: "openai-compatible",
          apiKey: draft.compatKey.trim(),
          baseUrl: draft.compatBaseUrl.trim() || "https://openrouter.ai/api/v1",
          model: draft.compatModel.trim() || "dots-studio/dots-3-note-preview:free",
          effort: draft.effort,
        };

  const saveAndTest = async () => {
    setErr("");
    setOkProvider(null);
    // Subscription sign-ins are validated at connect time — just persist
    // shared preferences and leave the provider untouched.
    if (draft.provider === "claude-oauth" || draft.provider === "codex") {
      useSettings.getState().update({ effort: draft.effort });
      setOkProvider(draft.provider);
      return;
    }
    const cs = activeSettings();
    if (cs.provider === "openai-compatible" && !/^https?:\/\//i.test(cs.baseUrl)) {
      setErr("The base URL must be a full http(s) URL, including /v1.");
      return;
    }
    setTesting(true);
    const result = await validateConnection(cs);
    setTesting(false);
    if (!result.ok) {
      setErr(result.error);
      return;
    }
    useSettings.getState().update({
      provider: cs.provider,
      anthropicKey: cs.provider === "anthropic" ? cs.apiKey : draft.anthropicKey.trim(),
      anthropicBaseUrl: draft.anthropicBaseUrl.trim(),
      anthropicModel: draft.anthropicModel,
      compatKey: cs.provider === "openai-compatible" ? cs.apiKey : draft.compatKey.trim(),
      compatBaseUrl: draft.compatBaseUrl.trim() || "https://openrouter.ai/api/v1",
      compatModel: draft.compatModel.trim() || "dots-studio/dots-3-note-preview:free",
      effort: draft.effort,
    });
    if (cs.provider === "anthropic" && cs.apiKey) {
      const passInfo = decodePassInfo(cs.apiKey);
      useSettings
        .getState()
        .activateProPass(
          cs.apiKey,
          passInfo ? planTierForRequests(passInfo.requests) : selectedPlan.id,
          passInfo?.requests,
        );
    }
    if (cs.provider === "openai-compatible" && cs.model) {
      useSettings.getState().addRecentModel(cs.model);
    }
    setOkProvider(cs.provider);
  };

  const maskKey = (k: string) => {
    if (!k || !k.trim()) return "(local / no key)";
    if (k.length <= 12) return "••••••••";
    return `${k.slice(0, 8)}…${k.slice(-4)}`;
  };

  const handleSaveCurrentKey = () => {
    const keyVal = draft.compatKey.trim();
    if (!keyVal) return;
    const name =
      quickSaveName.trim() ||
      (draft.compatBaseUrl.includes("groq")
        ? "Groq Key"
        : draft.compatBaseUrl.includes("deepseek")
          ? "DeepSeek Key"
          : draft.compatBaseUrl.includes("openrouter")
            ? "OpenRouter Key"
            : draft.compatBaseUrl.includes("opencode")
              ? "OpenCode Zen Key"
              : draft.compatBaseUrl.includes("cerebras")
                ? "Cerebras Key"
                : "Custom BYOK Key");

    const provider: StoredKey["provider"] = draft.compatBaseUrl.includes("groq")
      ? "groq"
      : draft.compatBaseUrl.includes("deepseek")
        ? "deepseek"
        : draft.compatBaseUrl.includes("openrouter")
          ? "openrouter"
          : draft.compatBaseUrl.includes("opencode")
            ? "zen"
            : draft.compatBaseUrl.includes("cerebras")
              ? "cerebras"
              : "custom";

    addStoredKey({
      name,
      provider,
      apiKey: keyVal,
      baseUrl: draft.compatBaseUrl.trim() || "https://openrouter.ai/api/v1",
      defaultModel: draft.compatModel.trim() || "dots-studio/dots-3-note-preview:free",
    });
    setQuickSaveName("");
  };

  const handleAddNewKey = () => {
    if (!newKeyName.trim()) return;
    addStoredKey({
      name: newKeyName.trim(),
      provider: newKeyProvider,
      apiKey: newKeyVal.trim(),
      baseUrl: newKeyBaseUrl.trim() || "https://openrouter.ai/api/v1",
      defaultModel: newKeyModel.trim() || "dots-studio/dots-3-note-preview:free",
    });
    setNewKeyName("");
    setNewKeyVal("");
    setShowAddKeyModal(false);
  };

  const handleProviderPresetChange = (p: StoredKey["provider"]) => {
    setNewKeyProvider(p);
    if (p === "openrouter") {
      setNewKeyBaseUrl("https://openrouter.ai/api/v1");
      setNewKeyModel("dots-studio/dots-3-note-preview:free");
    } else if (p === "groq") {
      setNewKeyBaseUrl("https://api.groq.com/openai/v1");
      setNewKeyModel("llama-3.3-70b-versatile");
    } else if (p === "deepseek") {
      setNewKeyBaseUrl("https://api.deepseek.com/v1");
      setNewKeyModel("deepseek-reasoner");
    } else if (p === "together") {
      setNewKeyBaseUrl("https://api.together.xyz/v1");
      setNewKeyModel("meta-llama/Llama-3.3-70B-Instruct-Turbo");
    } else if (p === "ollama") {
      setNewKeyBaseUrl("http://localhost:11434/v1");
      setNewKeyModel("llama3.3");
    } else if (p === "zen") {
      setNewKeyBaseUrl("https://opencode.ai/zen/v1");
      setNewKeyModel("qwen3-coder");
    } else if (p === "cerebras") {
      setNewKeyBaseUrl("https://api.cerebras.ai/v1");
      setNewKeyModel("llama-3.3-70b");
    }
  };

  const fetchModels = async () => {
    setErr("");
    setModelsNote("");
    setFetchingModels(true);
    try {
      const ids = await listCompatModels(draft.compatKey.trim(), draft.compatBaseUrl.trim());
      setModelIds(ids);
      setLastFetchedAt(Date.now());
      setModelsNote(
        ids.length
          ? `${ids.length} models found — select from the list below or search.`
          : "The endpoint listed no models — type a model id manually.",
      );
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setFetchingModels(false);
    }
  };

  const filteredModelIds = modelIds.filter((id) =>
    filterQuery ? id.toLowerCase().includes(filterQuery.toLowerCase()) : true
  );

  const isOpenRouterConnected =
    draft.provider === "openai-compatible" &&
    draft.compatBaseUrl.includes("openrouter") &&
    draft.compatKey.trim().length > 0;

  return (
    <>
      <Modal open={open} onClose={onClose} title="Settings & AI Models" wide>
        <div className="space-y-6">
          {/* Appearance Switcher */}
          <div>
            <div className="label-mono !text-[10px] mb-2">Appearance</div>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-hairline bg-ground/60 p-1">
              {(
                [
                  ["system", "System"],
                  ["dark", "Dark"],
                  ["light", "Daylight"],
                ] as const
              ).map(([id, label]) => {
                const active = theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => useSettings.getState().update({ theme: id })}
                    className={`flex min-h-[40px] items-center justify-center rounded-lg px-3 py-2 text-body font-medium transition-all active:scale-[0.97] ${
                      active
                        ? "grad-lamp font-semibold text-night shadow-[0_2px_12px_color-mix(in_srgb,var(--brass)_25%,transparent)]"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="label-mono !text-[10px] mb-2">Typography</div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
              Curated font systems for the studio — each pairs a display, body, and mono face. Pixelify appears only as display accents in Pixel Signal, never as body text.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 rounded-xl border border-hairline bg-ground/60 p-1">
              {FONT_PRESETS.map((preset) => {
                const active = (fontPreset ?? "instrument") === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => useSettings.getState().update({ fontPreset: preset.id })}
                    className={`flex min-h-[52px] flex-col items-start justify-center rounded-lg px-3 py-2 text-left transition-all active:scale-[0.97] ${
                      active
                        ? "grad-lamp shadow-[0_2px_12px_color-mix(in_srgb,var(--brass)_25%,transparent)]"
                        : "hover:bg-surface/60"
                    }`}
                  >
                    <span
                      className={`text-[15px] leading-tight ${active ? "font-semibold text-night" : "text-ink"}`}
                      style={{ fontFamily: preset.previewFamily }}
                    >
                      {preset.label}
                    </span>
                    <span className={`text-[11px] leading-tight ${active ? "text-night/70" : "text-muted"}`}>
                      {preset.tagline}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="label-mono !text-[10px] mb-2">Desk chrome</div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
              Cozy Pixel Bookshop applies 16-bit tactile ink-press physics and warm brass-bevel chrome across the studio. Scholar Study restores classic paper surfaces.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 rounded-xl border border-hairline bg-ground/60 p-1">
              <button
                type="button"
                onClick={() => useSettings.getState().update({ pixelDesk: true })}
                className={`flex min-h-[40px] items-center justify-center rounded-lg px-3 py-2 text-body font-medium transition-all active:scale-[0.97] ${
                  pixelOn
                    ? "grad-lamp font-semibold text-night shadow-[0_2px_12px_color-mix(in_srgb,var(--brass)_25%,transparent)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                Cozy Pixel Bookshop (Default)
              </button>
              <button
                type="button"
                onClick={() => useSettings.getState().update({ pixelDesk: false })}
                className={`flex min-h-[40px] items-center justify-center rounded-lg px-3 py-2 text-body font-medium transition-all active:scale-[0.97] ${
                  !pixelOn
                    ? "grad-lamp font-semibold text-night shadow-[0_2px_12px_color-mix(in_srgb,var(--brass)_25%,transparent)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                Scholar Study (Classic Serif)
              </button>
            </div>
          </div>

          <div>
            <div className="label-mono !text-[10px] mb-2">Atmosphere & motion</div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
              Choose your interaction intensity. Full Tactile provides book-press deals, warm spark motes, and milestone glints.
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-hairline bg-ground/60 p-1">
              {(
                [
                  ["none", "None", "Focus / Static"],
                  ["minimal", "Minimal", "Quiet Scholar"],
                  ["full", "Full Tactile", "Tactile & Particles"],
                ] as const
              ).map(([id, label]) => {
                const active = motionMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => useSettings.getState().update({ motionMode: id })}
                    className={`flex min-h-[40px] flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-all active:scale-[0.97] ${
                      active
                        ? "grad-lamp font-semibold text-night shadow-[0_2px_12px_color-mix(in_srgb,var(--brass)_25%,transparent)]"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    <span className="text-body font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>



          <div>
            <div className="label-mono !text-[10px] mb-2">Desk companion</div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
              An energetic 16-bit warm brass battery companion that rests on your desk, celebrates study milestones, and keeps you company during long review sessions. Drag anywhere or double-click to reset.
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-hairline bg-ground/60 p-1">
              <button
                type="button"
                onClick={() => useSettings.getState().update({ companion: !companionOn })}
                className={`flex min-h-[40px] items-center justify-center rounded-lg px-3 py-2 text-body font-medium transition-all active:scale-[0.97] ${
                  companionOn
                    ? "grad-lamp font-semibold text-night shadow-[0_2px_12px_color-mix(in_srgb,var(--brass)_25%,transparent)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                Battery {companionOn ? "on" : "off"}
              </button>
              <button
                type="button"
                onClick={() => useSettings.getState().update({ companionSfx: !sfxOn })}
                className={`flex min-h-[40px] items-center justify-center rounded-lg px-3 py-2 text-body font-medium transition-all active:scale-[0.97] ${
                  sfxOn
                    ? "grad-lamp font-semibold text-night shadow-[0_2px_12px_color-mix(in_srgb,var(--brass)_25%,transparent)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                Chimes {sfxOn ? "on" : "off"}
              </button>
            </div>
          </div>

          {/* Ambient Soundscape & Tactile Audio Section */}
          <div className="rounded-2xl border border-hairline bg-surface/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brass/20 text-brass">
                    {audioMuted ? <SpeakerSimpleSlash size={14} /> : <SpeakerHigh size={14} />}
                  </span>
                  <span className="font-display text-[14px] font-medium text-ink">
                    Ambient Soundscape & Tactile Audio
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  Procedural, zero-download audio synthesizers for deep study focus and tactile micro-interactions.
                </p>
              </div>

              {/* Master Mute Button */}
              <button
                type="button"
                onClick={() => {
                  const next = !audioMuted;
                  setMuted(next);
                  if (!next) {
                    playEngineSfx("lampChime");
                  }
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[11px] font-semibold transition-all active:scale-[0.97] ${
                  !audioMuted
                    ? "border-sage/40 bg-sage/15 text-sage"
                    : "border-hairline bg-ground/80 text-muted hover:text-ink"
                }`}
              >
                {audioMuted ? <SpeakerSimpleSlash size={13} /> : <SpeakerHigh size={13} />}
                <span>{audioMuted ? "Muted (Default)" : "Sound On"}</span>
              </button>
            </div>

            {/* Ambient Sound Generator Picker */}
            <div>
              <div className="label-mono !text-[10px] mb-2 flex items-center justify-between">
                <span>Ambient Generator</span>
                {ambientType && (
                  <span className="text-sage font-mono text-[9px] uppercase tracking-wider">
                    ● Synthesizing {ambientType}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 rounded-xl border border-hairline bg-ground/60 p-1">
                {(
                  [
                    [null, "Off", "None"],
                    ["rain", "Rain", "Pink Noise"],
                    ["fireplace", "Fireplace", "Crackling"],
                    ["lofi", "Lo-Fi", "Chords Pad"],
                    ["all", "Hearth", "Full Mix"],
                  ] as const
                ).map(([type, label, sub]) => {
                  const active = ambientType === type;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        if (type === null) {
                          stopAmbient();
                        } else {
                          startAmbient(type as AmbientSoundType);
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-all active:scale-[0.97] ${
                        active
                          ? "grad-lamp font-semibold text-night shadow-[0_2px_12px_color-mix(in_srgb,var(--brass)_25%,transparent)]"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      <span className="text-body font-medium text-[12px]">{label}</span>
                      <span className={`text-[9px] font-mono opacity-70 ${active ? "text-night" : "text-muted"}`}>{sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Volume Sliders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-mono text-muted">Ambient Volume</span>
                  <span className="font-mono text-ink">{Math.round(ambientVol * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ambientVol}
                  onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                  className="w-full accent-brass cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-mono text-muted">Tactile SFX Volume</span>
                  <span className="font-mono text-ink">{Math.round(sfxVol * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sfxVol}
                  onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                  className="w-full accent-brass cursor-pointer"
                />
              </div>
            </div>

            {/* Tactile SFX Previews */}
            <div className="pt-2 border-t border-hairline/60">
              <div className="label-mono !text-[10px] mb-2">Tactile SFX Preview</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {(
                  [
                    ["inkPress", "Ink Tap"],
                    ["pageTurn", "Page Turn"],
                    ["quillScratch", "Quill"],
                    ["lampChime", "Lamp Bell"],
                    ["sparkPop", "Spark Pop"],
                    ["celebration", "Arpeggio"],
                  ] as const
                ).map(([sfxId, label]) => (
                  <button
                    key={sfxId}
                    type="button"
                    onClick={() => {
                      if (audioMuted) setMuted(false);
                      playEngineSfx(sfxId as SfxType);
                    }}
                    className="flex min-h-[32px] items-center justify-center rounded-lg border border-hairline bg-ground/40 px-2 py-1 text-[11px] font-mono text-muted hover:border-brass/40 hover:text-ink transition-all active:scale-[0.96]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Top Mode Segmented Control: Starter vs. Advanced vs. Smarter Models */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label-mono !text-[10px]">AI Model Configuration Mode</div>
              <span className="font-mono text-[10px] text-muted">
                {settingsMode === "starter"
                  ? "Zero technical setup"
                  : settingsMode === "advanced"
                    ? "Developer / BYOK vault"
                    : "Managed Claude passes"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 rounded-2xl border border-hairline bg-surface p-1.5">
              {/* Starter Tab */}
              <button
                type="button"
                onClick={() => {
                  setSettingsMode("starter");
                  set({
                    provider: "openai-compatible",
                    compatBaseUrl: draft.compatBaseUrl || "https://openrouter.ai/api/v1",
                  });
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-[13px] font-medium transition-all active:scale-[0.98] ${
                  settingsMode === "starter"
                    ? "border border-brass/50 bg-brass/20 text-brasspale font-semibold shadow-[0_2px_12px_rgba(227,176,75,0.15)]"
                    : "text-muted hover:text-ink hover:bg-ink/[0.03]"
                }`}
              >
                <Sparkle size={15} weight={settingsMode === "starter" ? "fill" : "regular"} className="text-brass" />
                <span>Basic (Free Models)</span>
                <span className="rounded-full bg-sage/20 border border-sage/30 px-1.5 py-0.2 font-mono text-[8.5px] uppercase tracking-wider text-sage font-bold">
                  Starter
                </span>
              </button>

              {/* Advanced Tab */}
              <button
                type="button"
                onClick={() => {
                  setSettingsMode("advanced");
                  set({ provider: "openai-compatible" });
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-[13px] font-medium transition-all active:scale-[0.98] ${
                  settingsMode === "advanced"
                    ? "border border-brass/50 bg-brass/20 text-brasspale font-semibold shadow-[0_2px_12px_rgba(227,176,75,0.15)]"
                    : "text-muted hover:text-ink hover:bg-ink/[0.03]"
                }`}
              >
                <Sliders size={15} weight={settingsMode === "advanced" ? "fill" : "regular"} className="text-brass" />
                <span>Advanced BYOK</span>
                <span className="rounded-full bg-ink/10 border border-hairline px-1.5 py-0.2 font-mono text-[8.5px] uppercase tracking-wider text-muted font-bold">
                  Technical
                </span>
              </button>

              {/* Smarter Models (Claude Passes) Tab */}
              <button
                type="button"
                onClick={() => {
                  setSettingsMode("smarter");
                  set({ provider: "anthropic" });
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-[13px] font-medium transition-all active:scale-[0.98] ${
                  settingsMode === "smarter"
                    ? "border border-brass/50 bg-brass/20 text-brasspale font-semibold shadow-[0_2px_12px_rgba(227,176,75,0.15)]"
                    : "text-muted hover:text-ink hover:bg-ink/[0.03]"
                }`}
              >
                <Crown size={15} weight={settingsMode === "smarter" ? "fill" : "regular"} className="text-brass" />
                <span>Smarter Models</span>
                <span className="rounded-full bg-brass/20 border border-brass/35 px-1.5 py-0.2 font-mono text-[8.5px] uppercase tracking-wider text-brasspale font-bold">
                  Opus 5
                </span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              VIEW 1: STARTER / BASIC MODE (Easy, Clean, Curated Free Models)
             ========================================================================= */}
          {settingsMode === "starter" && (
            <div key={settingsMode} className="space-y-5 anim-fade anim-fade--fast">
              {/* 1-Click OpenRouter Connect Hero Box */}
              <div className="overflow-hidden rounded-2xl border border-brass/40 bg-gradient-to-b from-brass/[0.12] to-brass/[0.03] p-4.5 shadow-[0_4px_24px_rgba(227,176,75,0.09)] space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brass/25 text-brass">
                        <Sparkle size={15} weight="fill" />
                      </span>
                      <span className="font-display text-[15px] font-[480] text-ink">
                        Connect Free AI Models (OpenRouter)
                      </span>
                      {isOpenRouterConnected ? (
                        <span className="flex items-center gap-1 rounded-full bg-sage/20 border border-sage/35 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sage font-semibold">
                          <Check size={10} /> Key Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-sage/15 border border-sage/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sage font-semibold">
                          100% Free
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-muted leading-relaxed">
                      {isOpenRouterConnected
                        ? "Your OpenRouter connection is active and ready. Click below if you ever want to re-authorize or refresh keys."
                        : "Authorize in 1 click using Google or GitHub. Comtus generates and configures your key in the background with zero copy-pasting."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void startOpenRouterOAuth()}
                    className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-brass px-4.5 py-2.5 font-mono text-[12px] font-semibold text-night shadow-[0_2px_14px_rgba(227,176,75,0.25)] hover:bg-brasspale hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Sparkle size={14} weight="fill" />
                    <span>{isOpenRouterConnected ? "Re-authorize (1-Click)" : "Connect with Google / GitHub →"}</span>
                  </button>
                </div>

                {/* Optional Manual Key input for users who have a key */}
                <div className="pt-2 border-t border-brass/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11.5px] text-muted">
                  <span>Already have an OpenRouter key from another app?</span>
                  <button
                    type="button"
                    onClick={() => setManualKeyOpen((v) => !v)}
                    className="font-mono text-brasspale hover:underline flex items-center gap-1"
                  >
                    <span>{manualKeyOpen ? "Hide manual key field" : "Paste key manually"}</span>
                    {manualKeyOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
                  </button>
                </div>

                {manualKeyOpen && (
                  <div className="pt-1.5">
                    <input
                      type="password"
                      value={draft.compatKey}
                      onChange={(e) =>
                        set({
                          compatKey: e.target.value,
                          compatBaseUrl: "https://openrouter.ai/api/v1",
                        })
                      }
                      placeholder="sk-or-v1-..."
                      className={inputCls + " font-mono text-[12.5px]"}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>

              {/* Subscription sign-ins — Claude Pro/Max & ChatGPT (Codex) */}
              <SubscriptionConnect />

              {/* Curated Free Models Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[15px] font-[450] text-ink">
                      Choose Your Free Study Engine:
                    </span>
                    <span className="font-mono text-[10px] text-sage bg-sage/10 border border-sage/25 px-2 py-0.5 rounded-full">
                      All 100% Free
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-muted">
                    Click to select
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {CURATED_FREE_MODELS.map((model) => {
                    const isSelected =
                      draft.provider === "openai-compatible" &&
                      (draft.compatModel === model.id ||
                        (model.id === "dots-studio/dots-3-note-preview:free" && !draft.compatModel));
                    const Icon = model.icon;

                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          set({
                            provider: "openai-compatible",
                            compatBaseUrl: "https://openrouter.ai/api/v1",
                            compatModel: model.id,
                          });
                        }}
                        className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                          isSelected
                            ? "border-brass/70 bg-brass/[0.12] shadow-[0_0_24px_rgba(227,176,75,0.16)] ring-1 ring-brass/50"
                            : "border-hairline bg-ground/50 hover:border-hairline-strong hover:bg-ground/80"
                        }`}
                      >
                        {/* Top Indicator bar */}
                        <div
                          aria-hidden
                          className={`pointer-events-none absolute inset-x-3 top-0 z-[1] h-[2px] origin-left rounded-full grad-lamp transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] ${
                            isSelected ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                          }`}
                        />

                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                                isSelected
                                  ? "border-brass/50 bg-brass/25 text-brasspale"
                                  : "border-hairline bg-white/[0.04] text-muted group-hover:text-ink"
                              }`}
                            >
                              <Icon size={16} weight={isSelected ? "fill" : "regular"} />
                            </span>
                            <div>
                              <div className="font-display text-[14px] font-[500] text-ink leading-tight">
                                {model.name}
                              </div>
                              <div className="font-mono text-[10px] text-muted/80 mt-0.5">
                                {model.bestFor}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold shrink-0 ${
                              isSelected
                                ? "bg-brass/25 border border-brass/40 text-brasspale"
                                : "bg-ink/[0.04] border border-hairline text-muted"
                            }`}
                          >
                            {model.badge}
                          </span>
                        </div>

                        <p className="mt-2.5 text-[11.5px] leading-snug text-muted">
                          {model.desc}
                        </p>

                        <div className="mt-3 pt-2.5 border-t border-hairline/60 flex items-center justify-between font-mono text-[10.5px]">
                          <span className="text-muted/70">{model.context}</span>
                          {isSelected ? (
                            <span className="flex items-center gap-1 font-semibold text-brasspale">
                              <Check size={12} weight="bold" /> Active Model
                            </span>
                          ) : (
                            <span className="text-muted/50 group-hover:text-ink transition-colors">
                              Select model →
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fair-use Notice & Advanced Link */}
              <div className="rounded-xl border border-hairline bg-surface/40 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-[11.5px] text-muted">
                <span>
                  Free models share OpenRouter's public compute pools (resets 00:00 UTC).
                </span>
                <button
                  type="button"
                  onClick={() => setSettingsMode("advanced")}
                  className="font-mono text-brasspale hover:underline flex items-center gap-1 shrink-0"
                >
                  <Sliders size={13} />
                  <span>Switch to Advanced BYOK & Vault →</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 2: ADVANCED BYOK (Power Users, Stored Keys, Custom Endpoints)
             ========================================================================= */}
          {settingsMode === "advanced" && (
            <div key={settingsMode} className="space-y-6 anim-fade anim-fade--fast">
              {/* Back to Starter mode banner */}
              <div className="rounded-xl border border-hairline bg-surface p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12.5px] text-ink">
                  <Sliders size={15} className="text-brass shrink-0" />
                  <span>Advanced Settings Mode is active.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsMode("starter")}
                  className="font-mono text-[11px] text-brasspale hover:underline flex items-center gap-1"
                >
                  <span>← Back to Simple Model Picker</span>
                </button>
              </div>

              {/* Saved BYOK Keys Vault */}
              <div className="overflow-hidden rounded-xl border border-hairline bg-ink/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key size={15} className="text-brass shrink-0" />
                    <span className="text-[13px] font-medium text-ink">
                      Stored BYOK Keys Vault ({storedKeys.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddKeyModal(true)}
                    className="flex items-center gap-1 rounded-lg border border-brass/30 bg-brass/10 px-2.5 py-1 font-mono text-[11px] text-brasspale hover:bg-brass/20 transition-colors"
                  >
                    <Plus size={12} /> Add Key to Vault
                  </button>
                </div>

                {storedKeys.length === 0 ? (
                  <p className="text-[11.5px] leading-relaxed text-muted">
                    No stored keys yet. Save multiple OpenRouter, Groq, or DeepSeek API keys below to switch between them in 1 click.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {storedKeys.map((k) => {
                      const isActive =
                        draft.compatKey.trim() === k.apiKey.trim() &&
                        draft.compatBaseUrl.trim() === k.baseUrl.trim();
                      return (
                        <div
                          key={k.id}
                          className={`rounded-xl border p-2.5 flex flex-col justify-between transition-all ${
                            isActive
                              ? "border-brass/60 bg-brass/[0.09] shadow-[0_0_15px_rgba(227,176,75,0.1)]"
                              : "border-hairline bg-ground/60 hover:border-hairline-strong"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-medium text-[12.5px] text-ink truncate">
                                {k.name}
                              </span>
                              <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-ink/5 text-muted border border-hairline shrink-0">
                                {k.provider}
                              </span>
                            </div>
                            <div className="mt-1 font-mono text-[11px] text-brasspale/90 truncate">
                              {maskKey(k.apiKey)}
                            </div>
                            {k.defaultModel && (
                              <div className="mt-0.5 font-mono text-[10px] text-muted truncate">
                                {k.defaultModel}
                              </div>
                            )}
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-hairline flex items-center justify-between gap-2">
                            {isActive ? (
                              <span className="flex items-center gap-1 font-mono text-[10px] text-sage font-medium">
                                <Check size={11} /> Active Key
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  set({
                                    compatKey: k.apiKey,
                                    compatBaseUrl: k.baseUrl,
                                    compatModel: k.defaultModel || draft.compatModel,
                                  });
                                }}
                                className="font-mono text-[10.5px] text-moon hover:underline"
                              >
                                Use this key →
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeStoredKey(k.id)}
                              className="p-1 text-muted hover:text-rust transition-colors"
                              aria-label={`Delete ${k.name}`}
                            >
                              <Trash size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick Save Current Key Prompt */}
                {draft.compatKey.trim().length > 0 &&
                  !storedKeys.some((k) => k.apiKey.trim() === draft.compatKey.trim()) && (
                    <div className="mt-2 rounded-lg border border-brass/25 bg-brass/[0.05] p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[12px] text-ink">
                        <Bookmark size={13} className="text-brass shrink-0" />
                        <span>Save current key to vault?</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Key name (e.g. Work Key)"
                          value={quickSaveName}
                          onChange={(e) => setQuickSaveName(e.target.value)}
                          className="rounded border border-hairline bg-surface px-2 py-0.5 text-[11px] font-mono text-ink placeholder:text-muted/50 outline-none focus:border-brass/40"
                        />
                        <button
                          type="button"
                          onClick={handleSaveCurrentKey}
                          className="rounded bg-brass/20 hover:bg-brass/30 px-2 py-0.5 font-mono text-[10.5px] text-brasspale font-medium transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
              </div>

              {/* Endpoint Presets Grid */}
              <div>
                <div className="label-mono !text-[10px] mb-2">Endpoint Presets</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {COMPAT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        set({ compatBaseUrl: p.baseUrl });
                        setModelIds([]);
                        setModelsNote("");
                        setLastFetchedAt(null);
                      }}
                      className={`min-h-[50px] rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98] ${
                        draft.compatBaseUrl === p.baseUrl
                          ? "border-brass/60 bg-brass/[0.08]"
                          : "border-hairline bg-ink/[0.02] hover:border-hairline-strong"
                      }`}
                    >
                      <div className="font-mono text-[11px] font-medium text-brasspale">{p.label}</div>
                      <div className="mt-0.5 line-clamp-1 text-[10.5px] leading-snug text-muted">{p.note}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Raw API Key & Base URL Inputs */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="API key"
                  hint="Local endpoints (Ollama, LM Studio) don't require a key."
                >
                  <div className="relative">
                    <input
                      type={showCompatKey ? "text" : "password"}
                      value={draft.compatKey}
                      onChange={(e) => set({ compatKey: e.target.value })}
                      placeholder="sk-or-… or gsk_…"
                      className={inputCls + " pr-10 font-mono text-[13px]"}
                      spellCheck={false}
                    />
                    <button
                      onClick={() => setShowCompatKey((v) => !v)}
                      className="flex h-9 w-9 items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                      aria-label={showCompatKey ? "Hide key" : "Show key"}
                    >
                      {showCompatKey ? <EyeSlash size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>

                <Field label="Base URL" hint="Must include /v1 for most endpoints.">
                  <input
                    value={draft.compatBaseUrl}
                    onChange={(e) => set({ compatBaseUrl: e.target.value })}
                    placeholder="https://openrouter.ai/api/v1"
                    className={inputCls + " font-mono text-[13px]"}
                    spellCheck={false}
                  />
                </Field>
              </div>

              {/* Model ID Field with Live Fetcher */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="label-mono !text-[10px]">Model ID</div>
                  <button
                    type="button"
                    onClick={fetchModels}
                    disabled={fetchingModels}
                    className="flex items-center gap-1 font-mono text-[11px] text-brasspale hover:underline disabled:opacity-50"
                  >
                    <ArrowClockwise size={12} className={fetchingModels ? "animate-spin" : ""} />
                    <span>{fetchingModels ? "Fetching…" : "Fetch list from endpoint"}</span>
                  </button>
                </div>

                <input
                  value={draft.compatModel}
                  onChange={(e) => set({ compatModel: e.target.value })}
                  placeholder="dots-studio/dots-3-note-preview:free"
                  className={inputCls + " font-mono text-[13px]"}
                  spellCheck={false}
                />

                {modelsNote && (
                  <p className="mt-1.5 font-mono text-[11px] text-sage">{modelsNote}</p>
                )}

                {/* Model Search & Selection List */}
                {modelIds.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-hairline bg-ground/80 p-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Filter fetched models..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className={inputCls + " text-[12px] py-1.5 font-mono"}
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1 font-mono text-[11.5px]">
                      {filteredModelIds.slice(0, 50).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => set({ compatModel: id })}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                            draft.compatModel === id
                              ? "bg-brass/20 text-brasspale font-medium"
                              : "hover:bg-ink/[0.04] text-muted hover:text-ink"
                          }`}
                        >
                          <span className="truncate">{id}</span>
                          {draft.compatModel === id && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 3: SMARTER MODELS (Claude Opus 5 & Sonnet 5 via PayPal)
             ========================================================================= */}
          {settingsMode === "smarter" && (
            <div key={settingsMode} className="space-y-5 anim-fade anim-fade--fast">
              {(() => {
                const isPro = s.hasProPlan();
                const planTier = s.planTier;
                const tokenBalance = s.tokenBalance || 0;
                const tokensUsed = s.tokensUsed || 0;
                const remaining = Math.max(0, tokenBalance - tokensUsed);
                const percentRemaining = tokenBalance > 0 ? Math.round((remaining / tokenBalance) * 100) : 0;
                const formatTokens = (n: number) => {
                  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
                  return n.toLocaleString();
                };

                if (isPro) {
                  return (
                    <div className="overflow-hidden rounded-2xl border border-brass/40 bg-brass/[0.08] p-4.5 space-y-3.5 shadow-[0_0_20px_rgba(227,176,75,0.08)]">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brass/20 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brass/20 text-brass">
                            <Crown size={18} weight="fill" />
                          </div>
                          <div>
                            <div className="font-display text-[15.5px] font-[500] text-ink flex items-center gap-2">
                              <span>Anthropic Pro Plan Active</span>
                              <span className="rounded bg-brass/25 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-brasspale font-semibold">
                                {planTier.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[11.5px] text-muted">
                              Powered by Claude Opus 5 & Sonnet 5 reasoning models
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-brasspale font-medium">
                          <Gauge size={14} />
                          <span>{formatTokens(remaining)} / {formatTokens(tokenBalance)} requests</span>
                        </div>
                      </div>

                      {/* Request Quota Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono text-muted">
                          <span>Quota: {formatTokens(remaining)} hosted requests left</span>
                          <span className="text-brasspale">{percentRemaining}% available</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface border border-hairline">
                          <div
                            className="h-full bg-gradient-to-r from-brass to-brasspale transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(2, percentRemaining))}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[11.5px] text-muted">
                          Pass Code: <code className="font-mono text-brasspale">{s.activePassCode ? `${s.activePassCode.slice(0, 10)}…` : "Active"}</code>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            s.update({ isPro: false, planTier: "free", provider: "openai-compatible" });
                            set({ provider: "openai-compatible" });
                            setSettingsMode("starter");
                          }}
                          className="text-[11px] font-mono text-muted hover:text-rust transition-colors underline underline-offset-2"
                        >
                          Switch to BYOK Free Tier
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="overflow-hidden rounded-xl border border-brass/30 bg-brass/[0.05] p-4.5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brass/15 pb-3">
                      <div className="flex items-center gap-2">
                        <Crown size={17} className="text-brass shrink-0" />
                        <span className="font-display text-[15px] font-[450] text-ink">
                          Smarter Models (Claude Opus 5 & Sonnet 5)
                        </span>
                      </div>
                      <span className="self-start sm:self-auto rounded-full border border-hairline bg-ink/[0.04] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                        Current Tier: Free BYOK
                      </span>
                    </div>

                    <p className="text-[12.5px] leading-relaxed text-muted">
                      Unlock Claude Opus 5 & Sonnet 5 with managed reasoning tokens. Pay based on your usage via PayPal to instantly receive and activate your personal access pass.
                    </p>

                    {/* Pricing Grid */}
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-brasspale mb-2 font-medium">
                        Select Study Pass & Pay via PayPal:
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        {STUDY_PLANS.map((plan) => {
                          const isPlanSelected = selectedPlan.id === plan.id;
                          return (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={() => setSelectedPlan(plan)}
                              className={`text-left rounded-xl border p-3 flex flex-col justify-between transition-all active:scale-[0.98] ${
                                isPlanSelected
                                  ? "border-brass/70 bg-brass/[0.12] shadow-[0_0_20px_rgba(227,176,75,0.15)] ring-1 ring-brass/40"
                                  : "border-hairline bg-ink/[0.03] hover:border-hairline-strong"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-medium text-ink text-[13.5px]">
                                    {plan.name}
                                  </span>
                                  {plan.popular && (
                                    <span className="rounded bg-brass/25 border border-brass/35 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-brasspale font-semibold shrink-0">
                                      Popular
                                    </span>
                                  )}
                                </div>

                                <div className="mt-1 flex items-baseline justify-between gap-1.5">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="font-mono text-[11px] text-muted/60 line-through">
                                      ${plan.compareAt}
                                    </span>
                                    <span className="font-mono text-brass font-bold text-[14px]">
                                      ${plan.price}
                                    </span>
                                  </div>
                                  <span className="rounded-full border border-sage/30 bg-sage/15 px-1.5 py-0.5 font-mono text-[8.5px] font-medium text-sage shrink-0">
                                    −{Math.round((1 - plan.amount / parseFloat(plan.compareAt)) * 100)}%
                                  </span>
                                </div>

                                <div className="mt-1.5 font-mono text-[10px] text-muted/70">{plan.requests} hosted requests · {plan.days} days</div>
                                <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{plan.desc}</p>
                              </div>
                              {isPlanSelected && (
                                <div className="mt-2 text-right font-mono text-[10px] text-brasspale font-medium">
                                  ✓ Selected
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* PayPal Smart Checkout */}
                    <div className="rounded-xl border border-hairline bg-ground/80 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[12.5px] text-ink font-medium">
                          <CreditCard size={15} className="text-brass shrink-0" />
                          <span>
                            Pay with PayPal: {selectedPlan.name} (${selectedPlan.price} USD)
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-brasspale">{selectedPlan.requests} requests · {selectedPlan.days} days</span>
                      </div>
                      <PayPalCheckout
                        plan={selectedPlan}
                        onSuccess={(passToken) => {
                          // The pass is minted server-side after PayPal capture
                          // verification — the browser only activates what it
                          // received. Its quota/expiry come from the token itself.
                          const info = decodePassInfo(passToken);
                          s.activateProPass(passToken, selectedPlan.id, info?.requests);
                          set({ anthropicKey: passToken });
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Pass Activation Code Box */}
              <Field
                label="Have a Claude Access Pass Code?"
                hint="Paste the comtus-pass-v1… token issued with your PayPal payment."
              >
                <div className="flex gap-2">
                  <input
                    value={draft.anthropicKey}
                    onChange={(e) => set({ anthropicKey: e.target.value })}
                    placeholder="comtus-pass-v1.…"
                    className={inputCls + " font-mono text-[13px] flex-1"}
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const code = draft.anthropicKey.trim();
                      if (code) {
                        // Quota comes from the pass itself; the proxy is the enforcer.
                        const info = decodePassInfo(code);
                        s.activateProPass(code, info ? planTierForRequests(info.requests) : "scholar", info?.requests);
                        set({ provider: "anthropic" });
                      }
                    }}
                    className="rounded-xl bg-brass px-4 py-2 font-mono text-[11px] font-semibold text-night hover:bg-brasspale transition-colors"
                  >
                    Activate
                  </button>
                </div>
              </Field>
            </div>
          )}

          {/* Thinking Effort Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label-mono !text-[10px]">Thinking Effort</div>
              <span className="font-mono text-[10px] text-muted/70">
                Reasoning depth
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl border border-hairline bg-ground/60 p-1.5">
              {EFFORTS.map((e) => {
                const active = draft.effort === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => set({ effort: e.id })}
                    className={`flex min-h-[42px] flex-col items-center justify-center rounded-lg px-2 py-1 text-center transition-all active:scale-[0.97] ${
                      active
                        ? "grad-lamp font-semibold text-night shadow-[0_2px_12px_rgba(227,176,75,0.25)]"
                        : "text-muted hover:text-ink hover:bg-ink/[0.03]"
                    }`}
                  >
                    <span className="text-[12px] font-medium flex items-center gap-1">
                      {e.id === "xhigh" && <Sparkle size={11} className="inline" />}
                      {e.label}
                    </span>
                    <span className={`text-[9px] font-mono uppercase tracking-wider ${active ? "text-night/80" : "text-muted/60"}`}>
                      {e.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {testing && <LampPulse label="Testing the connection…" />}
          {okProvider && (
            <div className="flex items-center gap-2 rounded-xl border border-sage/30 bg-sage/[0.07] px-4 py-3 text-[13px] text-sage">
              <Check size={15} /> Connection verified. Companion fully charged.
            </div>
          )}
          {err && <ErrorNote>{err}</ErrorNote>}

          {/* AI Accuracy Disclaimer */}
          <div className="rounded-xl border border-brass/20 bg-brass/[0.04] p-3.5 text-ink/90">
            <div className="flex items-start gap-2.5">
              <Warning size={16} className="text-brass shrink-0 mt-0.5" />
              <div className="text-[12px] leading-relaxed text-muted">
                <strong className="text-ink font-medium">Important AI Disclaimer:</strong> AI models (including free and open-source models) can make mistakes or hallucinate. Always verify formulas and answers against your syllabus.
              </div>
            </div>
          </div>

          <DataTrustPanel open={open} />

          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted/70">
              Comtus v{__APP_VERSION__}
              {isTauri() ? " · Desk App" : ""}
            </span>
            {isTauri() && (
              <button
                type="button"
                onClick={requestUpdateCheck}
                className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted/70 transition-colors hover:text-brasspale"
              >
                Check for updates
              </button>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button className={btnGhost} onClick={onClose}>
              Done
            </button>
            <button className={btnLamp} onClick={saveAndTest} disabled={testing}>
              <BorderBeam size={52} duration={8} />
              {testing ? "Testing…" : "Save & test"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add New Stored Key Modal */}
      <Modal
        open={showAddKeyModal}
        onClose={closeAddKeyModal}
        title="Add Stored Key to BYOK Vault"
      >
        <div className="space-y-4">
          <Field label="Key Name / Description">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. My Backup OpenRouter Key, Groq High-Speed"
              className={inputCls}
            />
          </Field>

          <Field label="Provider Preset">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["openrouter", "OpenRouter"],
                  ["groq", "Groq"],
                  ["zen", "OpenCode Zen"],
                  ["cerebras", "Cerebras"],
                  ["deepseek", "DeepSeek"],
                  ["together", "Together AI"],
                  ["ollama", "Ollama (Local)"],
                  ["custom", "Custom Endpoint"],
                ] as const
              ).map(([p, label]) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProviderPresetChange(p)}
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors text-left ${
                    newKeyProvider === p
                      ? "border-brass/60 bg-brass/20 text-brasspale font-medium"
                      : "border-hairline bg-ink/[0.02] text-muted hover:border-hairline-strong"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="API Key" hint="Leave empty for local Ollama / LM Studio.">
            <input
              type="password"
              value={newKeyVal}
              onChange={(e) => setNewKeyVal(e.target.value)}
              placeholder="sk-or-v1-… or gsk_…"
              className={inputCls + " font-mono text-[13px]"}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Base URL">
              <input
                value={newKeyBaseUrl}
                onChange={(e) => setNewKeyBaseUrl(e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
                className={inputCls + " font-mono text-[12px]"}
              />
            </Field>

            <Field label="Default Model ID">
              <input
                value={newKeyModel}
                onChange={(e) => setNewKeyModel(e.target.value)}
                placeholder="dots-studio/dots-3-note-preview:free"
                className={inputCls + " font-mono text-[12px]"}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button className={btnGhost} onClick={() => setShowAddKeyModal(false)}>
              Cancel
            </button>
            <button
              className={btnLamp}
              onClick={handleAddNewKey}
              disabled={!newKeyName.trim()}
            >
              Save Key to Vault
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function snapshot(s: ReturnType<typeof useSettings.getState>) {
  return {
    provider: s.provider,
    anthropicKey: s.anthropicKey,
    anthropicBaseUrl: s.anthropicBaseUrl,
    anthropicModel: s.anthropicModel,
    compatKey: s.compatKey,
    compatBaseUrl: s.compatBaseUrl,
    compatModel: s.compatModel,
    effort: s.effort,
  };
}
