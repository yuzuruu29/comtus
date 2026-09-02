import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Sparkle,
  Check,
  CaretDown,
  GearSix,
  Crown,
  Key,
} from "@phosphor-icons/react";
import { useSettings, useCallSettings } from "../lib/settings";
import { CURATED_FREE_MODELS } from "./SettingsModal";
import { MODELS } from "../lib/llm";
import type { AnthropicModelId } from "../lib/types";
import { POPOVER, SOFT } from "./fx";

export default function ModelPickerMenu({
  modelLabel,
  onOpenSettings,
}: {
  modelLabel?: string;
  onOpenSettings?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cs = useCallSettings();
  const s = useSettings();
  const isPro = s.hasProPlan();
  const storedKeys = s.storedKeys ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectFreeModel = (modelId: string) => {
    s.update({
      provider: "openai-compatible",
      compatBaseUrl: s.compatBaseUrl.trim() || "https://openrouter.ai/api/v1",
      compatModel: modelId,
    });
    s.addRecentModel(modelId);
    setOpen(false);
  };

  const selectClaudeModel = (modelId: AnthropicModelId) => {
    s.update({
      provider: "anthropic",
      anthropicModel: modelId,
    });
    setOpen(false);
  };

  const selectClaudeOauthModel = (modelId: AnthropicModelId) => {
    s.update({
      provider: "claude-oauth",
      claudeOauthModel: modelId,
    });
    setOpen(false);
  };

  const selectCodexModel = (modelId: string) => {
    s.update({
      provider: "codex",
      codexModel: modelId,
    });
    setOpen(false);
  };

  const activeModelId = cs.provider === "openai-compatible" ? s.compatModel : cs.model;

  return (
    <div ref={ref} className="relative">
      {/* Trigger Button inside composer */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch AI model directly"
        className={`flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] transition-all active:scale-[0.97] ${
          open
            ? "border-brass/70 bg-brass/20 text-brasspale shadow-[0_0_12px_rgba(227,176,75,0.2)]"
            : "border-brass/35 bg-brass/[0.07] text-brasspale hover:bg-brass/[0.14]"
        }`}
      >
        {cs.provider === "anthropic" || cs.provider === "claude-oauth" ? (
          <Crown size={11} weight="fill" className="shrink-0 text-brass" />
        ) : (
          <Sparkle size={10} weight="fill" className="shrink-0 text-brass" />
        )}
        <span className="max-w-[9rem] truncate sm:max-w-[11rem]">
          {modelLabel ?? cs.model}
        </span>
        <CaretDown
          size={9}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popover Dropdown (Opens upward above composer) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={POPOVER.initial}
            animate={POPOVER.animate}
            exit={POPOVER.exit}
            transition={SOFT}
            role="listbox"
            aria-label="Select AI model"
            className="absolute bottom-full left-0 z-[180] mb-2 w-72 sm:w-80 overflow-hidden rounded-2xl border border-brass/30 bg-ground/95 p-1.5 text-ink shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-hairline">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
                Switch Model
              </span>
              <span className="font-mono text-[9px] text-sage bg-sage/10 border border-sage/25 px-1.5 py-0.2 rounded-full uppercase">
                1-Click Switch
              </span>
            </div>

            <div className="max-h-[340px] overflow-y-auto p-1 space-y-1">
              {/* Smarter Models (If user has pro pass active or anthropic provider) */}
              {isPro && (
                <div className="mb-2 space-y-1">
                  <div className="px-2 pt-1 pb-0.5 font-mono text-[9.5px] uppercase tracking-wider text-brasspale flex items-center gap-1">
                    <Crown size={11} weight="fill" className="text-brass" />
                    <span>Smarter Models (Claude)</span>
                  </div>
                  {MODELS.map((m) => {
                    const isSelected = cs.provider === "anthropic" && cs.model === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectClaudeModel(m.id)}
                        className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all ${
                          isSelected
                            ? "bg-brass/20 text-brasspale font-medium border border-brass/40 shadow-sm"
                            : "hover:bg-ink/[0.04] text-ink"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <Crown size={14} className={isSelected ? "text-brass" : "text-muted"} />
                          <div>
                            <div className="text-[12.5px] font-medium leading-tight truncate">
                              {m.label}
                            </div>
                            <div className="font-mono text-[9.5px] text-muted truncate">
                              {m.note}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="text-brasspale shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Subscription sign-ins — only when connected */}
              {(s.claudeOAuth || s.codexOAuth) && (
                <div className="mb-2 space-y-1">
                  <div className="px-2 pt-1 pb-0.5 font-mono text-[9.5px] uppercase tracking-wider text-brasspale flex items-center gap-1">
                    <Crown size={11} weight="fill" className="text-brass" />
                    <span>Your Subscriptions</span>
                  </div>
                  {s.claudeOAuth &&
                    MODELS.map((m) => {
                      const isSelected = cs.provider === "claude-oauth" && cs.model === m.id;
                      return (
                        <button
                          key={`claude-oauth-${m.id}`}
                          type="button"
                          onClick={() => selectClaudeOauthModel(m.id)}
                          className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all ${
                            isSelected
                              ? "bg-brass/20 text-brasspale font-medium border border-brass/40 shadow-sm"
                              : "hover:bg-ink/[0.04] text-ink"
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <Crown size={14} className={isSelected ? "text-brass" : "text-muted"} />
                            <div>
                              <div className="text-[12.5px] font-medium leading-tight truncate">
                                {m.label} · Claude account
                              </div>
                              <div className="font-mono text-[9.5px] text-muted truncate">
                                your Claude subscription
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check size={14} className="text-brasspale shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  {s.codexOAuth &&
                    s.codexModels.map((m) => {
                      const isSelected = cs.provider === "codex" && cs.model === m.id;
                      return (
                        <button
                          key={`codex-${m.id}`}
                          type="button"
                          onClick={() => selectCodexModel(m.id)}
                          className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all ${
                            isSelected
                              ? "bg-brass/20 text-brasspale font-medium border border-brass/40 shadow-sm"
                              : "hover:bg-ink/[0.04] text-ink"
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <Sparkle size={14} className={isSelected ? "text-brass" : "text-muted"} />
                            <div>
                              <div className="text-[12.5px] font-medium leading-tight truncate">
                                {m.label} · ChatGPT account
                              </div>
                              <div className="font-mono text-[9.5px] text-muted truncate">
                                {m.ctx ? `${m.ctx} context` : m.id}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check size={14} className="text-brasspale shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Curated Free Models Group */}
              <div className="space-y-1">
                <div className="px-2 pt-1 pb-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted/80 flex items-center justify-between">
                  <span>Curated Free Models</span>
                  <span className="text-sage text-[9px]">100% Free</span>
                </div>

                {CURATED_FREE_MODELS.map((m) => {
                  const isSelected =
                    cs.provider === "openai-compatible" &&
                    (activeModelId === m.id || (!activeModelId && m.id === "dots-studio/dots-3-note-preview:free"));
                  const Icon = m.icon;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectFreeModel(m.id)}
                      className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all ${
                        isSelected
                          ? "bg-brass/20 text-brasspale font-medium border border-brass/40 shadow-sm"
                          : "hover:bg-ink/[0.04] text-ink"
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                            isSelected
                              ? "border-brass/50 bg-brass/25 text-brasspale"
                              : "border-hairline bg-ink/[0.03] text-muted"
                          }`}
                        >
                          <Icon size={12} weight={isSelected ? "fill" : "regular"} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-medium leading-tight truncate">
                              {m.name}
                            </span>
                            <span className="font-mono text-[8.5px] uppercase text-muted/70 truncate">
                              · {m.context}
                            </span>
                          </div>
                          <div className="font-mono text-[9.5px] text-muted truncate">
                            {m.bestFor}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check size={13} className="text-brasspale shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>

              {/* Stored Keys Quick Switch (if available) */}
              {storedKeys.length > 0 && (
                <div className="pt-1.5 border-t border-hairline space-y-1">
                  <div className="px-2 pt-1 pb-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted/80 flex items-center gap-1">
                    <Key size={10} className="text-brass" />
                    <span>Your Vault Keys</span>
                  </div>
                  {storedKeys.slice(0, 3).map((k) => {
                    const isActive =
                      cs.provider === "openai-compatible" &&
                      s.compatKey === k.apiKey &&
                      s.compatBaseUrl === k.baseUrl;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => {
                          s.update({
                            provider: "openai-compatible",
                            compatKey: k.apiKey,
                            compatBaseUrl: k.baseUrl,
                            compatModel: k.defaultModel || s.compatModel,
                          });
                          setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition-all ${
                          isActive
                            ? "bg-brass/20 text-brasspale font-medium border border-brass/40"
                            : "hover:bg-ink/[0.04] text-muted hover:text-ink"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="text-[11.5px] truncate font-medium">{k.name}</span>
                          <span className="font-mono text-[8.5px] uppercase text-muted/60">
                            ({k.provider})
                          </span>
                        </div>
                        {isActive && <Check size={12} className="text-brasspale shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer: Open Full Settings Modal */}
            {onOpenSettings && (
              <div className="mt-1 pt-1.5 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left font-mono text-[11px] text-muted hover:text-ink hover:bg-ink/[0.04] transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <GearSix size={13} />
                    <span>Advanced Settings & Keys Vault</span>
                  </span>
                  <span>→</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
