import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Brain,
  CaretDown,
  Check,
  Globe,
  Microphone,
  PaperPlaneRight,
  Plus,
  Stack,
  Stop,
  X,
} from "@phosphor-icons/react";
import { IconButton } from "../ui";
import { pruneFocus, saveFocus, subscribeFocus } from "./focus";
import { db } from "../lib/db";
import type { Notebook } from "../lib/types";
import ModelPickerMenu from "./ModelPickerMenu";
import ComposerSideRailDock from "./ComposerSideRail";
import { DUR, ENTER, EXIT, HOUSE, POPOVER, RISE_1, RISE_2, SOFT } from "./fx";
import type { useVoiceInput } from "./useVoiceInput";
import { ICON } from "../ui/iconScale";

const FOLLOW_UPS = [
  {
    label: "Key takeaways",
    prompt: "What are the main key takeaways and practical implications?",
  },
  {
    label: "Compare ideas",
    prompt: "Compare and contrast the primary themes across sources",
  },
  {
    label: "Build a study outline",
    prompt: "Generate a detailed study outline based on these materials",
  },
];

type StreamPhase = "searching" | "reading" | "thinking" | "answering";

/** Model and source context stay with the draft; streaming replaces Send
 *  with Stop without moving the writing surface. */
export default function Composer({
  notebook,
  sourcesVersion,
  modelLabel,
  onOpenSettings,
  onAddSources,
  capabilities,
  input,
  onInputChange,
  onSend,
  onStop,
  streaming,
  preparing = false,
  showJump,
  onJumpToLatest,
  reasoningEnabled,
  onReasoningChange,
  webSearchEnabled,
  onWebSearchChange,
  voice,
  tkEstimate,
  dismissedFollowUps,
  onDismissFollowUps,
  hasAnswer,
}: {
  notebook: Notebook;
  sourcesVersion: number;
  modelLabel?: string;
  onOpenSettings?: () => void;
  onAddSources?: () => void;
  /** Task 3.3 supplies real model capabilities; until then callers may pass
   *  { thinking: false } to hide the Think toggle. Defaults to shown. */
  capabilities?: { thinking?: boolean };
  input: string;
  onInputChange: (value: string) => void;
  onSend: (prompt?: string) => void;
  onStop: () => void;
  streaming: { phase?: StreamPhase } | null;
  preparing?: boolean;
  showJump: boolean;
  onJumpToLatest: () => void;
  reasoningEnabled: boolean;
  onReasoningChange: (value: boolean) => void;
  webSearchEnabled: boolean;
  onWebSearchChange: (value: boolean) => void;
  voice: ReturnType<typeof useVoiceInput>;
  tkEstimate: number;
  dismissedFollowUps: boolean;
  onDismissFollowUps: () => void;
  hasAnswer: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hasText = !!input.trim() && !preparing;
  const thinkingCapable = capabilities?.thinking !== false;

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 160)}px`;
  }, [input]);

  return (
    <div aria-busy={preparing} className="composer-wrap">
      <AnimatePresence>
        {streaming && showJump && (
          <motion.button
            initial={ENTER.initial}
            animate={ENTER.animate}
            exit={{ ...ENTER.exit, transition: EXIT }}
            transition={SOFT}
            onClick={onJumpToLatest}
            className="absolute -top-9 right-4 z-20 flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-hairline-strong bg-raised px-3 py-1.5 text-[11.5px] text-ink shadow-modal"
          >
            <ArrowDown size={ICON.xs} weight="light" />
            Jump to latest
            <span className="h-1 w-1 rounded-[var(--radius-pill)] bg-brass" />
          </motion.button>
        )}
      </AnimatePresence>
      <div className="mx-auto w-full max-w-3xl rounded-[var(--radius-dialog)]">
        <div
          data-focused={focused ? "" : undefined}
          data-streaming={streaming ? "" : undefined}
          className="composer-shell relative"
        >
          <div className="relative z-[2]">
            {/* Context strip */}
            <div className="composer-context">
              <div className="composer-model">
                <ModelPickerMenu modelLabel={modelLabel} onOpenSettings={onOpenSettings} />
              </div>
              <div className="composer-sources">
                <FocusMenu notebook={notebook} sourcesVersion={sourcesVersion} />
              </div>
              <AnimatePresence>
                {streaming && (
                  <motion.div
                    initial={{ opacity: 0, x: RISE_1 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: RISE_1, transition: EXIT }}
                    transition={SOFT}
                    className="phase-pill-inline composer-phase"
                    role="status"
                  >
                    <span className="phase-dot" />
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={streaming.phase ?? "reading"}
                        className="phase-label"
                        initial={{ opacity: 0, y: RISE_1 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -RISE_1 }}
                        transition={{ duration: DUR.fast, ease: HOUSE }}
                      >
                        {streaming.phase === "thinking"
                          ? "thinking"
                          : streaming.phase === "answering"
                            ? "answering"
                            : streaming.phase === "searching"
                              ? "searching the web"
                              : "reading sources"}
                      </motion.span>
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="composer-effort">
                <ComposerSideRailDock onOpenSettings={onOpenSettings} />
              </div>
            </div>

            {/* Textarea band */}
            <div className="composer-draft">
              <textarea
                ref={taRef}
                aria-label="Ask Comtus"
                readOnly={preparing}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!preparing) onSend();
                  }
                }}
                rows={1}
                placeholder="Ask a question about your reading…"
                className="composer-input"
              />
              {voice.state !== "idle" && (
                <div className="flex min-h-5 items-center gap-2 text-[12px] leading-snug" role="status">
                  {(voice.state === "listening" || voice.state === "recording") && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-[var(--radius-pill)] bg-brass/50 [animation-duration:1.4s]" />
                      <span className="relative inline-flex h-2 w-2 rounded-[var(--radius-pill)] bg-brass" />
                    </span>
                  )}
                  {voice.state === "listening" && (
                    <span className="truncate italic text-muted">
                      {voice.interim || "Listening…"}
                    </span>
                  )}
                  {voice.state === "recording" && (
                    <span className="font-mono text-[11px] text-muted">
                      Recording {Math.floor(voice.elapsed / 60)}:
                      {String(voice.elapsed % 60).padStart(2, "0")} — transcribes itself when
                      you pause
                    </span>
                  )}
                  {voice.state === "transcribing" && (
                    <span className="flex items-center gap-2 text-muted">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-[var(--radius-pill)] bg-brass/50 [animation-duration:1.6s]" />
                        <span className="relative inline-flex h-2 w-2 rounded-[var(--radius-pill)] bg-brass" />
                      </span>
                      Transcribing…
                    </span>
                  )}
                </div>
              )}
              {voice.error && (
                <p role="alert" className="pt-1 text-[12px] leading-relaxed text-rust">
                  {voice.error}
                </p>
              )}
            </div>

            {/* Action rail */}
            <div className="composer-actions">
              <IconButton
                size="sm"
                aria-label="Add sources"
                title="Add sources"
                onClick={() => onAddSources?.()}
              >
                <Plus size={ICON.sm} weight="light" />
              </IconButton>
              {/* Reasoning/Web-search rail — kept mounted so the toggles'
                  state survives streams; collapse-grid hides height and,
                  once visibility flips, keyboard tab order when folded. */}
              <div className={`collapse-grid ml-1 ${streaming ? "" : "is-open"}`}>
                <div className="flex items-center gap-1.5">
                  {thinkingCapable && (
                    <button
                      type="button"
                      onClick={() => onReasoningChange(!reasoningEnabled)}
                      aria-pressed={reasoningEnabled}
                      title={
                        reasoningEnabled
                          ? "Deep Reasoning active — Step-by-step logic, edge cases & verification"
                          : "Enable Deep Reasoning"
                      }
                      className="composer-mode"
                    >
                      <Brain
                        size={ICON.xs}
                        weight={reasoningEnabled ? "fill" : "regular"}
                        className={reasoningEnabled ? "text-brass" : "text-muted"}
                      />
                      <span>Reasoning</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onWebSearchChange(!webSearchEnabled)}
                    aria-label="Web Search"
                    aria-pressed={webSearchEnabled}
                    title={
                      webSearchEnabled
                        ? "Web Search active — Searches live web summaries & external knowledge"
                        : "Enable Web Search (useful when no sources are attached)"
                    }
                    className="composer-mode"
                  >
                    <Globe
                      size={ICON.xs}
                      weight={webSearchEnabled ? "fill" : "regular"}
                      className={webSearchEnabled ? "text-brass" : "text-muted"}
                    />
                    <span>Web</span>
                  </button>
                </div>
              </div>
              <span className="flex-1" />
              {tkEstimate > 0 && (
                <span className="composer-tokens" title="Approximate conversation tokens">
                  ~{tkEstimate.toLocaleString()} tk
                </span>
              )}
              {!streaming && (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={voice.toggle}
                  disabled={preparing || voice.state === "transcribing"}
                  data-armed={voice.state !== "idle"}
                  title="Voice input — your browser's speech engine, or your own key for clip transcription"
                  aria-label="Voice input"
                  aria-pressed={voice.state !== "idle"}
                  className="composer-voice"
                >
                  {voice.state === "listening" && (
                    <span
                      aria-hidden
                      className="absolute inset-0 animate-ping rounded-[var(--radius-pill)] bg-brass/25 [animation-duration:1.6s]"
                    />
                  )}
                  <Microphone
                    size={ICON.sm}
                    weight={voice.state === "idle" ? "light" : "fill"}
                    className="relative z-10"
                  />
                </motion.button>
              )}
              <AnimatePresence mode="popLayout" initial={false}>
                {streaming ? (
                  <motion.button
                    key="stop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={SOFT}
                    whileTap={{ scale: 0.96 }}
                    onClick={onStop}
                    className="composer-stop"
                    aria-label="Stop generating"
                    title="Stop"
                  >
                    <Stop size={ICON.sm} weight="fill" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="send"
                    data-armed={hasText}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileTap={{ scale: 0.96 }}
                    transition={SOFT}
                    onClick={() => onSend()}
                    aria-label="Send message"
                    disabled={!hasText}
                    className="composer-send"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {hasText ? (
                        <motion.span
                          key="plane"
                          initial={{ opacity: 0, y: RISE_2, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -RISE_2, scale: 0.5 }}
                          transition={{ duration: DUR.fast, ease: HOUSE }}
                          className="relative z-[1] flex"
                        >
                          <PaperPlaneRight size={ICON.md} weight="bold" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="up"
                          initial={{ opacity: 0, y: -RISE_2, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: RISE_2, scale: 0.5 }}
                          transition={{ duration: DUR.fast, ease: HOUSE }}
                          className="relative z-[1] flex"
                        >
                          <ArrowUp size={ICON.md} weight="bold" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up rail — only once there is an answer to follow up on and user has not dismissed */}
      <AnimatePresence>
        {!streaming && !dismissedFollowUps && hasAnswer && (
          <motion.div
            initial={{ opacity: 0, y: RISE_2, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: RISE_1, height: 0 }}
            transition={{ duration: DUR.slow, ease: HOUSE }}
            className="composer-followups"
          >
            {FOLLOW_UPS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onSend(item.prompt)}
                title={item.prompt}
                className="composer-followup"
              >
<span>{item.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={onDismissFollowUps}
              title="Dismiss suggestions"
              aria-label="Dismiss suggestions"
              className="composer-dismiss"
            >
              <X size={ICON.xs} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="composer-footnote">
        Check important answers against your sources.
      </p>
    </div>
  );
}

function FocusMenu({
  notebook,
  sourcesVersion,
}: {
  notebook: Notebook;
  sourcesVersion: number;
}) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<{ id: string; title: string }[]>([]);
  const [focus, setFocus] = useState<string[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void db.sources
      .where("notebookId")
      .equals(notebook.id)
      .toArray()
      .then((rows) => {
        const list = rows.map((r) => ({ id: r.id, title: r.title }));
        setSources(list);
        const pruned = pruneFocus(notebook.id, list.map((s) => s.id));
        setFocus(pruned);
      });
  }, [notebook.id, sourcesVersion]);

  useEffect(() => {
    return subscribeFocus(notebook.id, (ids) => {
      setFocus(ids);
    });
  }, [notebook.id]);

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

  const toggle = (id: string) => {
    const effective = focus ?? sources.map((s) => s.id);
    const next = effective.includes(id)
      ? effective.filter((x) => x !== id)
      : [...effective, id];
    const value = next.length === sources.length ? null : next;
    setFocus(value);
    saveFocus(notebook.id, value);
  };

  const selectAll = () => {
    setFocus(null);
    saveFocus(notebook.id, null);
  };

  const selectNone = () => {
    setFocus([]);
    saveFocus(notebook.id, []);
  };

  const label =
    sources.length === 0
      ? "No sources"
      : focus === null || focus.length === sources.length
        ? `All ${sources.length} ${sources.length === 1 ? "source" : "sources"}`
        : focus.length === 0
          ? "No sources selected"
          : `${focus.length} of ${sources.length} sources`;

  return (
    <div ref={ref} className="composer-source-picker">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Choose which sources answers ground in"
        className="composer-source-trigger"
      >
        <Stack size={ICON.xs} weight="light" className="shrink-0" />
        <span>{label}</span>
        <CaretDown
          size={ICON.xs}
          className={`shrink-0 transition-transform duration-med ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={POPOVER.initial}
            animate={POPOVER.animate}
            exit={{ ...POPOVER.exit, transition: EXIT }}
            transition={SOFT}
            role="dialog"
            aria-label="Sources for this conversation"
            className="composer-source-menu"
          >
            <div className="flex items-center justify-between border-b border-hairline px-3 py-1.5 text-[11px] text-muted">
              <span>Use sources</span>
              {sources.length > 0 && (
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-brass hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-muted">|</span>
                  <button
                    type="button"
                    onClick={selectNone}
                    className="text-muted hover:text-ink hover:underline cursor-pointer"
                  >
                    None
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {sources.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted">
                  Add sources in the Sources tab to ground your answers.
                </div>
              )}
              {sources.map((s) => {
                const checked = focus === null || focus.includes(s.id);
                return (
                  <button
                    key={s.id}
                    aria-pressed={checked}
                    onClick={() => toggle(s.id)}
                    className="flex w-full items-center gap-2 rounded-[var(--radius-dialog)] px-2.5 py-1.5 text-left text-[12.5px] text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
                        checked ? "border-brass/60 bg-brass/25 text-brass" : "border-hairline-strong"
                      }`}
                    >
                      {checked && <Check size={ICON.xs} weight="bold" />}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </button>
                );
              })}
            </div>
            {/* Prose, not a label: 9px uppercase mono at 0.14em tracking is
                for an eyebrow or a measurement, and this is a sentence the
                reader is meant to actually read. */}
            <div className="border-t border-hairline px-3 py-2 text-label text-muted">
              Selected sources are available to this conversation.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
