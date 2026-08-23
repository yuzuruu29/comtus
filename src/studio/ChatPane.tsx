import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  Brain,
  CaretDown,
  Chats,
  Flame,
  PaperPlaneRight,
  PencilSimple,
  Plus,
  Quotes,
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
} from "../lib/db";
import type { ChatMessage, ChatSession, Notebook, Citation } from "../lib/types";
import { deriveSessionTitle } from "../lib/sessionText";
import { streamChat, friendlyError, isAbort } from "../lib/llm";
import { useSettings, useCallSettings } from "../lib/settings";
import { Collapse, SOFT, SPRING, HOUSE, Spotlight, BorderBeam } from "./fx";
import { timeAgo } from "./ui";

const STARTERS = [
  "Summarize the key ideas across my sources",
  "What terms or concepts should I be able to define?",
  "Where do my sources disagree, if anywhere?",
  "Make me a 10-item quiz on the hardest part",
];

/** Remembered thread per notebook — survives reloads and desk restarts. */
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
  const [streaming, setStreaming] = useState<{ text: string; thinking: string; phase?: "reading" | "thinking" | "answering" } | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  /** Guards async loads against out-of-order resolution when switching fast. */
  const loadToken = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  /** Composer textarea — measured imperatively for auto-grow. */
  const taRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  // Notebook changed: load its threads, restore the remembered one.
  // Keyed on identity, not the object — renaming a notebook shouldn't
  // reset an open thread.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- id-only reload
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

  // Close the switcher on outside click or Escape; disarm pending delete.
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

  // Leaving the notebook mid-stream shouldn't keep spending tokens.
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

  /** Mirror a db-side updatedAt bump into the local, sorted list. */
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
    if (token !== loadToken.current) return; // notebook switched meanwhile
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
    // Two-click confirm — first click arms, second click deletes.
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
      // Last thread deleted — hand back a clean one.
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

      // A thread to type into is guaranteed on load; this is belt-and-braces.
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

      // First question names the chat.
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

  // Auto-grow — the field stretches with its content, up to the cap.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  if (!notebook) return <div className="flex-1" />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Session bar — the ref spans bar + dropdown so interacting with
          either never counts as an outside click. */}
      <div
        ref={menuRef}
        className="relative z-30 flex h-11 shrink-0 items-center gap-1 border-b border-hairline bg-ground px-2 sm:px-3"
      >
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          className="no-drag flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 transition-colors duration-fast hover:bg-ink/5"
        >
          <Chats size={14} weight="light" className="shrink-0 text-brass" />
          <span className="label-mono hidden !text-[10px] sm:inline">Chats</span>
          <span className="min-w-0 max-w-[36vw] truncate text-[13px] font-[450] text-ink sm:max-w-[22rem]">
            {activeSession?.title || "New chat"}
          </span>
          <CaretDown
            size={12}
            weight="light"
            className={`shrink-0 text-muted transition-transform duration-300 ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => void newSession()}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors duration-fast hover:bg-brass/[0.1] hover:text-brasspale"
          aria-label="New chat"
          title="New chat"
        >
          <Plus size={15} weight="light" />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.14 } }}
              transition={SOFT}
              role="listbox"
              aria-label="Chat sessions"
              className="absolute left-2 top-[calc(100%+6px)] w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--radius-field)] border border-hairline bg-surface shadow-modal sm:left-3"
            >
              <div className="max-h-[min(20rem,52vh)] overflow-y-auto py-1">
                {sessions.length === 0 && (
                  <div className="px-4 py-6 text-center text-[12.5px] text-muted">
                    No chats yet.
                  </div>
                )}
                {sessions.map((session) => {
                  const isActive = session.id === activeId;
                  const isRenaming = renamingId === session.id;
                  return (
                    <div key={session.id} className="group/row relative">
                      {isRenaming ? (
                        <div className="px-3 py-1.5">
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => void commitRename()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void commitRename();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setRenamingId(null);
                              }
                            }}
                            className="w-full rounded-[var(--radius-field)] border border-brass/50 bg-ground/60 px-2.5 py-1.5 text-[13px] text-ink outline-none"
                            aria-label="Chat name"
                          />
                        </div>
                      ) : (
                        <button
                          role="option"
                          aria-selected={isActive}
                          onClick={() => selectSession(session.id)}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 pr-[4.6rem] text-left transition-colors duration-fast ${
                            isActive ? "bg-brass/[0.07]" : "hover:bg-ink/[0.04]"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              isActive ? "bg-brass" : "border border-hairline-strong"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] leading-tight text-ink">
                              {session.title || "New chat"}
                            </span>
                            <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted/60">
                              {timeAgo(session.updatedAt)}
                            </span>
                          </span>
                        </button>
                      )}
                      {!isRenaming && (
                        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover/row:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(session);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/[0.06] hover:text-ink"
                            aria-label={`Rename ${session.title || "chat"}`}
                          >
                            <PencilSimple size={13} weight="light" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeSession(session.id);
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] ${
                              armedDeleteId === session.id
                                ? "bg-rust/[0.12] text-rust"
                                : "text-muted hover:bg-rust/[0.08] hover:text-rust"
                            }`}
                            aria-label={
                              armedDeleteId === session.id
                                ? `Click again to delete ${session.title || "chat"}`
                                : `Delete ${session.title || "chat"}`
                            }
                          >
                            <Trash size={13} weight="light" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => void newSession()}
                className="flex w-full items-center gap-2 border-t border-hairline px-3.5 py-2.5 text-left text-[12.5px] text-muted transition-colors duration-fast hover:bg-brass/[0.06] hover:text-brasspale"
              >
                <Plus size={13} weight="light" />
                New chat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="chat-scroll min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-3xl px-5 pb-8 pt-8">
          {messages.length === 0 && !streaming && (
            <div className="mt-[10vh]">
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

      {/* Composer — the lamp-lit writing instrument. Wakes on focus:
          brass hairline, lamplight lift shadow, an orbiting border
          beam, and a warm pool of light gathering beneath it. */}
      <div className="relative shrink-0 px-4 pb-[calc(0.9rem+var(--sab))] pt-2 sm:px-5 sm:pb-[0.95rem]">
        {/* Fade trailing messages into the desk as they pass under */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-7 h-7 bg-gradient-to-b from-transparent to-ground"
        />
        {/* Ambient lamplight pooling beneath the composer */}
        <div
          aria-hidden
          className={`composer-ambience pointer-events-none absolute inset-x-6 -top-12 bottom-0 ${
            focused || streaming ? "is-lit" : ""
          }`}
        />
        <Spotlight radius={230} className="mx-auto w-full max-w-3xl">
          <motion.div
            data-focused={focused ? "" : undefined}
            data-streaming={streaming ? "" : undefined}
            animate={{ y: focused || streaming ? -2 : 0 }}
            transition={{ duration: 0.34, ease: HOUSE }}
            className="composer-shell relative"
          >
            {(focused || streaming) && (
              <BorderBeam size={84} duration={streaming ? 3.4 : 5} />
            )}
            <div className="relative z-[2] flex items-end gap-2 px-3.5 pb-2.5 pt-3">
              <textarea
                ref={taRef}
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
                placeholder="Ask, or say what to drill…"
                className="min-h-[26px] flex-1 resize-none bg-transparent text-[16px] leading-relaxed text-ink caret-brass outline-none placeholder:text-muted/55 sm:text-[14px]"
              />
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
                    onClick={() => abortRef.current?.abort()}
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
                    onClick={() => void send()}
                    disabled={!hasText}
                    className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full grad-lamp text-night disabled:cursor-not-allowed"
                    aria-label="Send"
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
          </motion.div>
        </Spotlight>

        {/* Footer rail — quiet affordances that brighten with focus */}
        <div className="relative mx-auto mt-2 flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span
            className={`hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors duration-300 sm:flex ${
              focused ? "text-muted" : "text-muted/45"
            }`}
          >
            <kbd className="kbd-chip">↵</kbd> send
            <kbd className="kbd-chip ml-1">⇧↵</kbd> newline
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted/45 transition-colors duration-300">
            {streaming ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 animate-pulse rounded-full bg-brass" />
                Answering from your sources…
              </span>
            ) : (
              "Answers cite your sources · key stays local"
            )}
          </span>
        </div>
      </div>
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
}: {
  msg: ChatMessage;
  streaming?: boolean;
  /** Present only while live-streaming: what the model is doing right now. */
  phase?: "reading" | "thinking" | "answering";
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
            {phase === "thinking" ? "Thinking…" : phase === "answering" ? "Answering…" : "Reading the sources…"}
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
