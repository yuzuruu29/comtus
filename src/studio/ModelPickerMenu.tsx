import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Sparkle,
  Check,
  CaretDown,
  GearSix,
  Crown,
  Key,
  type Icon,
} from "@phosphor-icons/react";
import { useSettings, useCallSettings } from "../lib/settings";
import { CURATED_FREE_MODELS } from "./SettingsModal";
import { MODELS } from "../lib/llm";
import type { AnthropicModelId } from "../lib/types";
import { EXIT, POPOVER, SOFT } from "./fx";
import { ICON } from "../ui/iconScale";

export default function ModelPickerMenu({
  modelLabel,
  onOpenSettings,
  placement = "above",
}: {
  modelLabel?: string;
  onOpenSettings?: () => void;
  /** Which way the menu opens. The composer sits low, so it opens upward;
      the desk header opens downward. */
  placement?: "above" | "below";
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

  const activeModelId = cs.provider === "openai-compatible" ? s.compatModel : cs.model;

  const ModelIcon = cs.provider === "anthropic" ? Crown : Sparkle;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Choose the model that answers"
        className={`model-chip ${open ? "is-open" : ""}`}
      >
        <ModelIcon size={ICON.sm} className="shrink-0" />
        <span className="truncate">{modelLabel ?? cs.model}</span>
        <CaretDown size={ICON.xs} className={`shrink-0 effort-caret ${open ? "is-open" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={POPOVER.initial}
            animate={POPOVER.animate}
            exit={{ ...POPOVER.exit, transition: EXIT }}
            transition={SOFT}
            role="listbox"
            aria-label="Choose a model"
            className={`model-menu ${placement === "below" ? "model-menu--below" : ""}`}
          >
            <div className="model-menu-list">
              {isPro && (
                <ModelGroup title="Claude">
                  {MODELS.map((m) => (
                    <ModelOption
                      key={m.id}
                      icon={Crown}
                      name={m.label}
                      note={m.note}
                      selected={cs.provider === "anthropic" && cs.model === m.id}
                      onSelect={() => selectClaudeModel(m.id)}
                    />
                  ))}
                </ModelGroup>
              )}

              <ModelGroup title="Free — no setup needed">
                {CURATED_FREE_MODELS.map((m) => (
                  <ModelOption
                    key={m.id}
                    icon={m.icon}
                    name={m.name}
                    note={m.bestFor}
                    selected={
                      cs.provider === "openai-compatible" &&
                      (activeModelId === m.id || (!activeModelId && m.id === "openrouter/free"))
                    }
                    onSelect={() => selectFreeModel(m.id)}
                  />
                ))}
              </ModelGroup>

              {storedKeys.length > 0 && (
                <ModelGroup title="Your keys">
                  {storedKeys.slice(0, 3).map((k) => (
                    <ModelOption
                      key={k.id}
                      icon={Key}
                      name={k.name}
                      note={k.provider === "openrouter" ? "OpenRouter" : k.provider === "groq" ? "Groq" : k.provider === "deepseek" ? "DeepSeek" : "Custom"}
                      selected={
                        cs.provider === "openai-compatible" &&
                        s.compatKey === k.apiKey &&
                        s.compatBaseUrl === k.baseUrl
                      }
                      onSelect={() => {
                        s.update({
                          provider: "openai-compatible",
                          compatKey: k.apiKey,
                          compatBaseUrl: k.baseUrl,
                          compatModel: k.defaultModel || s.compatModel,
                        });
                        setOpen(false);
                      }}
                    />
                  ))}
                </ModelGroup>
              )}
            </div>

            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="model-menu-footer"
              >
                <GearSix size={ICON.sm} />
                <span>All models in Settings</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModelGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="model-group">
      <p className="model-group-title" aria-hidden="true">
        {title}
      </p>
      {children}
    </div>
  );
}

function ModelOption({
  icon: Icon,
  name,
  note,
  selected,
  onSelect,
}: {
  icon: Icon;
  name: string;
  note?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" role="option" aria-selected={selected} onClick={onSelect} className="model-option">
      <Icon size={ICON.md} weight={selected ? "fill" : "regular"} className="model-option-icon" />
      <span className="min-w-0 flex-1">
        <span className="model-option-name">{name}</span>
        {note && <span className="model-option-note">{note}</span>}
      </span>
      {selected && <Check size={ICON.sm} weight="bold" className="shrink-0 text-brass" />}
    </button>
  );
}
