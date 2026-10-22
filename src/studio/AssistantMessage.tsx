import { memo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "motion/react";
import { BookmarkSimple, Check, Copy, Flame, Globe } from "@phosphor-icons/react";
import { mathRemarkPlugins, mathRehypePlugins } from "../lib/markdownMath";
import { externalMarkdownComponents } from "./ExternalLink";
import type { ChatMessage, WebSearchMeta } from "../lib/types";
import { deriveSessionTitle } from "../lib/sessionText";
import { ENTER, EXIT, RISE_1, SOFT } from "./fx";
import { timeAgo } from "./ui";
import ThinkingDrawer from "./ThinkingDrawer";
import CitationList from "./CitationList";
import { ICON } from "../ui/iconScale";

function formatSearchMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.max(ms, 0)}ms`;
}

export function SearchStatusStrip({
  meta,
  searching,
}: {
  meta?: WebSearchMeta;
  searching?: boolean;
}) {
  if (searching && !meta) {
    return (
      <div
        key="searching"
        role="status"
        className="anim-rise flex items-center gap-2 rounded-[var(--radius-dialog)] border border-moon/25 bg-moon/[0.06] px-3.5 py-2 text-[12px] text-moon"
      >
        <Globe size={ICON.md} weight="fill" className="shrink-0 text-moon" />
        <span>Searching the web…</span>
      </div>
    );
  }
  if (!meta) return null;

  if (meta.status === "error") {
    return (
      <div
        key="error"
        role="status"
        className="anim-rise anim-shake flex items-start gap-2 rounded-[var(--radius-dialog)] border border-rust/30 bg-rust/[0.07] px-3.5 py-2 text-[12px] text-rust"
      >
        <Flame size={ICON.md} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div>Web search failed — answering without live pages</div>
          {meta.error && (
            <div className="mt-0.5 truncate font-mono text-[10.5px] text-rust/80">{meta.error}</div>
          )}
        </div>
        <span className="shrink-0 font-mono text-[10.5px] text-rust/70">{formatSearchMs(meta.ms)}</span>
      </div>
    );
  }

  if (meta.status === "empty") {
    return (
      <div
        key="empty"
        role="status"
        className="anim-rise flex items-center gap-2 rounded-[var(--radius-dialog)] border border-hairline bg-ink/[0.03] px-3.5 py-2 text-[12px] text-muted"
      >
        <Globe size={ICON.md} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">Searched the web · no results</span>
        {meta.query && (
          <span className="hidden max-w-[10rem] truncate font-mono text-[10.5px] sm:inline">
            {meta.query}
          </span>
        )}
        <span className="shrink-0 font-mono text-[10.5px]">{formatSearchMs(meta.ms)}</span>
      </div>
    );
  }

  const noun = meta.count === 1 ? "source" : "sources";
  return (
    <div
      key="results"
      role="status"
      className="anim-rise flex items-center gap-2 rounded-[var(--radius-dialog)] border border-moon/25 bg-moon/[0.06] px-3.5 py-2 text-[12px] text-moon"
    >
      <Globe size={ICON.md} weight="fill" className="shrink-0 text-moon" />
      <span className="min-w-0 flex-1">
        Fetched {meta.count} web {noun} just now
      </span>
      {meta.query && (
        <span
          title={meta.query}
          className="hidden max-w-[12rem] truncate font-mono text-[10.5px] text-moon/70 sm:inline"
        >
          {meta.query}
        </span>
      )}
      <span className="shrink-0 font-mono text-[10.5px] text-moon/70">
        {formatSearchMs(meta.ms)}
      </span>
    </div>
  );
}

// Memoized so typewriter ticks only re-render the streaming bubble, not the
// whole transcript (ReactMarkdown re-parses on every render).
const AssistantMessage = memo(function AssistantMessage({
  msg,
  streaming = false,
  phase,
  thinkingOpen = false,
  onToggleThinking,
  onCite,
  onSaveToNote,
  settled = false,
  leave = "none",
}: {
  msg: ChatMessage;
  streaming?: boolean;
  phase?: "searching" | "reading" | "thinking" | "answering";
  thinkingOpen?: boolean;
  onToggleThinking?: () => void;
  onCite: (sourceId: string, startChar?: number) => void;
  onSaveToNote?: (title: string, content: string) => void;
  /** Mount without the rise entrance — the just-committed handoff from the
   *  streaming slot swaps identical geometry in a single paint. */
  settled?: boolean;
  /** Streaming-slot teardown only: "instant" when committing (the persisted
   *  twin replaces it in the same paint), "fade" on abort/error, "none"
   *  (default) for transcript bubbles which never animate out. */
  leave?: "none" | "instant" | "fade";
}) {
  const [open, setOpen] = useState(thinkingOpen);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setOpen(thinkingOpen), [thinkingOpen]);

  const copyText = () => {
    void navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasThinking = !!msg.thinking?.trim();
  const isThinking = streaming && !msg.content;
  // Transcript bubbles never animate out (session swaps replace the whole
  // list); the streaming slot picks its teardown by how the stream ended.
  const exit =
    leave === "instant"
      ? { opacity: 0, transition: { duration: 0 } }
      : leave === "fade"
        ? { opacity: 0, y: -RISE_1, transition: EXIT }
        : undefined;

  return (
    <motion.div
      initial={settled ? false : ENTER.initial}
      animate={ENTER.animate}
      exit={exit}
      transition={SOFT}
      className="space-y-3"
    >
      {(msg.webSearch || phase === "searching") && (
        <SearchStatusStrip meta={msg.webSearch} searching={phase === "searching" && !msg.webSearch} />
      )}

      {hasThinking && (
        <ThinkingDrawer
          thinking={msg.thinking ?? ""}
          isThinking={isThinking}
          open={open}
          onToggle={() => (onToggleThinking ? onToggleThinking() : setOpen((v) => !v))}
        />
      )}

      {/* Formatted Markdown Content */}
      {msg.content ? (
        <div className="md md-answer text-ink">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, ...mathRemarkPlugins]}
            rehypePlugins={[...mathRehypePlugins]}
            components={externalMarkdownComponents}
          >
            {msg.content}
          </ReactMarkdown>
          {streaming && (
            <span className="stream-typing-beacon" aria-hidden="true">
              <span className="stream-typing-beacon-halo" />
              <span className="stream-typing-beacon-core" />
            </span>
          )}
        </div>
      ) : (
        streaming && (
          <div className="flex items-center gap-3 text-[13px] py-2.5 font-mono">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-pill)] bg-brass/10 border border-brass/30 shadow-sm">
              <span className="typing-harmonic-dot" />
              <span className="typing-harmonic-dot" />
              <span className="typing-harmonic-dot" />
            </div>
            <span className="text-[12px] font-semibold tracking-wide text-brass">
              {phase === "thinking"
                ? "Synthesizing deep reasoning & dialectic proofs…"
                : phase === "answering"
                  ? "Composing verified response…"
                  : phase === "searching"
                    ? "Searching scholarly corpus…"
                    : "Indexing study sources…"}
            </span>
          </div>
        )
      )}

      {!streaming && <CitationList citations={msg.citations ?? []} onCite={onCite} />}

      {/* Action bar — always visible, with explicit success feedback */}
      {!streaming && msg.content && (
        <div aria-live="polite" className="flex items-center justify-between pt-1">
          <span className="font-mono text-[10px] tabular-nums text-muted">
            {timeAgo(msg.createdAt)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (saved) return;
                const title = deriveSessionTitle(msg.content) || "Saved note";
                onSaveToNote?.(title, msg.content);
                setSaved(true);
                setTimeout(() => setSaved(false), 2400);
              }}
              className={`flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1 text-[12px] transition-colors ${
                saved
                  ? "border-sage/40 bg-sage/[0.12] text-sage"
                  : "border-brass/35 bg-brass/[0.08] text-brass hover:bg-brass/[0.16]"
              }`}
              title="Save this answer to Studio Notes"
            >
              {saved ? <Check size={ICON.sm} weight="bold" /> : <BookmarkSimple size={ICON.sm} />}
              <span>{saved ? "Saved ✓" : "Save to note"}</span>
            </button>
            <button
              onClick={copyText}
              className={`flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1 text-[12px] transition-colors ${
                copied
                  ? "border-sage/40 bg-sage/[0.12] text-sage"
                  : "border-hairline text-muted hover:border-hairline-strong hover:text-ink"
              }`}
              title="Copy answer"
            >
              {copied ? <Check size={ICON.sm} weight="bold" /> : <Copy size={ICON.sm} />}
              <span>{copied ? "Copied ✓" : "Copy"}</span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
});

export default AssistantMessage;
