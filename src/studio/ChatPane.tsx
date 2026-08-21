import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "motion/react";
import { ArrowUp, Square, Brain, ChevronDown, Quote, Flame } from "lucide-react";
import { db, saveMessage, uid } from "../lib/db";
import type { ChatMessage, Notebook, Citation } from "../lib/types";
import { streamChat, friendlyError, isAbort } from "../lib/llm";
import { useSettings, useCallSettings } from "../lib/settings";
import { Collapse, SOFT, SPRING, BorderBeam } from "./fx";
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
        const reply = await streamChat({
          ...cs,
          notebookId: notebook.id,
          notebookName: notebook.name,
          history: history.slice(0, -1),
          question,
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
              <h2 className="anim-rise mt-5 font-display text-[clamp(1.7rem,3.5vw,2.4rem)] font-[400] leading-snug text-parchment" style={{ "--d": "60ms" } as React.CSSProperties}>
                Ask about what you've read —{" "}
                <em className="font-[420] text-lamp">the sources answer.</em>
              </h2>
              {sourceCount === 0 && (
                <p className="anim-rise mt-4 max-w-md text-[14px] leading-relaxed text-faded" style={{ "--d": "120ms" } as React.CSSProperties}>
                  Add a source or two on the left, then come back. Comtus answers
                  from your material, not from thin air.
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
                    className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left text-[13px] leading-snug text-parchment/80 transition-colors duration-200 hover:border-brass/30 hover:bg-brass/[0.04]"
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
              <Flame size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-white/[0.06] bg-night/80 px-4 py-3 pb-[calc(0.75rem+var(--sab))] backdrop-blur sm:px-5 sm:py-4 sm:pb-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-[1.3rem] border border-white/[0.09] bg-study/80 px-3.5 py-2.5 transition-colors focus-within:border-brass/40 sm:px-4 sm:py-3">
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
              className="max-h-40 min-h-[26px] flex-1 resize-none bg-transparent text-[16px] leading-relaxed text-parchment outline-none placeholder:text-faded/60 sm:text-[14px]"
            />
            {streaming ? (
              <motion.button
                onClick={() => abortRef.current?.abort()}
                whileTap={{ scale: 0.9 }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-parchment transition-colors hover:bg-white/5 sm:h-9 sm:w-9"
                aria-label="Stop"
              >
                <Square size={14} />
              </motion.button>
            ) : (
              <motion.button
                onClick={() => void send()}
                disabled={!input.trim()}
                whileTap={{ scale: 0.9 }}
                className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full grad-lamp text-night transition-shadow duration-200 hover:shadow-[0_6px_24px_rgba(227,176,75,0.35)] disabled:opacity-30 sm:h-9 sm:w-9"
                aria-label="Send"
              >
                <ArrowUp size={17} strokeWidth={2.4} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
              </motion.button>
            )}
          </div>
          <div className="mt-2 text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-faded/55">
            AI can make mistakes — double-check answers against sources · Key stays local
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
        <div className="max-w-[85%] rounded-[1.2rem] rounded-br-md border border-white/[0.08] bg-white/[0.05] px-4.5 py-3 text-[14px] leading-relaxed text-parchment/95">
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
        <div className="relative overflow-hidden rounded-2xl border border-moon/20 bg-gradient-to-b from-moon/[0.09] via-moon/[0.045] to-moon/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_36px_-18px_rgba(42,54,84,0.6)] backdrop-blur-[2px]">
          {/* glossy top hairline */}
          <div
            aria-hidden
            className="absolute inset-x-5 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-moon/50 to-transparent"
          />
          {isThinking && (
            <>
              <div aria-hidden className="think-gloss" />
              <BorderBeam
                size={64}
                duration={5}
                colorFrom="rgba(127,168,201,0.85)"
                colorTo="rgba(227,176,75,0.45)"
              />
            </>
          )}
          <button
            onClick={() => (onToggleThinking ? onToggleThinking() : setOpen((v) => !v))}
            className="relative z-[2] flex w-full items-center gap-2.5 px-4 py-2.5 text-left"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-moon/30 bg-moon/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
              <Brain size={12} className="text-moon" />
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-moon/90">
              {isThinking ? (
                <span className="thinking-live">Thinking…</span>
              ) : (
                "Its reasoning"
              )}
            </span>
            <span className="ml-auto rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] text-faded/70">
              {msg.thinking!.length.toLocaleString()} chars
            </span>
            <ChevronDown
              size={13}
              className={`shrink-0 text-faded transition-transform duration-300 ${open ? "" : "-rotate-90"}`}
            />
          </button>
          <Collapse open={open}>
            <div className="relative z-[2] max-h-72 overflow-y-auto border-t border-moon/15 px-4 py-3 text-[12.5px] leading-[1.75] text-moon/75">
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
          <div className="flex items-center gap-2 text-[13px] text-faded">
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
          <Quote size={11} className="text-faded/70" />
          {citations.map((c, i) => (
            <motion.button
              key={i}
              variants={{
                hidden: { opacity: 0, scale: 0.6 },
                show: { opacity: 1, scale: 1, transition: SPRING },
              }}
              onClick={() => c.sourceId && onCite(c.sourceId, c.startChar)}
              title={c.citedText.slice(0, 160)}
              className="rounded-full border border-brass/25 bg-brass/[0.06] px-2.5 py-1 font-mono text-[10px] tracking-wide text-brasspale transition-colors duration-200 hover:bg-brass/[0.14]"
            >
              {c.sourceTitle.length > 26 ? `${c.sourceTitle.slice(0, 26)}…` : c.sourceTitle}
              {c.startChar !== undefined && ` · ¶${Math.floor(c.startChar / 1200) + 1}`}
            </motion.button>
          ))}
        </motion.div>
      )}

      {!streaming && (
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-faded/40">
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
