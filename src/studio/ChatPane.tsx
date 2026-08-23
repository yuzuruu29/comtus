import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { externalMarkdownComponents } from "./ExternalLink";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BookmarkSimple,
  Brain,
  CaretDown,
  Check,
  Copy,
  Flame,
  PaperPlaneRight,
  PencilSimple,
  Plus,
  Quotes,
  SlidersHorizontal,
  Stop,
  Trash,
} from "@phosphor-icons/react";
import { loadFocus } from "./focus";
import {
  db,
  saveMessage,
  uid,
  ensureChatSessions,
  createChatSession,
  renameChatSession,
  deleteChatSession,
  createCustomNote,
} from "../lib/db";
import type { ChatMessage, ChatSession, Notebook, Citation } from "../lib/types";
import { deriveSessionTitle } from "../lib/sessionText";
import { streamChat, friendlyError, isAbort } from "../lib/llm";
import { useSettings, useCallSettings } from "../lib/settings";
import { getNotebookCoverEmoji } from "../lib/emoji";
import { Collapse, SOFT, SPRING, Spotlight } from "./fx";
import { timeAgo } from "./ui";

const STARTERS = [
  "Summarize the key ideas across my sources",
  "What terms or concepts should I be able to define?",
  "Where do my sources disagree, if anywhere?",
  "Make me a 10-item quiz on the hardest part",
];

const FOLLOW_UPS = [
  "What are the main key takeaways and practical implications?",
  "Compare and contrast the primary themes across sources",
  "Generate a detailed study outline based on these materials",
];

