import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "motion/react";
import { ArrowUp, Brain, CaretDown, Flame, Quotes, Stop } from "@phosphor-icons/react";
import { loadFocus } from "./focus";
import { db, saveMessage, uid } from "../lib/db";
import type { ChatMessage, Notebook, Citation } from "../lib/types";
import { streamChat, friendlyError, isAbort } from "../lib/llm";
import { useSettings, useCallSettings } from "../lib/settings";
import { Collapse, SOFT, SPRING } from "./fx";
import { timeAgo } from "./ui";

const STARTERS = [
  "Summarize the key ideas across my sources",
  "What terms or concepts should I be able to define?",
  "Where do my sources disagree, if anywhere?",
  "Make me a 10-item quiz on the hardest part",
];

export default function ChatPane({
  notebook,
  sourcesVersion,
  onNavigateSources,
}: {
  notebook: Notebook | null;
  sourcesVersion: number;
  onNavigateSources: (sourceId: string, startChar?: number) => void;
}) {
  const cs = useCallSettings();
  const hasKey = useSettings((s) => s.hasKey);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<{ text: string; thinking: string } | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [error, setError] = useState("");
  const [sourceCount, setSourceCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);

  useEffect(() => {
    if (!notebook) return;
    void db.messages
      .where("notebookId")
      .equals(notebook.id)
      .sortBy("createdAt")
      .then(setMessages);
  }, [notebook]);

  useEffect(() => {
    if (!notebook) return;
    void db.sources
      .where("notebookId")
      .equals(notebook.id)
      .count()
      .then(setSourceCount);
  }, [notebook, sourcesVersion]);

  // Keep pinned to the bottom while content arrives, unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickBottom.current) el.scrollTop = el.scrollHeight;
  }, [streaming, messages]);

  // Adjust scroll when virtual keyboard opens/closes on mobile
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vp = window.visualViewport;
    const handleResize = () => {
      const el = scrollRef.current;
      if (el && stickBottom.current) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    };
    vp.addEventListener("resize", handleResize);
    return () => vp.removeEventListener("resize", handleResize);
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const send = useCallback(
    async (raw?: string) => {
      const question = (raw ?? input).trim();
      if (!question || !notebook || streaming) return;
      if (!hasKey()) {
        setError("Add your API key in Settings (or select a local/free model) first — the lamp needs it.");
        return;
      }
      setError("");
      setInput("");

      const userMsg: ChatMessage = {
        id: uid(),
        notebookId: notebook.id,
        role: "user",
        content: question,
        createdAt: Date.now(),
      };
      await saveMessage(userMsg);
      const history = [...messages, userMsg];
      setMessages(history);
      stickBottom.current = true;
      setThinkingOpen(true);
      setStreaming({ text: "", thinking: "" });

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const focused = loadFocus(notebook.id);
        const reply = await streamChat({
          ...cs,
          notebookId: notebook.id,
          notebookName: notebook.name,
          history: history.slice(0, -1),
          question,
          sourceIds: focused && focused.length > 0 ? focused : undefined,
          signal: controller.signal,
          onThinking: (_d, full) =>
            setStreaming((s) => (s ? { ...s, thinking: full } : s)),
          onText: (_d, full) => {
            setStreaming((s) => (s ? { ...s, text: full } : s));
            // Once the answer starts, tuck the thinking panel away.
            setThinkingOpen(false);
          },
        });
        const assistant: ChatMessage = {
          id: uid(),
          notebookId: notebook.id,
          role: "assistant",
          content: reply.text,
          thinking: reply.thinking,
          citations: reply.citations,
          createdAt: Date.now(),
        };
        await saveMessage(assistant);
        setMessages((m) => [...m, assistant]);
      } catch (err) {
        if (!isAbort(err) && !controller.signal.aborted) {
          setError(friendlyError(err));
        }
      } finally {
        abortRef.current = null;
        setStreaming(null);
      }
    },
    [input, notebook, streaming, hasKey, cs, messages],
  );

  // Leaving the notebook mid-stream shouldn't keep spending tokens.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!notebook) return <div className="flex-1" />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="chat-scroll min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-3xl px-5 pb-8 pt-8">
          {messages.length === 0 && !streaming && (
            <div className="mt-[12vh]">
              <div className="anim-rise label-mono flex items-center gap-3">
                <span className="h-px w-8 grad-lamp" />
                {sourceCount > 0
                  ? `${sourceCount} source${sourceCount === 1 ? "" : "s"} on the desk`
                  : "An empty desk"}
              </div>
              <h2 className="anim-rise mt-5 font-display text-[clamp(1.7rem,3.5vw,2.4rem)] font-[400] leading-snug text-ink" style={{ "--d": "60ms" } as React.CSSProperties}>
                Ask about what you've read —{" "}
                <em className="font-[420] text-lamp">the sources answer.</em>
              </h2>
              {sourceCount === 0 && (
                <p className="anim-rise mt-4 max-w-md text-body leading-relaxed text-muted" style={{ "--d": "120ms" } as React.CSSProperties}>
                  Add a source or two on the left, then come back. Comtus answers
                  from your material, not from thin air. Sources never upload.
                  They are read on this device.
                </p>
              )}
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } } }}
                className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
              >
                {STARTERS.map((s) => (
                  <motion.button
                    key={s}
                    variants={{
                      hidden: { opacity: 0, y: 14 },
                      show: { opacity: 1, y: 0, transition: SOFT },
                    }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void send(s)}
                    className="rounded-xl border border-hairline bg-ink/[0.02] px-4 py-3 text-left text-[13px] leading-snug text-ink/80 transition-colors duration-200 hover:border-brass/30 hover:bg-brass/[0.04]"
                  >
                    {s}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          )}

          <div className="space-y-7">
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} onCite={onNavigateSources} />
            ))}
            {streaming && (
              <MessageBubble
                msg={{
                  id: "streaming",
                  notebookId: notebook.id,
                  role: "assistant",
                  content: streaming.text,
                  thinking: streaming.thinking,
                  createdAt: Date.now(),
                }}
                streaming
                thinkingOpen={thinkingOpen}
                onToggleThinking={() => setThinkingOpen((v) => !v)}
                onCite={onNavigateSources}
              />
            )}
          </div>

          {error && (
            <div className="anim-shake mt-6 flex items-start gap-3 rounded-xl border border-rust/30 bg-rust/[0.07] px-4 py-3 text-[13px] leading-relaxed text-rust">
              <Flame size={15} weight="light" className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-hairline bg-ground px-4 py-3 pb-[calc(0.75rem+var(--sab))] sm:px-5 sm:py-3 sm:pb-3">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-[var(--radius-field)] border border-hairline bg-surface px-3 py-2 transition-colors focus-within:border-brass/40">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Ask, or say what to drill…"
              className="max-h-40 min-h-[26px] flex-1 resize-none bg-transparent text-[16px] leading-relaxed text-ink outline-none placeholder:text-muted/60 sm:text-[14px]"
            />
            {streaming ? (
              <motion.button
                onClick={() => abortRef.current?.abort()}
                whileTap={{ scale: 0.9 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-hairline-strong text-ink hover:bg-ink/5"
                aria-label="Stop"
              >
                <Stop size={14} weight="fill" />
              </motion.button>
            ) : (
              <motion.button
                onClick={() => void send()}
                disabled={!input.trim()}
                whileTap={{ scale: 0.9 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] grad-lamp text-night disabled:opacity-30"
                aria-label="Send"
              >
                <ArrowUp size={16} weight="bold" />
              </motion.button>
            )}
          </div>
          <div className="mt-1.5 text-center text-[11px] text-muted/55">
            Double-check answers against sources. The key stays on this machine.
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  streaming = false,
  thinkingOpen = false,
  onToggleThinking,
  onCite,
}: {
  msg: ChatMessage;
  streaming?: boolean;
  thinkingOpen?: boolean;
  onToggleThinking?: () => void;
  onCite: (sourceId: string, startChar?: number) => void;
}) {
  const [open, setOpen] = useState(thinkingOpen);
  useEffect(() => setOpen(thinkingOpen), [thinkingOpen]);

  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, x: 22, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={SPRING}
        className="flex justify-end"
      >
        <div className="max-w-[78%] text-right text-[14px] leading-relaxed text-ink/80">
          {msg.content}
        </div>
      </motion.div>
    );
  }

  const citations = dedupeCitations(msg.citations ?? []);
  const hasThinking = !!msg.thinking?.trim();
  const isThinking = streaming && !msg.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SOFT}
      className="space-y-2.5"
    >
      {hasThinking && (
        <div className="think-rule overflow-hidden">
          {isThinking && <div aria-hidden className="think-gloss" />}
          <button
            onClick={() => (onToggleThinking ? onToggleThinking() : setOpen((v) => !v))}
            className="relative z-[2] flex w-full items-center gap-2 px-3 py-2 text-left"
          >
            <Brain size={14} weight="light" className="text-moon" />
            <span className="text-[12.5px] text-moon/90">
              {isThinking ? <span className="thinking-live">Thinking</span> : "Reasoning"}
            </span>
            <CaretDown
              size={13}
              weight="light"
              className={`ml-auto shrink-0 text-muted transition-transform duration-300 ${open ? "" : "-rotate-90"}`}
            />
          </button>
          <Collapse open={open}>
            <div className="relative z-[2] max-h-72 overflow-y-auto px-3 pb-3 text-[12.5px] leading-[1.75] text-moon/75">
              <p className="whitespace-pre-wrap">{msg.thinking}</p>
            </div>
          </Collapse>
        </div>
      )}

      {msg.content ? (
        <div className="md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          {streaming && <span className="stream-caret" />}
        </div>
      ) : (
        streaming && (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass" />
            Reading the sources…
          </div>
        )
      )}

      {msg.error && (
        <div className="rounded-xl border border-rust/30 bg-rust/[0.07] px-4 py-3 text-[13px] text-rust">
          {msg.error}
        </div>
      )}

      {citations.length > 0 && !streaming && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          className="flex flex-wrap items-center gap-1.5 pt-0.5"
        >
          <Quotes size={12} weight="light" className="text-muted/70" />
          {citations.map((c, i) => (
            <motion.button
              key={i}
              variants={{
                hidden: { opacity: 0, y: 4 },
                show: { opacity: 1, y: 0, transition: SPRING },
              }}
              onClick={() => c.sourceId && onCite(c.sourceId, c.startChar)}
              title={c.citedText.slice(0, 160)}
              className="cite-mark rounded-[var(--radius-control)] px-1.5 py-0.5 text-brasspale hover:bg-brass/[0.1]"
            >
              {i + 1} {c.sourceTitle.length > 28 ? `${c.sourceTitle.slice(0, 28)}…` : c.sourceTitle}
            </motion.button>
          ))}
        </motion.div>
      )}

      {!streaming && (
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted/40">
          {timeAgo(msg.createdAt)}
        </div>
      )}
    </motion.div>
  );
}

function dedupeCitations(list: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of list) {
    const key = `${c.sourceId}:${c.startChar ?? "x"}:${(c.citedText ?? "").slice(0, 32)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.slice(0, 12);
}
