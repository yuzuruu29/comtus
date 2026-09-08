import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Brain,
  CaretDown,
  Check,
  Globe,
  Microphone,
  PaperPlaneRight,
  Plus,
  Sparkle,
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
import { HOUSE, POPOVER, RISE_1, SOFT, SPRING } from "./fx";
import type { useVoiceInput } from "./useVoiceInput";

const FOLLOW_UPS = [
  {
    label: "Key takeaways & practical implications",
    prompt: "What are the main key takeaways and practical implications?",
  },
  {
    label: "Compare and contrast themes across sources",
    prompt: "Compare and contrast the primary themes across sources",
  },
  {
    label: "Generate a detailed study outline",
    prompt: "Generate a detailed study outline based on these materials",
  },
];

type StreamPhase = "searching" | "reading" | "thinking" | "answering";

/** The desk's lamp. Keeps the approved console-deck anatomy (context strip
 *  → textarea → action rail, phase pill docked to the shell's top edge,
 *  cardless answers upstream, always-visible Save/Copy upstream) — Task 2.4
 *  changes only: the glow is now `--brass-pale` breathing at `--beat-lamp`
 *  while streaming, and the Think toggle can be capability-gated. No
 *  Spotlight cursor tracking here — that reads as a yellow bar on click. */
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
    <div aria-busy={preparing} className="relative shrink-0 px-4 pb-[0.9rem] pt-2 sm:px-5 sm:pb-[0.95rem] lg:pb-[calc(0.95rem+var(--sab))]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-7 h-7 bg-gradient-to-b from-transparent to-ground"
      />
      <div
        aria-hidden
        className={`composer-ambience pointer-events-none absolute inset-x-6 -top-12 bottom-0 ${
          focused || streaming ? "is-lit" : ""
        } ${streaming ? "is-breathing" : ""}`}
      />
      <AnimatePresence>
        {streaming && showJump && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
            transition={SOFT}
            onClick={onJumpToLatest}
            className="absolute -top-9 right-4 z-20 flex items-center gap-1.5 rounded-full border border-hairline-strong bg-raised px-3 py-1.5 text-[11.5px] text-ink shadow-modal"
          >
            <ArrowDown size={11} weight="light" />
            Jump to latest
            <span className="h-1 w-1 rounded-full bg-brass" />
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
            <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible no-scrollbar px-3 sm:px-3.5 pb-2 pt-2 sm:pt-2.5">
              <div className="relative shrink-0">
                <ModelPickerMenu modelLabel={modelLabel} onOpenSettings={onOpenSettings} />
              </div>
              <div className="relative shrink-0">
                <FocusMenu notebook={notebook} sourcesVersion={sourcesVersion} />
              </div>
              <span className="flex-1 min-w-1 sm:min-w-2" />
              <AnimatePresence>
                {streaming && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, x: 4 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.92, x: 4, transition: { duration: 0.12 } }}
                    transition={SOFT}
                    className="phase-pill-inline shrink-0"
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
                        transition={{ duration: 0.14, ease: HOUSE }}
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
              <div className="relative shrink-0">
                <ComposerSideRailDock onOpenSettings={onOpenSettings} />
              </div>
            </div>
            <div className="mx-3 sm:mx-3.5 border-t border-hairline" />

            {/* Textarea band */}
            <div className="px-3.5 pb-1.5 pt-2.5">
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
                placeholder="Ask, or say what to drill…"
                className="min-h-9 w-full resize-none border-0 bg-transparent text-[16px] leading-relaxed text-ink caret-brass outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 placeholder:text-muted/55 sm:text-[14px]"
              />
              {voice.state !== "idle" && (
                <div className="flex min-h-5 items-center gap-2 text-[12px] leading-snug" role="status">
                  {(voice.state === "listening" || voice.state === "recording") && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass/50 [animation-duration:1.4s]" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-brass" />
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
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass/50 [animation-duration:1.6s]" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-brass" />
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
            <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
              <IconButton
                size="sm"
                aria-label="Add sources"
                title="Add sources"
                onClick={() => onAddSources?.()}
              >
                <Plus size={14} weight="light" />
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
                      className={`flex items-center gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-2.5 py-1 font-mono text-[10px] sm:text-[10.5px] transition-all active:scale-[0.96] ${
                        reasoningEnabled
                          ? "border-brass/60 bg-brass/15 text-brasspale shadow-[0_0_10px_rgba(227,176,75,0.2)] font-medium"
                          : "border-hairline bg-ink/[0.03] text-muted hover:border-brass/30 hover:text-ink"
                      }`}
                    >
                      <Brain
                        size={12}
                        weight={reasoningEnabled ? "fill" : "regular"}
                        className={reasoningEnabled ? "text-brass" : "text-muted"}
                      />
                      <span className="hidden xs:inline">Reasoning</span>
                      <span className="xs:hidden">Think</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onWebSearchChange(!webSearchEnabled)}
                    aria-pressed={webSearchEnabled}
                    title={
                      webSearchEnabled
                        ? "Web Search active — Searches live web summaries & external knowledge"
                        : "Enable Web Search (useful when no sources are attached)"
                    }
                    className={`flex items-center gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-2.5 py-1 font-mono text-[10px] sm:text-[10.5px] transition-all active:scale-[0.96] ${
                      webSearchEnabled
                        ? "border-moon/60 bg-moon/15 text-moon shadow-[0_0_10px_color-mix(in_srgb,var(--moon)_20%,transparent)] font-medium"
                        : "border-hairline bg-ink/[0.03] text-muted hover:border-moon/30 hover:text-ink"
                    }`}
                  >
                    <Globe
                      size={12}
                      weight={webSearchEnabled ? "fill" : "regular"}
                      className={webSearchEnabled ? "text-moon" : "text-muted"}
                    />
                    <span className="hidden xs:inline">Web Search</span>
                    <span className="xs:hidden">Web</span>
                  </button>
                </div>
              </div>
              <span className="flex-1" />
              {tkEstimate > 0 && (
                <span className="chip-in mr-1 hidden font-mono text-[9.5px] tracking-[0.06em] text-muted/60 sm:inline">
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
                  className={`relative mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-fast disabled:opacity-50 ${
                    voice.state === "idle"
                      ? "border-transparent text-muted hover:bg-ink/[0.06] hover:text-ink"
                      : "border-brass/50 bg-brass/[0.09] text-brasspale"
                  }`}
                >
                  {voice.state === "listening" && (
                    <span
                      aria-hidden
                      className="absolute inset-0 animate-ping rounded-full bg-brass/25 [animation-duration:1.6s]"
                    />
                  )}
                  <Microphone
                    size={14}
                    weight={voice.state === "idle" ? "light" : "fill"}
                    className="relative z-10"
                  />
                </motion.button>
              )}
              <AnimatePresence mode="popLayout" initial={false}>
                {streaming ? (
                  <motion.button
                    key="stop"
                    initial={{ opacity: 0, scale: 0.55, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.55, rotate: 90 }}
                    transition={SPRING}
                    whileHover={{ scale: 1.07 }}
                    whileTap={{ scale: 0.88 }}
                    onClick={onStop}
                    className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline-strong text-ink transition-colors duration-fast hover:border-rust/60 hover:bg-rust/[0.09] hover:text-rust"
                    aria-label="Stop generating"
                    title="Stop"
                  >
                    <Stop size={13} weight="fill" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="send"
                    data-armed={hasText}
                    initial={{ opacity: 0, scale: 0.55, rotate: 90 }}
                    animate={{ opacity: hasText ? 1 : 0.45, scale: 1, rotate: 0 }}
                    whileHover={hasText ? { scale: 1.08 } : undefined}
                    whileTap={{ scale: 0.88 }}
                    transition={SPRING}
                    onClick={() => onSend()}
                    aria-label="Send message"
                    disabled={!hasText}
                    className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[12px] grad-lamp text-night disabled:cursor-not-allowed"
                  >
                    <span aria-hidden className="send-halo" />
                    <AnimatePresence mode="wait" initial={false}>
                      {hasText ? (
                        <motion.span
                          key="plane"
                          initial={{ opacity: 0, y: 9, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -9, scale: 0.5 }}
                          transition={{ duration: 0.17, ease: HOUSE }}
                          className="relative z-[1] flex"
                        >
                          <PaperPlaneRight size={15} weight="bold" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="up"
                          initial={{ opacity: 0, y: -9, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 9, scale: 0.5 }}
                          transition={{ duration: 0.17, ease: HOUSE }}
                          className="relative z-[1] flex"
                        >
                          <ArrowUp size={16} weight="bold" />
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
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 4, height: 0 }}
            transition={SOFT}
            className="relative mx-auto mt-2 flex w-full max-w-3xl flex-wrap items-center justify-center gap-1.5 px-2 py-0.5"
          >
            {FOLLOW_UPS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onSend(item.prompt)}
                title={item.prompt}
                className="group flex items-center gap-1.5 rounded-full border border-hairline/80 bg-surface/90 px-3 py-1 text-[11.5px] font-medium text-muted shadow-xs transition-all duration-200 hover:border-brass/45 hover:bg-brass/[0.08] hover:text-brasspale active:scale-[0.98]"
              >
                <Sparkle size={10} weight="fill" className="shrink-0 text-brass/60 group-hover:text-brass transition-colors" />
                <span>{item.label}</span>
                <ArrowRight size={11} className="shrink-0 opacity-50 group-hover:translate-x-0.5 group-hover:opacity-90 transition-all" />
              </button>
            ))}
            <button
              type="button"
              onClick={onDismissFollowUps}
              title="Dismiss suggestions"
              aria-label="Dismiss suggestions"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted/50 transition-colors hover:bg-ink/[0.08] hover:text-ink active:scale-90"
            >
              <X size={12} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Disclaimer — spacious, centered, un-cramped */}
      <p className="mx-auto mt-2 text-center text-[11px] text-muted/55 select-none tracking-normal">
        Comtus can make mistakes. Double-check important information with your sources.
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
      ? "no sources yet"
      : focus === null || focus.length === sources.length
        ? `all ${sources.length} sources`
        : focus.length === 0
          ? "no sources focused"
          : `${focus.length} of ${sources.length} sources`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Choose which sources answers ground in"
        className={`flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] transition-all active:scale-[0.97] ${
          open
            ? "border-brass/70 bg-brass/20 text-brasspale shadow-[0_0_12px_rgba(227,176,75,0.2)]"
            : "border-hairline bg-ink/[0.03] text-muted hover:border-brass/40 hover:text-brasspale"
        }`}
      >
        <Stack size={11} weight="light" className="shrink-0" />
        <span className="max-w-[10rem] truncate sm:max-w-none">{label}</span>
        <CaretDown
          size={9}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={POPOVER.initial}
            animate={POPOVER.animate}
            exit={POPOVER.exit}
            transition={SOFT}
            role="listbox"
            className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-2xl border border-hairline-strong bg-surface/95 p-1 text-ink shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-hairline px-3 py-1.5 text-[11px] text-muted">
              <span>Grounding Sources</span>
              {sources.length > 0 && (
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-brass hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-muted/40">|</span>
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
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(s.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[12.5px] text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
                        checked ? "border-brass/60 bg-brass/25 text-brasspale" : "border-hairline-strong"
                      }`}
                    >
                      {checked && <Check size={9} weight="bold" />}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-hairline px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted/70">
              Answers cite your sources · key stays local
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
