import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Flame } from "@phosphor-icons/react";
import type { ChatMessage, Notebook, WebSearchMeta } from "../lib/types";
import StudyGlyph from "../components/icons/StudyGlyph";
import { DRIFT_X, SPRING } from "./fx";
import AssistantMessage, { SearchStatusStrip } from "./AssistantMessage";

const STARTERS = [
  "Summarize the key ideas across my sources",
  "What terms or concepts should I be able to define?",
  "Where do my sources disagree, if anywhere?",
  "Make me a 10-item quiz on the hardest part",
];

function UserBubble({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: DRIFT_X, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={SPRING}
      className="flex justify-end"
    >
      <div className="max-w-[82%] rounded-2xl bg-ink/[0.05] border border-hairline-strong px-4 py-3 text-body leading-relaxed text-ink shadow-sm">
        {content}
      </div>
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
  scrollRef,
  onScroll,
  error,
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
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  error: string;
  searchBanner: WebSearchMeta | null;
  leave: "instant" | "fade";
}) {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      role="log"
      aria-label="Chat history"
      className="chat-scroll min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto w-full max-w-3xl px-6 pb-8 pt-6">
        {/* Overview card */}
        <div className="mb-8 rounded-2xl border border-hairline/80 bg-surface/50 p-6 shadow-sm">
          <div className="flex items-center gap-3.5 mb-2">
            <StudyGlyph name={notebook.name} size="lg" />
            <div>
              <h1 className="font-display text-title font-[500] leading-snug text-ink">
                {notebook.name}
              </h1>
              <div className="font-mono text-label text-muted tracking-[0.06em]">
                {sourceCount} {sourceCount === 1 ? "source" : "sources"}
              </div>
            </div>
          </div>

          <p className="mt-3 text-body leading-relaxed text-ink/80">
            {sourceCount > 0
              ? "Your sources are analyzed and indexed. Ask questions, explore comparisons, extract key concepts, or create study aids grounded in your material."
              : "No sources added yet. Add documents or links in Sources to ground your discussions."}
          </p>

          {/* Quick Starters Grid — kept mounted; collapse-grid folds it away
              once the conversation starts (no unmount layout snap). */}
          <div className={`collapse-grid mt-5 ${messages.length === 0 ? "is-open" : ""}`}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTERS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  style={{ ["--d" as string]: `${i * 30}ms` }}
                  className="chip-in flex items-center justify-between rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-left text-[12.5px] text-ink/90 transition-all hover:border-brass/40 hover:bg-raised hover:text-brasspale active:scale-[0.98]"
                >
                  <span>{s}</span>
                  <ArrowRight size={13} className="text-muted/60 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        </div>

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

        {(error || searchBanner) && (
          <div className="mt-6 space-y-3">
            {searchBanner && <SearchStatusStrip meta={searchBanner} />}
            <AnimatePresence>
              {error && (
                <motion.div
                  role="alert"
                  className="anim-shake flex items-start gap-3 rounded-xl border border-rust/30 bg-rust/[0.07] px-4 py-3 text-[13px] text-rust"
                  exit={{ opacity: 0, transition: { duration: 0.18 } }}
                >
                  <Flame size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
