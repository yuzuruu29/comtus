import { memo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "motion/react";
import { BookmarkSimple, Check, Copy, Globe, WarningCircle } from "@phosphor-icons/react";
import { mathRemarkPlugins, mathRehypePlugins } from "../lib/markdownMath";
import { closeStreamingMarkdown, rehypeCitationMarks, rehypeStreamCursor } from "../lib/streamingMarkdown";
import { externalMarkdownComponents } from "./ExternalLink";
import type { ChatMessage, WebSearchMeta } from "../lib/types";
import { deriveSessionTitle } from "../lib/sessionText";
import { ENTER, EXIT, RISE_1, SOFT } from "./fx";
import { timeAgo } from "./ui";
import ThinkingDrawer from "./ThinkingDrawer";
import CitationList from "./CitationList";
import { ICON } from "../ui/iconScale";

/** One quiet line above the answer saying what the web search did. Neutral
 *  paper: moon is for reasoning and brass for action, and this is neither. */
export function SearchStatusStrip({
  meta,
  searching,
}: {
  meta?: WebSearchMeta;
  searching?: boolean;
}) {
  if (!meta && !searching) return null;
  const failed = meta?.status === "error";
  const text = !meta
    ? "Searching the web…"
    : failed
      ? "Web search didn’t go through. This answer doesn’t use live pages."
      : meta.status === "empty"
        ? "Searched the web and found nothing useful."
        : `Read ${meta.count} web ${meta.count === 1 ? "page" : "pages"}`;

  return (
    <div
      key={meta?.status ?? "searching"}
      role="status"
      title={failed ? meta?.error : undefined}
      className="search-strip anim-rise"
      data-tone={failed ? "error" : undefined}
    >
      {failed ? (
        <WarningCircle size={ICON.md} className="shrink-0" />
      ) : (
        <Globe size={ICON.md} className={`shrink-0 ${meta ? "" : "breathe"}`} />
      )}
      <span className="min-w-0 flex-1">{text}</span>
      {meta?.query && !failed && (
        <span title={meta.query} className="search-strip-query">
          {meta.query}
        </span>
      )}
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
        <div className={`md md-answer text-ink${streaming ? " md-live" : ""}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, ...mathRemarkPlugins]}
            rehypePlugins={streaming ? [...mathRehypePlugins, rehypeCitationMarks, rehypeStreamCursor] : [...mathRehypePlugins, rehypeCitationMarks]}
            components={externalMarkdownComponents}
          >
            {streaming ? closeStreamingMarkdown(msg.content) : msg.content}
          </ReactMarkdown>
        </div>
      ) : (
        // The search strip and the thinking drawer already say what is
        // happening; this line only covers the gap before either appears.
        streaming && !hasThinking && phase !== "searching" && (
          <div role="status" className="flex items-center gap-2.5 py-2">
            <span className="typing-dots" aria-hidden="true">
              <span className="typing-harmonic-dot" />
              <span className="typing-harmonic-dot" />
              <span className="typing-harmonic-dot" />
            </span>
            <span className="text-label text-moon">
              {phase === "thinking" ? "Thinking…" : phase === "answering" ? "Writing…" : "Reading…"}
            </span>
          </div>
        )
      )}

      {!streaming && <CitationList citations={msg.citations ?? []} onCite={onCite} />}

      {/* Action bar — always visible, with explicit success feedback */}
      {!streaming && msg.content && (
        <div aria-live="polite" className="flex items-center justify-between pt-1">
          <span className="text-label tabular-nums text-muted">{timeAgo(msg.createdAt)}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (saved) return;
                const title = deriveSessionTitle(msg.content) || "Saved note";
                onSaveToNote?.(title, msg.content);
                setSaved(true);
                setTimeout(() => setSaved(false), 2400);
              }}
              data-done={saved ? "" : undefined}
              className="answer-action"
              title="Save this answer to your notes"
            >
              {saved ? <Check size={ICON.sm} weight="bold" /> : <BookmarkSimple size={ICON.sm} />}
              <span>{saved ? "Saved" : "Save to note"}</span>
            </button>
            <button
              onClick={copyText}
              data-done={copied ? "" : undefined}
              className="answer-action"
              title="Copy answer"
            >
              {copied ? <Check size={ICON.sm} weight="bold" /> : <Copy size={ICON.sm} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
});

export default AssistantMessage;
