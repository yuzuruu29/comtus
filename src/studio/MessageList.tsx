import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, WarningCircle } from "@phosphor-icons/react";
import type { ChatMessage, Notebook, WebSearchMeta } from "../lib/types";
import { Button } from "../ui";
import { DRIFT_X, EXIT, SOFT } from "./fx";
import AssistantMessage, { SearchStatusStrip } from "./AssistantMessage";
import "./chat-welcome.css";
import { ICON } from "../ui/iconScale";

const STARTERS = [
  { label: "Find the key ideas", prompt: "Summarize the key ideas across my sources" },
  { label: "Explain a difficult concept", prompt: "What terms or concepts should I be able to define?" },
  { label: "Test my understanding", prompt: "Make me a 10-item quiz on the hardest part" },
];

function UserBubble({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: DRIFT_X }}
      animate={{ opacity: 1, x: 0 }}
      transition={SOFT}
      className="user-margin-note"
    >
      <span className="user-margin-kicker">You asked</span>
      <p className="user-margin-text">{content}</p>
    </motion.div>
  );
}

/** The scrollable transcript: notebook overview + starters, every message,
 *  the live streaming slot, and the error/search banners. */
export default function MessageList({
  notebook,
  sourceCount,
  messages,
  settledId,
  streaming,
  smoothedText,
  activeSessionId,
  thinkingOpen,
  onToggleThinking,
  onCite,
  onSaveToNote,
  onSend,
  onRetry,
  busy = false,
  onAddSources,
  hasModel = true,
  onOpenSettings,
  scrollRef,
  onScroll,
  error,
  errorNeedsModel = false,
  searchBanner,
  leave,
}: {
  notebook: Notebook;
  sourceCount: number;
  messages: ChatMessage[];
  settledId: string | null;
  streaming: {
    text: string;
    thinking: string;
    phase?: "searching" | "reading" | "thinking" | "answering";
    webSearch?: WebSearchMeta;
  } | null;
  smoothedText: string;
  activeSessionId: string | null;
  thinkingOpen: boolean;
  onToggleThinking: () => void;
  onCite: (sourceId: string, startChar?: number) => void;
  onSaveToNote: (title: string, content: string) => void;
  onSend: (prompt: string) => void;
  /** Ask the last, unanswered question again without writing it twice. */
  onRetry?: (prompt: string) => void;
  /** A question is being prepared, so an unanswered last note is not a dead end yet. */
  busy?: boolean;
  onAddSources?: () => void;
  hasModel?: boolean;
  onOpenSettings?: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  error: string;
  errorNeedsModel?: boolean;
  searchBanner: WebSearchMeta | null;
  leave: "instant" | "fade";
}) {
  const last = messages[messages.length - 1];
  const unanswered = !streaming && !busy && last?.role === "user" ? last : null;
  const showModels = errorNeedsModel && onOpenSettings;
  const showRetry = unanswered && onRetry;
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      role="log"
      aria-label="Chat history"
      className="chat-scroll min-h-0 flex-1 overflow-y-auto"
    >
      <div className="chat-reading-column">
        {messages.length === 0 && !streaming && (
          <section className="chat-welcome" aria-label="Start studying">
            <p className="chat-welcome-context">
              <span className="chat-welcome-rule" aria-hidden="true" />
              {sourceCount > 0 ? `${sourceCount} ${sourceCount === 1 ? "source" : "sources"} on your desk` : "A fresh page"}
            </p>
            <h1>{sourceCount > 0 ? "Follow a question." : "Understanding starts here."}</h1>
            <p className="chat-welcome-copy">
              {sourceCount > 0
                ? hasModel
                  ? "Find the thread between ideas. Ask about a passage, work through a concept, or see what you remember."
                  : "Your material is ready. Choose an AI model to ask questions and work through it together."
                : "Bring your reading, notes, and half-formed questions. This is where you work them out."}
            </p>
            {sourceCount > 0 && hasModel ? (
              <div className="chat-starters" aria-label="Ways to begin">
                {STARTERS.map(({ label, prompt }, index) => (
                  <button key={label} type="button" onClick={() => onSend(prompt)}>
                    <span className="chat-starter-index" aria-hidden="true">0{index + 1}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : sourceCount > 0 ? (
              onOpenSettings && <Button onClick={onOpenSettings}>Choose a model</Button>
            ) : (
              <>
                {/* chat-welcome.css hides this while the sources pane beside it shows its own Add source. */}
                {onAddSources && <Button variant="secondary" className="chat-welcome-add" icon={<Plus size={ICON.md} aria-hidden="true" />} onClick={onAddSources}>Add your first source</Button>}
                <p className="chat-welcome-hint">Add a PDF, your notes, or a web page from Sources. Start with one.</p>
              </>
            )}
          </section>
        )}

        {/* Message List */}
        <div className="space-y-6">
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} content={m.content} />
            ) : (
              <AssistantMessage
                key={m.id}
                msg={m}
                settled={m.id === settledId}
                onCite={onCite}
                onSaveToNote={onSaveToNote}
              />
            ),
          )}

          {/* Streaming slot — AnimatePresence owns the teardown: an instant
              drop when committing (the identical persisted bubble takes over
              in one paint), a short fade on abort/error. */}
          <AnimatePresence initial={false}>
            {streaming && (
              <AssistantMessage
                msg={{
                  id: "streaming",
                  notebookId: notebook.id,
                  sessionId: activeSessionId ?? undefined,
                  role: "assistant",
                  content: smoothedText,
                  thinking: streaming.thinking,
                  webSearch: streaming.webSearch,
                  createdAt: Date.now(),
                }}
                streaming
                phase={streaming.phase}
                thinkingOpen={thinkingOpen}
                onToggleThinking={onToggleThinking}
                onCite={onCite}
                onSaveToNote={onSaveToNote}
                leave={leave}
              />
            )}
          </AnimatePresence>
        </div>

        {(error || searchBanner || showRetry) && (
          <div className="mt-6 space-y-3">
            {searchBanner && <SearchStatusStrip meta={searchBanner} />}
            <AnimatePresence>
              {error && (
                <motion.div
                  role="alert"
                  className="anim-rise flex flex-wrap items-start gap-3 rounded-[var(--radius-dialog)] border border-rust/30 bg-rust/[0.07] px-4 py-3 text-small text-rust"
                  exit={{ opacity: 0, transition: EXIT }}
                >
                  <WarningCircle size={ICON.md} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1">{error}</span>
                  {(showModels || showRetry) && (
                    <span className="flex shrink-0 gap-2">
                      {showModels && <Button size="sm" onClick={onOpenSettings}>Open AI Models</Button>}
                      {showRetry && <Button size="sm" variant="secondary" onClick={() => onRetry(unanswered.content)}>Ask again</Button>}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {!error && showRetry && (
              <div className="flex flex-wrap items-center gap-3 px-1 text-label text-muted">
                <span className="min-w-0 flex-1">No answer came back for this question.</span>
                <Button size="sm" variant="secondary" onClick={() => onRetry(unanswered.content)}>Ask again</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