const lastSessionKey = (notebookId: string) => `comtus:lastChat:${notebookId}`;

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
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sourceCount, setSourceCount] = useState(0);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<{
    text: string;
    thinking: string;
    phase?: "reading" | "thinking" | "answering";
  } | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [error, setError] = useState("");
  const [toastNoteSaved, setToastNoteSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  const loadToken = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    abortRef.current?.abort();
    const nbId = notebook?.id;
    if (!nbId) return;
    const token = ++loadToken.current;
    void (async () => {
      const list = await ensureChatSessions(nbId);
      if (token !== loadToken.current) return;
      setSessions(list);
      const remembered = localStorage.getItem(lastSessionKey(nbId));
      const active = list.find((s) => s.id === remembered) ?? list[0] ?? null;
      setActiveId(active?.id ?? null);
      const msgs = active
        ? await db.messages.where("sessionId").equals(active.id).sortBy("createdAt")
        : [];
      if (token !== loadToken.current) return;
      setMessages(msgs);
    })();
  }, [notebook?.id]);

  useEffect(() => {
    if (!notebook) return;
    void db.sources
      .where("notebookId")
      .equals(notebook.id)
      .count()
      .then(setSourceCount);
  }, [notebook, sourcesVersion]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickBottom.current) el.scrollTop = el.scrollHeight;
  }, [streaming, messages]);

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

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const rememberActive = (nbId: string, id: string) => {
    try {
      localStorage.setItem(lastSessionKey(nbId), id);
    } catch {
      /* private mode */
    }
  };

  const bumpSession = (id: string) => {
    setSessions((prev) =>
      [...prev.map((s) => (s.id === id ? { ...s, updatedAt: Date.now() } : s))].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    );
  };

  const selectSession = useCallback(
    (id: string) => {
      setMenuOpen(false);
      if (!notebook || id === activeId) return;
      abortRef.current?.abort();
      const token = ++loadToken.current;
      setActiveId(id);
      rememberActive(notebook.id, id);
      void db.messages
        .where("sessionId")
        .equals(id)
        .sortBy("createdAt")
        .then((msgs) => {
          if (token !== loadToken.current) return;
          setMessages(msgs);
          stickBottom.current = true;
        });
    },
    [notebook, activeId],
  );

  const newSession = useCallback(async () => {
    if (!notebook) return;
    abortRef.current?.abort();
    const token = ++loadToken.current;
    const session = await createChatSession(notebook.id);
    if (token !== loadToken.current) return;
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    rememberActive(notebook.id, session.id);
    setMessages([]);
    stickBottom.current = true;
    setMenuOpen(false);
    setError("");
  }, [notebook]);

  const startRename = (session: ChatSession) => {
    setArmedDeleteId(null);
    setRenamingId(session.id);
    setRenameDraft(session.title);
  };

  const commitRename = async () => {
    const id = renamingId;
    const title = renameDraft.replace(/\s+/g, " ").trim();
    setRenamingId(null);
    if (!id || !title) return;
    await renameChatSession(id, title);
    setSessions((prev) =>
      [...prev.map((s) => (s.id === id ? { ...s, title, updatedAt: Date.now() } : s))].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    );
  };

  const removeSession = async (id: string) => {
    if (!notebook) return;
    if (armedDeleteId !== id) {
      setArmedDeleteId(id);
      return;
    }
    setArmedDeleteId(null);
    await deleteChatSession(id);
    const rest = sessions.filter((s) => s.id !== id);
    setSessions(rest);
    if (id !== activeId) return;

    abortRef.current?.abort();
    const token = ++loadToken.current;
    const next = rest[0];
    if (!next) {
      const fresh = await createChatSession(notebook.id);
      if (token !== loadToken.current) return;
      setSessions([fresh]);
      setActiveId(fresh.id);
      rememberActive(notebook.id, fresh.id);
      setMessages([]);
      return;
    }
    setActiveId(next.id);
    rememberActive(notebook.id, next.id);
    const msgs = await db.messages
      .where("sessionId")
      .equals(next.id)
      .sortBy("createdAt");
    if (token !== loadToken.current) return;
    setMessages(msgs);
    stickBottom.current = true;
  };

  const handleSaveToNote = async (title: string, text: string) => {
    if (!notebook) return;
    await createCustomNote(notebook.id, title, text);
    setToastNoteSaved(true);
    setTimeout(() => setToastNoteSaved(false), 2400);
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

      let sessionId = activeId;
      let untitled = activeSession ? !activeSession.title : true;
      if (!sessionId) {
        const createToken = ++loadToken.current;
        const created = await createChatSession(notebook.id);
        if (createToken !== loadToken.current) {
          setError("Switched threads mid-send — try again.");
          return;
        }
        sessionId = created.id;
        untitled = true;
        setSessions((prev) => [created, ...prev]);
        setActiveId(created.id);
        rememberActive(notebook.id, created.id);
      }

      const userMsg: ChatMessage = {
        id: uid(),
        notebookId: notebook.id,
        sessionId,
        role: "user",
        content: question,
        createdAt: Date.now(),
      };
      await saveMessage(userMsg);

      if (untitled) {
        const title = deriveSessionTitle(question);
        if (title) {
          await renameChatSession(sessionId, title);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s,
            ),
          );
        }
      }

      const history = [...messages, userMsg];
      setMessages(history);
      stickBottom.current = true;
      setThinkingOpen(true);
      setStreaming({ text: "", thinking: "", phase: "reading" });

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const focusedSources = loadFocus(notebook.id);
        const reply = await streamChat({
          ...cs,
          notebookId: notebook.id,
          notebookName: notebook.name,
          history: history.slice(0, -1),
          question,
          sourceIds: focusedSources && focusedSources.length > 0 ? focusedSources : undefined,
          signal: controller.signal,
          onThinking: (_d, full) =>
            setStreaming((s) => (s ? { ...s, thinking: full, phase: "thinking" } : s)),
          onText: (_d, full) => {
            setStreaming((s) => (s ? { ...s, text: full, phase: "answering" } : s));
            setThinkingOpen(false);
          },
        });
        const assistant: ChatMessage = {
          id: uid(),
          notebookId: notebook.id,
          sessionId,
          role: "assistant",
          content: reply.text,
          thinking: reply.thinking,
          citations: reply.citations,
          createdAt: Date.now(),
        };
        await saveMessage(assistant);
        setMessages((m) => [...m, assistant]);
        bumpSession(sessionId);
      } catch (err) {
        if (!isAbort(err) && !controller.signal.aborted) {
          setError(friendlyError(err));
        }
      } finally {
        abortRef.current = null;
        setStreaming(null);
      }
    },
    [input, notebook, streaming, hasKey, cs, messages, activeId, activeSession],
  );

  const hasText = !!input.trim();
  const coverEmoji = getNotebookCoverEmoji(notebook?.name ?? "");

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 38), 160)}px`;
  }, [input]);

  if (!notebook) return <div className="flex-1" />;

  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      {/* Top Chat Bar matching Screenshot 2 */}
      <div
        ref={menuRef}
        className="relative z-30 flex h-11 shrink-0 items-center justify-between border-b border-hairline bg-ground px-4"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[15.5px] font-[450] text-ink">Chat</h2>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface/60 px-2.5 py-0.5 text-[11.5px] text-muted hover:border-hairline-strong hover:text-ink transition-colors"
          >
            <span className="truncate max-w-[14rem]">{activeSession?.title || "New chat"}</span>
            <CaretDown size={11} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => void newSession()}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink transition-colors"
            aria-label="New chat thread"
            title="New chat"
          >
            <Plus size={14} weight="light" />
          </button>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink transition-colors"
            title="Chat settings & sessions"
          >
            <SlidersHorizontal size={14} weight="light" />
          </button>
        </div>

        {/* Sessions Dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
              transition={SOFT}
              role="listbox"
              className="absolute left-4 top-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-[var(--radius-dialog)] border border-hairline bg-surface p-1 shadow-modal"
            >
              <div className="max-h-60 overflow-y-auto py-1">
                {sessions.map((session) => {
                  const isActive = session.id === activeId;
                  const isRenaming = renamingId === session.id;
                  return (
                    <div key={session.id} className="group relative">
                      {isRenaming ? (
                        <div className="p-1">
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => void commitRename()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void commitRename();
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            className="w-full rounded-[var(--radius-control)] border border-brass/50 bg-ground px-2 py-1 text-[12.5px] text-ink outline-none"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => selectSession(session.id)}
                          className={`flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                            isActive ? "bg-brass/10 text-brasspale font-medium" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
                          }`}
                        >
                          <span className="truncate flex-1">{session.title || "New chat"}</span>
                          <span className="font-mono text-[9px] opacity-60">{timeAgo(session.updatedAt)}</span>
                        </button>
                      )}

                      {!isRenaming && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(session);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-ink"
                            title="Rename"
                          >
                            <PencilSimple size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeSession(session.id);
                            }}
                            className={`flex h-6 w-6 items-center justify-center rounded ${
                              armedDeleteId === session.id ? "text-rust bg-rust/15" : "text-muted hover:text-rust"
                            }`}
                            title="Delete"
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => void newSession()}
                className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2 text-[12px] font-medium text-brasspale hover:bg-brass/[0.06] transition-colors"
              >
                <Plus size={13} />
                New chat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Messages Scroll View */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-label="Chat history"
        className="chat-scroll min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-3xl px-6 pb-8 pt-6">
          {/* Initial Overview Card matching Screenshot 2 */}
          <div className="mb-8 rounded-2xl border border-hairline/80 bg-surface/50 p-6 shadow-sm">
            {/* Top Row: Mascot Emoji & Title */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[28px] select-none">{coverEmoji}</span>
              <div>
                <h1 className="font-display text-[22px] font-[500] leading-snug text-ink">
                  {notebook.name}
                </h1>
                <div className="font-mono text-[11px] text-muted tracking-[0.06em]">
                  {sourceCount} {sourceCount === 1 ? "source" : "sources"}
                </div>
              </div>
            </div>

            {/* Grounded Synthesis Intro Text */}
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink/80">
              {sourceCount > 0
                ? "Your sources are analyzed and indexed. Ask questions, explore comparisons, extract key concepts, or create study aids grounded in your material."
                : "No sources added yet. Add documents or links on the left to ground your discussions."}
            </p>

            {/* Quick Starters Grid */}
            {messages.length === 0 && (
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-left text-[12.5px] text-ink/90 transition-all hover:border-brass/40 hover:bg-raised hover:text-brasspale active:scale-[0.98]"
                  >
                    <span>{s}</span>
                    <ArrowRight size={13} className="text-muted/60 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message List */}
          <div className="space-y-6">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                onCite={onNavigateSources}
                onSaveToNote={(title, content) => void handleSaveToNote(title, content)}
              />
            ))}

            {streaming && (
              <MessageBubble
                msg={{
                  id: "streaming",
                  notebookId: notebook.id,
                  sessionId: activeId ?? undefined,
                  role: "assistant",
                  content: streaming.text,
                  thinking: streaming.thinking,
                  createdAt: Date.now(),
                }}
                streaming
                phase={streaming.phase}
                thinkingOpen={thinkingOpen}
                onToggleThinking={() => setThinkingOpen((v) => !v)}
                onCite={onNavigateSources}
                onSaveToNote={(title, content) => void handleSaveToNote(title, content)}
              />
            )}
          </div>

          {error && (
            <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-rust/30 bg-rust/[0.07] px-4 py-3 text-[13px] text-rust">
              <Flame size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Composer matching Screenshot 2 */}
      <div className="relative shrink-0 px-4 pb-4 pt-2 sm:px-6">
        {/* Floating Capsule Composer */}
        <Spotlight radius={230} className="mx-auto w-full max-w-3xl">
          <div
            className={`relative rounded-2xl border transition-all duration-200 bg-surface/90 shadow-sm ${
              focused ? "border-brass/50 shadow-md ring-1 ring-brass/20" : "border-hairline hover:border-hairline-strong"
            }`}
          >
            <div className="flex items-end gap-2.5 px-4 pb-2.5 pt-3">
              <textarea
                ref={taRef}
                aria-label="Ask Comtus"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Start typing…"
                className="min-h-9 flex-1 resize-none bg-transparent text-[14.5px] leading-relaxed text-ink caret-brass outline-none placeholder:text-muted/60"
              />

              {/* Source count badge inside composer on right */}
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted/70 whitespace-nowrap select-none">
                  {sourceCount} {sourceCount === 1 ? "source" : "sources"}
                </span>

                {/* Circular Send Button */}
                {streaming ? (
                  <button
                    onClick={() => abortRef.current?.abort()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rust/20 text-rust hover:bg-rust/30 transition-all active:scale-95"
                    title="Stop generating"
                    aria-label="Stop generating"
                  >
                    <Stop size={14} weight="fill" />
                  </button>
                ) : (
                  <button
                    onClick={() => void send()}
                    disabled={!hasText}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-blue-600 transition-all"
                    aria-label="Send message"
                  >
                    <PaperPlaneRight size={15} weight="bold" />
                  </button>
                )}
              </div>
            </div>

            {/* Follow-up Prompt Chips Carousel matching Screenshot 2 */}
            <div className="border-t border-hairline/60 px-3.5 py-2 flex items-center gap-2 overflow-x-auto scroll-thin">
              {FOLLOW_UPS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/[0.04] px-3 py-1 text-[11.5px] text-muted hover:bg-brass/10 hover:text-brasspale transition-colors"
                >
                  <span className="truncate max-w-[20rem]">{prompt}</span>
                  <ArrowRight size={11} className="shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        </Spotlight>
      </div>

      {/* Note Saved Toast Notification */}
      <AnimatePresence>
        {toastNoteSaved && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={SOFT}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-sage/40 bg-surface px-4 py-2.5 text-[13px] text-sage shadow-modal"
          >
            <Check size={16} weight="bold" />
            <span>Saved to Studio Notes</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({
  msg,
  streaming = false,
  phase,
  thinkingOpen = false,
  onToggleThinking,
  onCite,
  onSaveToNote,
}: {
  msg: ChatMessage;
  streaming?: boolean;
  phase?: "reading" | "thinking" | "answering";
  thinkingOpen?: boolean;
  onToggleThinking?: () => void;
  onCite: (sourceId: string, startChar?: number) => void;
  onSaveToNote?: (title: string, content: string) => void;
}) {
  const [open, setOpen] = useState(thinkingOpen);
  const [copied, setCopied] = useState(false);
  useEffect(() => setOpen(thinkingOpen), [thinkingOpen]);

  const copyText = () => {
    void navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, x: 16, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={SPRING}
        className="flex justify-end"
      >
        <div className="max-w-[82%] rounded-2xl bg-brass/[0.12] border border-brass/25 px-4 py-3 text-[14px] leading-relaxed text-ink shadow-sm">
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SOFT}
      className="space-y-3 rounded-2xl border border-hairline/80 bg-surface/70 p-4 shadow-sm"
    >
      {/* Reasoning Process Drawer */}
      {hasThinking && (
        <div className="think-rule overflow-hidden rounded-xl border border-moon/25 bg-moon/[0.04]">
          <button
            onClick={() => (onToggleThinking ? onToggleThinking() : setOpen((v) => !v))}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors hover:bg-moon/[0.06]"
          >
            <Brain size={15} weight="light" className="text-moon" />
            <span className="text-[12px] font-medium text-moon/90">
              {isThinking ? "Thinking…" : "Reasoning process"}
            </span>
            <CaretDown
              size={13}
              className={`ml-auto text-muted transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            />
          </button>
          <Collapse open={open}>
            <div className="max-h-60 overflow-y-auto px-3.5 pb-3 text-[12.5px] leading-relaxed text-moon/80 whitespace-pre-wrap">
              {msg.thinking}
            </div>
          </Collapse>
        </div>
      )}

      {/* Formatted Markdown Content */}
      {msg.content ? (
        <div className="md text-[14.5px] leading-relaxed text-ink/90">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={externalMarkdownComponents}>
            {msg.content}
          </ReactMarkdown>
          {streaming && <span className="stream-caret ml-1 inline-block h-3.5 w-1.5 bg-brass" />}
        </div>
      ) : (
        streaming && (
          <div className="flex items-center gap-2 text-[13px] text-muted py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />
            {phase === "thinking" ? "Thinking…" : phase === "answering" ? "Composing answer…" : "Reading sources…"}
          </div>
        )
      )}

      {/* Citations list */}
      {citations.length > 0 && !streaming && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-hairline/60">
          <Quotes size={13} weight="light" className="text-muted/60 mr-1" />
          {citations.map((c, i) => (
            <button
              key={i}
              onClick={() => c.sourceId && onCite(c.sourceId, c.startChar)}
              title={c.citedText.slice(0, 160)}
              className="rounded-md border border-hairline bg-surface px-2 py-0.5 font-mono text-[10.5px] text-brasspale hover:border-brass/40 hover:bg-brass/10 transition-colors"
            >
              [{i + 1}] {c.sourceTitle.length > 24 ? `${c.sourceTitle.slice(0, 24)}…` : c.sourceTitle}
            </button>
          ))}
        </div>
      )}

      {/* Action Footer (Save to Note & Copy) */}
      {!streaming && msg.content && (
        <div className="flex items-center justify-between pt-1 text-[11.5px] text-muted">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] opacity-60">
            {timeAgo(msg.createdAt)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const title = deriveSessionTitle(msg.content) || "Saved note";
                onSaveToNote?.(title, msg.content);
              }}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-muted hover:bg-ink/[0.06] hover:text-ink transition-colors"
              title="Save to Studio Notes"
            >
              <BookmarkSimple size={13} />
              <span>Save to note</span>
            </button>
            <button
              onClick={copyText}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-muted hover:bg-ink/[0.06] hover:text-ink transition-colors"
              title="Copy answer"
            >
              {copied ? <Check size={13} className="text-sage" /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
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
  return out.slice(0, 10);
}
