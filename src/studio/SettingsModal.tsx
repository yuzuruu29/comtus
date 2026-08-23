import { useEffect, useState } from "react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  Bookmark,
  Brain,
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
  Lock,
  Plus,
  Question,
  ShieldCheck,
  Sparkle,
  Stack,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { Modal, Field, inputCls, btnLamp, btnGhost, ErrorNote, LampPulse } from "./ui";
import { BorderBeam } from "./fx";
import { useSettings } from "../lib/settings";
import {
  MODELS,
  EFFORTS,
  COMPAT_PRESETS,
  validateConnection,
  listCompatModels,
  friendlyError,
  type CallSettings,
} from "../lib/llm";
import type { ProviderId, StoredKey } from "../lib/types";
import { STUDY_PLANS, type StudyPlan } from "../lib/paypal";
import PayPalCheckout from "./PayPalCheckout";
import DataTrustPanel from "./DataTrustPanel";
import { isTauri } from "../lib/desktop";
import { requestUpdateCheck } from "./useUpdater";
import ExternalLink from "./ExternalLink";

/* Free-tier providers highlighted in the picker — one click fills the
   endpoint + a sensible default model; the key link sits beside them. */
const FREE_PROVIDER_CARDS: {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  tag: string;
  desc: string;
  chips: string[];
  keyUrl: string;
  keyLabel: string;
  icon: typeof Sparkle;
}[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "deepseek/deepseek-r1:free",
    tag: "Deep reasoning",
    desc: "DeepSeek R1, Llama 3.3 & Gemini — hundreds of models behind one free key.",
    chips: ["deepseek-r1:free", "llama-3.3-70b:free", "gemini-flash:free"],
    keyUrl: "https://openrouter.ai/keys",
    keyLabel: "openrouter.ai/keys",
    icon: Sparkle,
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    tag: "500+ tok/s",
    desc: "LPU inference with near-zero latency — instant drills and flashcards.",
    chips: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    keyUrl: "https://console.groq.com/keys",
    keyLabel: "console.groq.com/keys",
    icon: Lightning,
  },
  {
    id: "zen",
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    model: "qwen3-coder",
    tag: "Curated free",
    desc: "A verified shortlist of frontier open models on a single free key.",
    chips: ["qwen3-coder", "glm", "kimi"],
    keyUrl: "https://opencode.ai/zen",
    keyLabel: "opencode.ai/zen",
    icon: Stack,
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "llama-3.3-70b",
    tag: "Warp speed",
    desc: "Wafer-scale engines — another very fast free tier for open models.",
    chips: ["llama-3.3-70b", "qwen-3-32b"],
    keyUrl: "https://cloud.cerebras.ai",
    keyLabel: "cloud.cerebras.ai",
    icon: Cpu,
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
  useEffect(() => {
    if (open) setDraft(snapshot(useSettings.getState()));
  }, [open]);

  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showCompatKey, setShowCompatKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [okProvider, setOkProvider] = useState<ProviderId | null>(null);
  const [err, setErr] = useState("");
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [modelsNote, setModelsNote] = useState("");
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [byokGuideOpen, setByokGuideOpen] = useState(false);
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
  const [newKeyModel, setNewKeyModel] = useState("deepseek/deepseek-r1:free");
  const [quickSaveName, setQuickSaveName] = useState("");

  const theme = useSettings((st) => st.theme) ?? "system";
  const recentModels = useSettings((st) => st.recentModels) ?? [];

  // Recurring live sync for OpenAI-compatible endpoints (OpenRouter, Groq, local)
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
          // Drop the response if the user switched endpoints mid-flight —
          // a list must never outlive the base URL it came from.
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
          baseUrl: draft.compatBaseUrl.trim(),
          model: draft.compatModel.trim(),
          effort: draft.effort,
        };

  const saveAndTest = async () => {
    setErr("");
    setOkProvider(null);
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
      compatBaseUrl: draft.compatBaseUrl.trim(),
      compatModel: draft.compatModel.trim(),
      effort: draft.effort,
    });
    if (cs.provider === "anthropic" && cs.apiKey) {
      useSettings.getState().activateProPass(cs.apiKey, selectedPlan.id);
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
      defaultModel: draft.compatModel.trim() || "deepseek/deepseek-r1:free",
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
      defaultModel: newKeyModel.trim() || "deepseek/deepseek-r1:free",
    });
    setNewKeyName("");
    setNewKeyVal("");
    setShowAddKeyModal(false);
  };

  const handleProviderPresetChange = (p: StoredKey["provider"]) => {
    setNewKeyProvider(p);
    if (p === "openrouter") {
      setNewKeyBaseUrl("https://openrouter.ai/api/v1");
      setNewKeyModel("deepseek/deepseek-r1:free");
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

  return (
    <>
      <Modal open={open} onClose={onClose} title="Settings" wide>
      <div className="space-y-6">
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
                  className={`flex min-h-[42px] items-center justify-center rounded-lg px-3 py-2 text-body font-medium transition-all active:scale-[0.97] ${
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
          <p className="mt-2 text-label leading-relaxed text-muted">
            Daylight is a paper-bright study. The landing page stays lamplit.
          </p>
        </div>

        {/* Provider switch */}
        <div>
          <div className="label-mono !text-[10px] mb-2">Provider & Access Tier</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {(
              [
                ["anthropic", "Anthropic Claude (Smarter Models)", "Opus 5 & Sonnet 5 · Hosted Key · PayPal access"],
                ["openai-compatible", "OpenRouter & Free Models (BYOK)", "100% Free (:free) · OpenRouter · Ollama · Free BYOK"],
              ] as const
            ).map(([id, label, note]) => (
              <button
                key={id}
                onClick={() => set({ provider: id })}
                className={`min-h-[52px] rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${
                  draft.provider === id
                    ? "border-brass/60 bg-brass/[0.09] shadow-[0_0_20px_rgba(227,176,75,0.12)]"
                    : "border-hairline bg-ink/[0.02] hover:border-hairline-strong"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[13.5px] font-medium text-ink">{label}</div>
                  {draft.provider === id && (
                    <span className="flex h-2 w-2 rounded-full bg-brass shadow-[0_0_8px_var(--color-brass)]" />
                  )}
                </div>
                <div className="mt-1 text-[11.5px] leading-snug text-muted">{note}</div>
              </button>
            ))}
          </div>
        </div>

        {/* BYOK & Access Guide Banner / Toggle */}
        <div className="overflow-hidden rounded-xl border border-brass/25 bg-brass/[0.04]">
          <button
            type="button"
            onClick={() => setByokGuideOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-brass/[0.08]"
          >
            <div className="flex items-center gap-2.5">
              <Question size={16} className="text-brass shrink-0" />
              <span className="text-[13px] font-medium text-ink">
                Access Guide: Free Models (BYOK) vs. Smarter Models (PayPal Tier)
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px] text-brasspale">
              <span>{byokGuideOpen ? "Hide guide" : "View steps"}</span>
              {byokGuideOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
            </div>
          </button>

          {byokGuideOpen && (
            <div className="border-t border-brass/15 bg-ground/70 p-4.5 text-[12.5px] leading-relaxed text-ink/90 space-y-3.5">
              <div className="flex items-start gap-2.5 rounded-lg border border-sage/20 bg-sage/[0.05] p-3 text-sage text-[12px]">
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Privacy First:</strong> Your notebooks and documents remain stored locally in your browser (IndexedDB). Keys and access tokens are saved only in your device's localStorage.
                </span>
              </div>

              {draft.provider === "anthropic" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-brasspale font-medium">
                    <Lock size={13} className="text-brass" />
                    <span>Smarter Models Access (Anthropic BYOK Disabled):</span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted">
                    To deliver maximum reasoning power with zero complex developer setup, <strong>Anthropic BYOK is disabled</strong>. Smarter models (Claude Opus 5 & Sonnet 5) run directly on our managed key. You simply pay based on usage through PayPal.
                  </p>
                  <div className="rounded-lg border border-brass/25 bg-brass/[0.06] p-3 space-y-2 text-[12px]">
                    <div className="font-medium text-ink flex items-center gap-1.5">
                      <CreditCard size={14} className="text-brass" />
                      <span>How to Unlock Access via PayPal:</span>
                    </div>
                    <ol className="list-decimal pl-5 space-y-1.5 text-muted">
                      <li>Choose your preferred usage pass below based on your study load.</li>
                      <li>Send payment through PayPal to receive your personal Access Pass / Token.</li>
                      <li>Paste the code into the <strong>Access Pass</strong> field below.</li>
                      <li>Click <strong>Save & test</strong> to light the lamp with Claude Opus 5 & Sonnet 5.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="rounded-lg border border-brass/25 bg-brass/[0.06] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-ink flex items-center gap-1.5">
                        <Sparkle size={14} className="text-brass" />
                        <span>Recommended: OpenRouter BYOK (with Free AI Models)</span>
                      </div>
                      <ExternalLink
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-moon text-[11.5px] hover:underline flex items-center gap-1 font-mono"
                      >
                        openrouter.ai/keys <ArrowSquareOut size={11} />
                      </ExternalLink>
                    </div>
                    <ol className="list-decimal pl-5 space-y-1.5 text-muted text-[12px]">
                      <li>
                        Create an account at <ExternalLink href="https://openrouter.ai" className="text-moon hover:underline">openrouter.ai</ExternalLink>.
                      </li>
                      <li>
                        Go to <ExternalLink href="https://openrouter.ai/keys" className="text-moon hover:underline">Keys</ExternalLink>, click <strong>Create Key</strong>, and copy your <code className="text-brasspale">sk-or-v1-...</code> token.
                      </li>
                      <li>
                        Paste the key below with Base URL <code className="text-brasspale">https://openrouter.ai/api/v1</code>.
                      </li>
                      <li>
                        Click <strong>"Fetch list"</strong> to auto-update and load all active models directly from OpenRouter in real-time.
                      </li>
                      <li>
                        Filter by <code className="text-brasspale">:free</code> to use 100% free models like <code className="text-brasspale">deepseek/deepseek-r1:free</code>, <code className="text-brasspale">meta-llama/llama-3.3-70b-instruct:free</code>, or <code className="text-brasspale">openrouter/auto</code>.
                      </li>
                      <li>
                        Click <strong>Save & test</strong> to verify your connection before entering the studio.
                      </li>
                    </ol>
                  </div>

                  <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-brasspale font-medium">
                    All Compatible Providers & Local Endpoints:
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-hairline bg-ink/[0.02] p-3">
                      <div className="font-medium text-ink flex items-center justify-between">
                        <span>1. OpenRouter (Multi-Model & Free)</span>
                        <ExternalLink href="https://openrouter.ai/keys" className="text-moon text-[11px] hover:underline flex items-center gap-0.5">
                          openrouter.ai <ArrowSquareOut size={10} />
                        </ExternalLink>
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted">
                        One key connects DeepSeek R1, Llama 3.3, Claude 3.5, Gemini 2.0, and free models.
                      </p>
                    </div>
                    <div className="rounded-lg border border-hairline bg-ink/[0.02] p-3">
                      <div className="font-medium text-ink flex items-center justify-between">
                        <span>2. Groq (Ultra-Fast Free Tier)</span>
                        <ExternalLink href="https://console.groq.com/keys" className="text-moon text-[11px] hover:underline flex items-center gap-0.5">
                          groq.com <ArrowSquareOut size={10} />
                        </ExternalLink>
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted">
                        Instant, ultra-low latency inference for Llama 3.3 70B and Mixtral.
                      </p>
                    </div>
                    <div className="rounded-lg border border-hairline bg-ink/[0.02] p-3">
                      <div className="font-medium text-ink flex items-center justify-between">
                        <span>3. DeepSeek (Direct)</span>
                        <ExternalLink href="https://platform.deepseek.com/api_keys" className="text-moon text-[11px] hover:underline flex items-center gap-0.5">
                          deepseek.com <ArrowSquareOut size={10} />
                        </ExternalLink>
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted">
                        Ultra-capable direct reasoning models (<code className="text-brasspale">deepseek-reasoner</code>).
                      </p>
                    </div>
                    <div className="rounded-lg border border-hairline bg-ink/[0.02] p-3">
                      <div className="font-medium text-ink flex items-center justify-between">
                        <span>4. Local (Ollama / LM Studio)</span>
                        <span className="text-sage text-[10.5px] font-mono">100% FREE</span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted">
                        Run offline models directly on your hardware. <strong>No key or internet needed.</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 font-mono text-[10.5px]">
                    <span className="uppercase tracking-[0.14em] text-muted/60">More free tiers:</span>
                    <ExternalLink href="https://opencode.ai/zen" className="flex items-center gap-0.5 text-moon hover:underline">
                      OpenCode Zen <ArrowSquareOut size={9} />
                    </ExternalLink>
                    <ExternalLink href="https://cloud.cerebras.ai" className="flex items-center gap-0.5 text-moon hover:underline">
                      Cerebras <ArrowSquareOut size={9} />
                    </ExternalLink>
                    <ExternalLink href="https://aistudio.google.com/apikey" className="flex items-center gap-0.5 text-moon hover:underline">
                      Google AI Studio <ArrowSquareOut size={9} />
                    </ExternalLink>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {draft.provider === "anthropic" ? (
          <>
            {/* Smarter Models / PayPal Managed Tier Banner & Live Status */}
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
                  <div className="overflow-hidden rounded-2xl border border-brass/40 bg-brass/[0.08] p-4 space-y-3.5 shadow-[0_0_20px_rgba(227,176,75,0.08)]">
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
                        <span>{formatTokens(remaining)} / {formatTokens(tokenBalance)} Tokens</span>
                      </div>
                    </div>

                    {/* Token Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono text-muted">
                        <span>Usage: {formatTokens(tokensUsed)} tokens spent</span>
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
                <div className="overflow-hidden rounded-xl border border-brass/30 bg-brass/[0.05] p-4 space-y-3.5">
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

                  {/* Realistic Pricing Grid */}
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
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-ink text-[13px] flex items-center gap-1">
                                  {plan.name}
                                  {plan.popular && (
                                    <span className="rounded bg-brass/25 px-1 py-0.2 font-mono text-[8.5px] text-brasspale uppercase">
                                      Popular
                                    </span>
                                  )}
                                </span>
                                <span className="flex items-baseline gap-1.5">
                                  <span className="font-mono text-[10.5px] text-muted/60 line-through">
                                    ${plan.compareAt}
                                  </span>
                                  <span className="font-mono text-brass font-bold text-[13px]">${plan.price}</span>
                                  <span className="rounded-full border border-sage/25 bg-sage/15 px-1.5 font-mono text-[8.5px] font-medium text-sage">
                                    −{Math.round((1 - plan.amount / parseFloat(plan.compareAt)) * 100)}%
                                  </span>
                                </span>
                              </div>
                              <div className="mt-1 font-mono text-[10px] text-muted/70">{plan.tokens}</div>
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

                  {/* PayPal Smart Checkout Section */}
                  <div className="rounded-xl border border-hairline bg-ground/80 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[12.5px] text-ink font-medium">
                        <CreditCard size={15} className="text-brass shrink-0" />
                        <span>
                          Pay with PayPal: {selectedPlan.name} (${selectedPlan.price} USD ·{" "}
                          <span className="text-sage">
                            save ${(parseFloat(selectedPlan.compareAt) - selectedPlan.amount).toFixed(2)}
                          </span>
                          )
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-brasspale">{selectedPlan.tokens}</span>
                    </div>
                    <PayPalCheckout
                      plan={selectedPlan}
                      onSuccess={(passToken, orderId) => {
                        const tokenStr = passToken || `comtus-pass-${orderId.slice(-8)}`;
                        const tokens = selectedPlan.id === "sprint" ? 500000 : selectedPlan.id === "scholar" ? 1500000 : 3500000;
                        s.activateProPass(tokenStr, selectedPlan.id, tokens);
                        set({ anthropicKey: tokenStr });
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            <Field
              label="PayPal Access Pass / Token Code"
              hint="Enter the Access Pass or Key received with your PayPal payment to activate Claude models on our hosted key."
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showAnthropicKey ? "text" : "password"}
                    value={draft.anthropicKey}
                    onChange={(e) => set({ anthropicKey: e.target.value })}
                    placeholder="e.g. comtus-pass-… (or sk-ant-…)"
                    className={inputCls + " pr-10 font-mono text-[13px]"}
                    spellCheck={false}
                  />
                  <button
                    onClick={() => setShowAnthropicKey((v) => !v)}
                    className="flex h-9 w-9 items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    aria-label={showAnthropicKey ? "Hide key" : "Show key"}
                  >
                    {showAnthropicKey ? <EyeSlash size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {draft.anthropicKey.trim().length > 5 && (
                  <button
                    type="button"
                    onClick={() => {
                      s.activateProPass(draft.anthropicKey.trim(), selectedPlan.id);
                      setOkProvider("anthropic");
                    }}
                    className={btnLamp + " shrink-0 text-[12px] px-3.5"}
                  >
                    Activate Pass
                  </button>
                )}
              </div>
            </Field>

            <div>
              <div className="label-mono !text-[10px] mb-2">Model Selection</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {MODELS.map((m) => {
                  const isSelected = draft.anthropicModel === m.id;
                  const isOpus = m.id === "claude-opus-5";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => set({ anthropicModel: m.id })}
                      className={`group relative flex min-h-[76px] flex-col justify-between rounded-xl border p-4 text-left transition-all active:scale-[0.99] ${
                        isSelected
                          ? "border-brass/60 bg-brass/[0.09] shadow-[0_4px_24px_rgba(227,176,75,0.14)]"
                          : "border-hairline bg-ink/[0.02] hover:border-hairline-strong hover:bg-ink/[0.04]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {isOpus ? (
                            <Brain size={16} className={isSelected ? "text-brass" : "text-muted"} />
                          ) : (
                            <Lightning size={16} className={isSelected ? "text-brass" : "text-muted"} />
                          )}
                          <div className="font-display text-[15px] font-[450] text-ink">
                            {m.label}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] ${
                            isSelected
                              ? "border border-brass/30 bg-brass/20 text-brasspale"
                              : "border border-hairline bg-ink/[0.04] text-muted"
                          }`}
                        >
                          {m.badge}
                        </span>
                      </div>
                      <div className="mt-2 text-[12px] leading-snug text-muted">{m.note}</div>
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted/70">
                        {m.ctx}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field
              label="Custom base URL — optional"
              hint="Leave empty for the official API. Point it at an Anthropic-shaped gateway or proxy if you use one."
            >
              <input
                value={draft.anthropicBaseUrl}
                onChange={(e) => set({ anthropicBaseUrl: e.target.value })}
                placeholder="https://api.anthropic.com"
                className={inputCls + " font-mono text-[13px]"}
                spellCheck={false}
              />
            </Field>
          </>
        ) : (
          <>
            {/* Free provider picker — one click fills endpoint + default model */}
            <div className="overflow-hidden rounded-2xl border border-hairline bg-gradient-to-b from-white/[0.035] to-transparent p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Gauge size={15} className="text-brass shrink-0" />
                  <span className="text-[13px] font-medium text-ink">
                    Free AI Providers — pick one, grab a key, connect
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {fetchingModels && (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-brass animate-pulse">
                      <ArrowClockwise size={11} className="animate-spin" /> Syncing models…
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-sage bg-sage/10 border border-sage/25 px-2 py-0.5 rounded-full">
                    100% Free Tiers
                  </span>
                </div>
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {FREE_PROVIDER_CARDS.map((p) => {
                  const active = draft.compatBaseUrl === p.baseUrl;
                  const Icon = p.icon;
                  return (
                    <div
                      key={p.id}
                      className={`group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 ${
                        active
                          ? "border-brass/50 bg-brass/[0.06] shadow-[0_0_20px_rgba(227,176,75,0.08)]"
                          : "border-hairline bg-ground/50 hover:border-hairline-strong hover:bg-ground/70"
                      }`}
                    >
                      <div
                        aria-hidden
                        className={`pointer-events-none absolute inset-x-3 top-0 z-[1] h-[2px] origin-left rounded-full grad-lamp transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] ${
                          active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          set({ compatBaseUrl: p.baseUrl, compatModel: p.model });
                          // The list belongs to the endpoint it was fetched
                          // from — drop it so Zen never shows OpenRouter's
                          // models (and vice versa).
                          setModelIds([]);
                          setModelsNote("");
                          setLastFetchedAt(null);
                        }}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${
                                active ? "border-brass/40 bg-brass/15" : "border-hairline bg-white/[0.05]"
                              }`}
                            >
                              <Icon size={14} className={active ? "text-brasspale" : "text-ink/80"} />
                            </span>
                            <span className="text-[13.5px] font-medium text-ink">{p.name}</span>
                          </div>
                          <span className="shrink-0 rounded-full border border-hairline bg-ink/[0.04] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
                            {p.tag}
                          </span>
                        </div>
                        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">{p.desc}</p>
                        <div className="mt-2.5 flex flex-wrap gap-1 font-mono text-[9px] text-ink/75">
                          {p.chips.map((c) => (
                            <span key={c} className="rounded bg-ink/[0.06] px-1.5 py-0.5">
                              {c}
                            </span>
                          ))}
                        </div>
                      </button>
                      <ExternalLink
                        href={p.keyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] text-moon transition-colors hover:text-brasspale"
                      >
                        Get key · {p.keyLabel} <ArrowSquareOut size={9} />
                      </ExternalLink>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Saved BYOK Keys Vault Manager */}
            <div className="overflow-hidden rounded-xl border border-hairline bg-ink/[0.02] p-3.5 space-y-3">
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
                  <Plus size={12} /> Add Key
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

              {/* Quick Save Prompt if current key is not in stored keys */}
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
                        placeholder="Key name (e.g. Work OpenRouter)"
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

            <div>
              <div className="label-mono !text-[10px] mb-2">Endpoint Presets</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COMPAT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      set({ compatBaseUrl: p.baseUrl });
                      // List belongs to its endpoint — never carry it across.
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
                    placeholder="sk-or-… (or empty for local)"
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

            <div>
              <Field
                label="Model ID"
                hint="Any model id the endpoint serves. Type one directly or fetch available models."
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={draft.compatModel}
                    onChange={(e) => set({ compatModel: e.target.value })}
                    placeholder="e.g. deepseek/deepseek-r1"
                    className={inputCls + " flex-1 font-mono text-[13px]"}
                    spellCheck={false}
                  />
                  <button
                    className={btnGhost + " shrink-0"}
                    onClick={fetchModels}
                    disabled={fetchingModels || !draft.compatBaseUrl.trim()}
                  >
                    <ArrowClockwise size={14} className="mr-1.5 inline" />
                    {fetchingModels ? "Fetching…" : "Fetch list"}
                  </button>
                </div>
              </Field>

              {/* Recent quick chips */}
              {recentModels.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted/70">
                    <ArrowClockwise size={11} /> Recent:
                  </span>
                  {recentModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set({ compatModel: m })}
                      className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                        draft.compatModel === m
                          ? "border-brass/50 bg-brass/15 text-brasspale"
                          : "border-hairline bg-ink/[0.02] text-muted hover:border-hairline-strong hover:text-ink"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* Fetched models dropdown panel */}
              {modelIds.length > 0 && (
                <div className="relative mt-3 overflow-hidden rounded-xl border border-hairline bg-ground/80 p-3">
                  <div
                    aria-hidden
                    className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brass/40 to-transparent"
                  />
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted flex items-center gap-1.5 flex-wrap">
                      <span>{modelsNote}</span>
                      {lastFetchedAt && (
                        <span className="text-[9.5px] text-muted/60">
                          · {new Date(lastFetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      )}
                    </span>
                    <input
                      type="text"
                      placeholder="Filter models (e.g. :free)…"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="w-full sm:w-44 rounded-lg border border-hairline bg-surface/80 px-2.5 py-1 font-mono text-[11px] text-ink placeholder:text-muted/50 outline-none focus:border-brass/40"
                    />
                  </div>

                  {/* Quick Filter Chips */}
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-hairline pb-2">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted/60">Quick:</span>
                    {[
                      { label: "All", q: "" },
                      { label: "✨ :free (OpenRouter Free)", q: ":free" },
                      { label: "⚡ Groq (Llama)", q: "llama" },
                      { label: "DeepSeek", q: "deepseek" },
                      { label: "Qwen", q: "qwen" },
                      { label: "Gemini", q: "gemini" },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setFilterQuery(chip.q)}
                        className={`rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
                          filterQuery === chip.q
                            ? "bg-brass/20 text-brasspale font-medium"
                            : "bg-ink/[0.04] text-muted hover:bg-ink/[0.08] hover:text-ink"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                    {filteredModelIds.slice(0, 50).map((id) => {
                      const selected = draft.compatModel === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => set({ compatModel: id })}
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-left font-mono text-[12px] transition-all ${
                            selected
                              ? "border-brass/40 bg-brass/[0.14] text-brasspale shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                              : "border-transparent text-ink/80 hover:border-hairline hover:bg-ink/5"
                          }`}
                        >
                          <span className="truncate">{id}</span>
                          {id.endsWith(":free") && (
                            <span className="ml-1.5 shrink-0 rounded-full bg-sage/20 px-1.5 py-0.5 font-mono text-[9px] font-medium text-sage">
                              FREE
                            </span>
                          )}
                          {selected && <Check size={13} className="text-brass ml-2 shrink-0" />}
                        </button>
                      );
                    })}
                    {filteredModelIds.length > 50 && (
                      <div className="pt-1 text-center font-mono text-[10px] text-muted/60">
                        + {filteredModelIds.length - 50} more models. Type to filter.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Segmented effort selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="label-mono !text-[10px]">Thinking Effort</div>
            <span className="font-mono text-[10px] text-muted/70">
              Reasoning depth
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-hairline bg-ground/60 p-1.5">
            {EFFORTS.map((e) => {
              const active = draft.effort === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => set({ effort: e.id })}
                  className={`flex min-h-[42px] items-center justify-center rounded-lg px-3 py-2 text-[12.5px] font-medium transition-all active:scale-[0.97] ${
                    active
                      ? "grad-lamp font-semibold text-night shadow-[0_2px_12px_rgba(227,176,75,0.25)]"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {e.id === "xhigh" && <Sparkle size={13} className="mr-1.5 inline" />}
                  {e.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
            How long Comtus reasons before answering. Compatible endpoints surface reasoning when supported by the model.
          </p>
        </div>

        {testing && <LampPulse label="Testing the connection…" />}
        {okProvider && (
          <div className="flex items-center gap-2 rounded-xl border border-sage/30 bg-sage/[0.07] px-4 py-3 text-[13px] text-sage">
            <Check size={15} /> Connection verified. The lamp is lit.
          </div>
        )}
        {err && <ErrorNote>{err}</ErrorNote>}

        {/* AI Accuracy & Verification Disclaimer */}
        <div className="rounded-xl border border-brass/20 bg-amber-500/[0.04] p-3.5 text-ink/90">
          <div className="flex items-start gap-2.5">
            <Warning size={16} className="text-brass shrink-0 mt-0.5" />
            <div className="text-[12px] leading-relaxed text-muted">
              <strong className="text-ink font-medium">Important AI Disclaimer:</strong> AI models (including free and open-source models) can make mistakes, hallucinate details, or misinterpret nuanced concepts. Always double-check citations, formulas, and answers against your primary study materials and authoritative sources.
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
      onClose={() => setShowAddKeyModal(false)}
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
              placeholder="deepseek/deepseek-r1:free"
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
