import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Check,
  Flame,
  ListRestart,
  Sparkles,
  Zap,
  BrainCircuit,
  History,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Modal, Field, inputCls, btnLamp, btnGhost, ErrorNote, LampPulse } from "./ui";
import { useSettings } from "../lib/settings";
import {
  MODELS,
  EFFORTS,
  COMPAT_PRESETS,
  validateConnection,
  listCompatModels,
  type CallSettings,
} from "../lib/llm";
import type { ProviderId } from "../lib/types";

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
  const [filterQuery, setFilterQuery] = useState("");
  const [byokGuideOpen, setByokGuideOpen] = useState(false);

  const recentModels = useSettings((st) => st.recentModels) ?? [];

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
    if (cs.provider === "openai-compatible" && cs.model) {
      useSettings.getState().addRecentModel(cs.model);
    }
    setOkProvider(cs.provider);
  };

  const fetchModels = async () => {
    setErr("");
    setModelsNote("");
    setFetchingModels(true);
    try {
      const ids = await listCompatModels(draft.compatKey.trim(), draft.compatBaseUrl.trim());
      setModelIds(ids);
      setModelsNote(
        ids.length
          ? `${ids.length} models found — select from the list below or search.`
          : "The endpoint listed no models — type a model id manually.",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't reach that endpoint.");
    } finally {
      setFetchingModels(false);
    }
  };

  const filteredModelIds = modelIds.filter((id) =>
    filterQuery ? id.toLowerCase().includes(filterQuery.toLowerCase()) : true
  );

  return (
    <Modal open={open} onClose={onClose} title="Settings" wide>
      <div className="space-y-6">
        {/* Provider switch */}
        <div>
          <div className="label-mono !text-[10px] mb-2">Provider</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {(
              [
                ["anthropic", "Anthropic Claude", "Opus 5 · adaptive thinking · native citations"],
                ["openai-compatible", "OpenAI-compatible", "OpenRouter · Ollama · LM Studio · Groq · DeepSeek"],
              ] as const
            ).map(([id, label, note]) => (
              <button
                key={id}
                onClick={() => set({ provider: id })}
                className={`min-h-[52px] rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${
                  draft.provider === id
                    ? "border-brass/60 bg-brass/[0.09] shadow-[0_0_20px_rgba(227,176,75,0.12)]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[13.5px] font-medium text-parchment">{label}</div>
                  {draft.provider === id && (
                    <span className="flex h-2 w-2 rounded-full bg-brass shadow-[0_0_8px_var(--color-brass)]" />
                  )}
                </div>
                <div className="mt-1 text-[11.5px] leading-snug text-faded">{note}</div>
              </button>
            ))}
          </div>
        </div>

        {/* BYOK Guide Banner / Toggle */}
        <div className="overflow-hidden rounded-xl border border-brass/25 bg-brass/[0.04]">
          <button
            type="button"
            onClick={() => setByokGuideOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-brass/[0.08]"
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle size={16} className="text-brass shrink-0" />
              <span className="text-[13px] font-medium text-parchment">
                How to BYOK (Bring Your Own Key) & Get Free / Cheap Keys
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px] text-brasspale">
              <span>{byokGuideOpen ? "Hide guide" : "View steps"}</span>
              {byokGuideOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {byokGuideOpen && (
            <div className="border-t border-brass/15 bg-night/70 p-4.5 text-[12.5px] leading-relaxed text-parchment/90 space-y-3.5">
              <div className="flex items-start gap-2.5 rounded-lg border border-sage/20 bg-sage/[0.05] p-3 text-sage text-[12px]">
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <span>
                  <strong>100% Client-Side Privacy:</strong> Your key never touches a proxy server. It is saved directly to your browser's local storage and used only to communicate directly with your chosen API provider.
                </span>
              </div>

              {draft.provider === "anthropic" ? (
                <div className="space-y-2">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-brasspale font-medium">
                    Getting an Anthropic Claude Key:
                  </div>
                  <ol className="list-decimal pl-5 space-y-1.5 text-faded">
                    <li>
                      Visit{" "}
                      <a
                        href="https://console.anthropic.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-moon hover:underline inline-flex items-center gap-1"
                      >
                        console.anthropic.com <ExternalLink size={11} />
                      </a>{" "}
                      and sign in or create an account.
                    </li>
                    <li>Navigate to <strong>API Keys</strong> in the dashboard sidebar.</li>
                    <li>Click <strong>Create Key</strong>, name it (e.g. <em>"Comtus Study"</em>), and copy the key string starting with <code className="text-brasspale">sk-ant-...</code>.</li>
                    <li>Paste it into the field below and tap <strong>Save & test</strong>.</li>
                  </ol>
                  <p className="text-[11.5px] text-faded/80 italic">
                    💡 Anthropic bills per token (approx. $0.003–$0.015 per exam), costing fractions of a cent per study session compared to $20/month fixed subscriptions.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-brasspale font-medium">
                    Options for OpenAI-Compatible Endpoints:
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <div className="font-medium text-parchment flex items-center justify-between">
                        <span>1. OpenRouter</span>
                        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-moon text-[11px] hover:underline flex items-center gap-0.5">
                          openrouter.ai <ExternalLink size={10} />
                        </a>
                      </div>
                      <p className="mt-1 text-[11.5px] text-faded">
                        One single API key provides access to DeepSeek R1, Claude 3.5, GPT-4o, and Llama 3.3.
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <div className="font-medium text-parchment flex items-center justify-between">
                        <span>2. Groq (Fast & Free Tier)</span>
                        <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-moon text-[11px] hover:underline flex items-center gap-0.5">
                          groq.com <ExternalLink size={10} />
                        </a>
                      </div>
                      <p className="mt-1 text-[11.5px] text-faded">
                        Instant, ultra-low latency inference for open models like Llama 3.3 70B.
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <div className="font-medium text-parchment flex items-center justify-between">
                        <span>3. DeepSeek</span>
                        <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-moon text-[11px] hover:underline flex items-center gap-0.5">
                          deepseek.com <ExternalLink size={10} />
                        </a>
                      </div>
                      <p className="mt-1 text-[11.5px] text-faded">
                        Ultra-capable, low-cost reasoning models (<code className="text-brasspale">deepseek-reasoner</code>).
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <div className="font-medium text-parchment flex items-center justify-between">
                        <span>4. Local (Ollama / LM Studio)</span>
                        <span className="text-sage text-[10.5px] font-mono">100% FREE</span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-faded">
                        Run models offline on your machine with Ollama or LM Studio. <strong>No API key or payment needed!</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {draft.provider === "anthropic" ? (
          <>
            <Field
              label="Anthropic API key"
              hint="Stored only in this browser (localStorage) and sent directly to Anthropic. Get one at console.anthropic.com."
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showAnthropicKey ? "text" : "password"}
                    value={draft.anthropicKey}
                    onChange={(e) => set({ anthropicKey: e.target.value })}
                    placeholder="sk-ant-…"
                    className={inputCls + " pr-10 font-mono text-[13px]"}
                    spellCheck={false}
                  />
                  <button
                    onClick={() => setShowAnthropicKey((v) => !v)}
                    className="flex h-9 w-9 items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-faded hover:text-parchment"
                    aria-label={showAnthropicKey ? "Hide key" : "Show key"}
                    tabIndex={-1}
                  >
                    {showAnthropicKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
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
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {isOpus ? (
                            <BrainCircuit size={16} className={isSelected ? "text-brass" : "text-faded"} />
                          ) : (
                            <Zap size={16} className={isSelected ? "text-brass" : "text-faded"} />
                          )}
                          <div className="font-display text-[15px] font-[450] text-parchment">
                            {m.label}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] ${
                            isSelected
                              ? "border border-brass/30 bg-brass/20 text-brasspale"
                              : "border border-white/10 bg-white/[0.04] text-faded"
                          }`}
                        >
                          {m.badge}
                        </span>
                      </div>
                      <div className="mt-2 text-[12px] leading-snug text-faded">{m.note}</div>
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faded/70">
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
            <div>
              <div className="label-mono !text-[10px] mb-2">Endpoint Presets</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COMPAT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => set({ compatBaseUrl: p.baseUrl })}
                    className={`min-h-[50px] rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98] ${
                      draft.compatBaseUrl === p.baseUrl
                        ? "border-brass/60 bg-brass/[0.08]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="font-mono text-[11px] font-medium text-brasspale">{p.label}</div>
                    <div className="mt-0.5 line-clamp-1 text-[10.5px] leading-snug text-faded">{p.note}</div>
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
                    className="flex h-9 w-9 items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-faded hover:text-parchment"
                    aria-label={showCompatKey ? "Hide key" : "Show key"}
                    tabIndex={-1}
                  >
                    {showCompatKey ? <EyeOff size={15} /> : <Eye size={15} />}
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
                    <ListRestart size={14} className="mr-1.5 inline" />
                    {fetchingModels ? "Fetching…" : "Fetch list"}
                  </button>
                </div>
              </Field>

              {/* Recent quick chips */}
              {recentModels.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faded/70">
                    <History size={11} /> Recent:
                  </span>
                  {recentModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set({ compatModel: m })}
                      className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                        draft.compatModel === m
                          ? "border-brass/50 bg-brass/15 text-brasspale"
                          : "border-white/10 bg-white/[0.02] text-faded hover:border-white/20 hover:text-parchment"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* Fetched models dropdown panel */}
              {modelIds.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-night/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faded">
                      {modelsNote}
                    </span>
                    <input
                      type="text"
                      placeholder="Filter models…"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="w-36 rounded-lg border border-white/10 bg-study/80 px-2.5 py-1 font-mono text-[11px] text-parchment placeholder:text-faded/50 outline-none"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {filteredModelIds.slice(0, 40).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => set({ compatModel: id })}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left font-mono text-[12px] transition-colors ${
                          draft.compatModel === id
                            ? "bg-brass/20 text-brasspale"
                            : "text-parchment/80 hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate">{id}</span>
                        {draft.compatModel === id && <Check size={13} className="text-brass ml-2 shrink-0" />}
                      </button>
                    ))}
                    {filteredModelIds.length > 40 && (
                      <div className="pt-1 text-center font-mono text-[10px] text-faded/60">
                        + {filteredModelIds.length - 40} more models. Type to filter.
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
            <span className="font-mono text-[10px] text-faded/70">
              Reasoning depth
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.08] bg-night/60 p-1.5">
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
                      : "text-faded hover:text-parchment"
                  }`}
                >
                  {e.id === "xhigh" && <Sparkles size={13} className="mr-1.5 inline" />}
                  {e.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-faded">
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

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
          <div className="flex items-center gap-2 text-[13px] text-parchment/85">
            <Flame size={14} className="text-brass" />
            Local-first, on-device data.
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-faded">
            Notebooks, sources, and history stay inside this browser's IndexedDB. Your questions
            stream directly to your chosen provider endpoint.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button className={btnGhost} onClick={onClose}>
            Done
          </button>
          <button className={btnLamp} onClick={saveAndTest} disabled={testing}>
            {testing ? "Testing…" : "Save & test"}
          </button>
        </div>
      </div>
    </Modal>
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
