import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Books, Flame, Plus } from "@phosphor-icons/react";
import type { ChatMessage, Notebook, WebSearchMeta } from "../lib/types";
import { Button } from "../ui";
import { DRIFT_X, SPRING } from "./fx";
import AssistantMessage, { SearchStatusStrip } from "./AssistantMessage";
import "./chat-welcome.css";

const STARTERS = [
  { label: "Find the key ideas", prompt: "Summarize the key ideas across my sources" },
  { label: "Explain a difficult concept", prompt: "What terms or concepts should I be able to define?" },
  { label: "Test my understanding", prompt: "Make me a 10-item quiz on the hardest part" },
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
  onAddSources,
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
  onAddSources?: () => void;
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
        {messages.length === 0 && !streaming && (
          <section className="chat-welcome" aria-label="Start studying">
            <div className="chat-welcome-mark" aria-hidden="true"><Books size={30} weight="light" /></div>
            <p className="chat-welcome-context">{notebook.name}</p>
            <h1>{sourceCount > 0 ? "What would you like to understand?" : "Start with your study material."}</h1>
            <p className="chat-welcome-copy">
              {sourceCount > 0
                ? `Ask a question, connect ideas, or put your knowledge to the test. Your ${sourceCount === 1 ? "source is" : `${sourceCount} sources are`} here to keep the answers grounded.`
                : "Bring a chapter, lecture notes, or a link. Turn what you are reading into something you understand."}
            </p>
            {sourceCount > 0 ? (
              <div className="chat-starters">
                {STARTERS.map(({ label, prompt }) => (
                  <button key={label} type="button" onClick={() => onSend(prompt)}>{label}</button>
                ))}
              </div>
            ) : (
              <>
                {onAddSources && <Button icon={<Plus size={16} aria-hidden="true" />} onClick={onAddSources}>Add your first source</Button>}
                <p className="chat-welcome-hint">You can also start with a question below.</p>
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
