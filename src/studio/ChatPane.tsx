import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { externalMarkdownComponents } from "./ExternalLink";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
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
  Sparkle,
  Stack,
  Stop,
  Trash,
  X,
} from "@phosphor-icons/react";
import { loadFocus, saveFocus } from "./focus";
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
import StudyGlyph from "../components/icons/StudyGlyph";
import { Collapse, SOFT, SPRING, HOUSE, Spotlight, BorderBeam } from "./fx";
import { timeAgo } from "./ui";

const STARTERS = [
  "Summarize the key ideas across my sources",
  "What terms or concepts should I be able to define?",
  "Where do my sources disagree, if anywhere?",
  "Make me a 10-item quiz on the hardest part",
];

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

const lastSessionKey = (notebookId: string) => `comtus:lastChat:${notebookId}`;

export default function ChatPane({
  notebook,
  sourcesVersion,
  onNavigateSources,
  modelLabel,
  onOpenSettings,
  onAddSources,
}: {
  notebook: Notebook | null;
  sourcesVersion: number;
  onNavigateSources: (sourceId: string, startChar?: number) => void;
  modelLabel?: string;
  onOpenSettings?: () => void;
  onAddSources?: () => void;
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
  const [dismissedFollowUps, setDismissedFollowUps] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  const loadToken = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [showJump, setShowJump] = useState(false);
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

  useEffect(() => {
    if (!streaming) setShowJump(false);
  }, [streaming]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const stuck = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickBottom.current = stuck;
    setShowJump(!stuck);
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
          setDismissedFollowUps(false);
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
      setDismissedFollowUps(false);
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
  const tkEstimate = useMemo(
    () =>
      Math.round(
        (input.length + messages.reduce((n, m) => n + m.content.length, 0)) / 4,
      ),
    [input, messages],
  );

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 160)}px`;
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
                  const isArmed = armedDeleteId === session.id;

                  if (isRenaming) {
                    return (
                      <div key={session.id} className="p-1">
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
                    );
                  }

                  return (
                    <div
                      key={session.id}
                      onClick={() => selectSession(session.id)}
                      className={`group relative flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[12.5px] cursor-pointer transition-colors ${
                        isActive
                          ? "bg-brass/10 text-brasspale font-medium"
                          : "text-muted hover:bg-ink/[0.04] hover:text-ink"
                      }`}
                    >
                      <span className="truncate min-w-0 flex-1">{session.title || "New chat"}</span>

                      {/* Right-hand slot: timestamp at rest, swaps smoothly to edit/delete buttons on hover */}
                      <div
                        className="relative flex items-center justify-end shrink-0 pl-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Timestamp — visible at rest, fades out on hover */}
                        <span
                          className={`font-mono text-[9px] text-muted/60 transition-all duration-200 ${
                            isArmed
                              ? "opacity-0 invisible scale-95"
                              : "opacity-70 group-hover:opacity-0 group-hover:invisible group-hover:scale-95"
                          }`}
                        >
                          {timeAgo(session.updatedAt)}
                        </span>

                        {/* Edit & Delete Actions — hidden at rest, fades & glides in on hover */}
                        <div
                          className={`absolute right-0 flex items-center gap-0.5 transition-all duration-200 ${
                            isArmed
                              ? "opacity-100 translate-x-0 pointer-events-auto"
                              : "opacity-0 translate-x-1 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(session);
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted/70 hover:bg-ink/[0.08] hover:text-ink transition-colors"
                            title="Rename"
                            aria-label="Rename"
                          >
                            <PencilSimple size={12} weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeSession(session.id);
                            }}
                            className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
                              isArmed
                                ? "bg-rust/20 text-rust"
                                : "text-muted/70 hover:bg-rust/15 hover:text-rust"
                            }`}
                            title={isArmed ? "Click again to confirm delete" : "Delete"}
                            aria-label="Delete"
                          >
                            <Trash size={12} weight={isArmed ? "fill" : "bold"} />
                          </button>
                        </div>
                      </div>
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
            {/* Top Row: Study Glyph & Title */}
            <div className="flex items-center gap-3.5 mb-2">
              <StudyGlyph name={notebook.name} size="lg" />
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

      {/* Composer — console deck. Three bands inside the lamp-lit
          shell: context strip, textarea, action rail. Wakes on
          focus with beam + lamplight as before. */}
      <div className="relative shrink-0 px-4 pb-[0.9rem] pt-2 sm:px-5 sm:pb-[0.95rem] lg:pb-[calc(0.95rem+var(--sab))]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-7 h-7 bg-gradient-to-b from-transparent to-ground"
        />
        <div
          aria-hidden
          className={`composer-ambience pointer-events-none absolute inset-x-6 -top-12 bottom-0 ${
            focused || streaming ? "is-lit" : ""
          }`}
        />
        <AnimatePresence>
          {streaming && showJump && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
              transition={SOFT}
              onClick={() => {
                const el = scrollRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                stickBottom.current = true;
                setShowJump(false);
              }}
              className="absolute -top-9 right-4 z-20 flex items-center gap-1.5 rounded-full border border-hairline-strong bg-raised px-3 py-1.5 text-[11.5px] text-ink shadow-modal"
            >
              <ArrowDown size={11} weight="light" />
              Jump to latest
              <span className="h-1 w-1 rounded-full bg-brass" />
            </motion.button>
          )}
        </AnimatePresence>
        <Spotlight radius={230} className="mx-auto w-full max-w-3xl rounded-[var(--radius-dialog)]">
          <motion.div
            data-focused={focused ? "" : undefined}
            data-streaming={streaming ? "" : undefined}
            animate={{ y: focused || streaming ? -2 : 0 }}
            transition={{ duration: 0.34, ease: HOUSE }}
            className="composer-shell relative"
          >
            <AnimatePresence>
              {(focused || streaming) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
                >
                  <BorderBeam size={84} duration={streaming ? 3.4 : 5} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {streaming && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.92, transition: { duration: 0.12 } }}
                  transition={SOFT}
                  className="phase-pill"
                  role="status"
                >
                  <span className="phase-dot" />
                  {streaming.phase === "thinking"
                    ? "thinking"
                    : streaming.phase === "answering"
                      ? "answering"
                      : "reading sources"}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative z-[2]">
              {/* Context strip */}
              <div className="flex items-center gap-1.5 px-3.5 pb-2 pt-2.5">
                <button
                  onClick={() => onOpenSettings?.()}
                  title="Change model in Settings"
                  className="flex min-w-0 items-center gap-1.5 rounded-full border border-brass/35 bg-brass/[0.07] px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] text-brasspale transition-colors hover:bg-brass/[0.14]"
                >
                  <Sparkle size={10} weight="fill" className="shrink-0 text-brass" />
                  <span className="max-w-[9rem] truncate sm:max-w-[11rem]">{modelLabel ?? cs.model}</span>
                  <CaretDown size={9} className="shrink-0" />
                </button>
                {notebook && <FocusMenu notebook={notebook} sourcesVersion={sourcesVersion} />}
                <span className="flex-1" />
                {sourceCount > 0 && (
                  <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-muted/60 sm:inline">
                    grounded
                  </span>
                )}
              </div>
              <div className="mx-3.5 border-t border-hairline" />

              {/* Textarea band */}
              <div className="px-3.5 pb-1.5 pt-2.5">
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
                  placeholder="Ask, or say what to drill…"
                  className="min-h-9 w-full resize-none bg-transparent text-[16px] leading-relaxed text-ink caret-brass outline-none placeholder:text-muted/55 sm:text-[14px]"
                />
              </div>

              {/* Action rail */}
              <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
                <button
                  onClick={() => onAddSources?.()}
                  title="Add sources"
                  aria-label="Add sources"
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
                >
                  <Plus size={14} weight="light" />
                </button>
                {!streaming && (
                  <>
                    <span className="mx-0.5 h-4 w-px bg-ink/10" />
                    {(
                      [
                        ["Quiz me", "Make me a 10-item quiz on the hardest part of my sources"],
                        ["Flashcards", "Turn the key concepts in my sources into flashcards, front and back"],
                        ["Outline", "Build me a structured study outline from my sources"],
                      ] as const
                    ).map(([label, prompt]) => (
                      <button
                        key={label}
                        onClick={() => void send(prompt)}
                        className="shrink-0 whitespace-nowrap rounded-full border border-hairline bg-ink/[0.03] px-2 py-1 text-[10.5px] text-muted transition-colors hover:border-brass/40 hover:bg-brass/[0.08] hover:text-brasspale sm:px-2.5 sm:text-[11px]"
                      >
                        {label}
                      </button>
                    ))}
                  </>
                )}
                <span className="flex-1" />
                {tkEstimate > 0 && (
                  <span className="mr-1 hidden font-mono text-[9.5px] tracking-[0.06em] text-muted/60 sm:inline">
                    ~{tkEstimate.toLocaleString()} tk
                  </span>
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
          </motion.div>
        </Spotlight>

        {/* Follow-up rail — only once there is an answer to follow up on and user has not dismissed */}
        <AnimatePresence>
          {!streaming && !dismissedFollowUps && messages.some((m) => m.role === "assistant") && (
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
                  onClick={() => void send(item.prompt)}
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
                onClick={() => setDismissedFollowUps(true)}
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
  const [saved, setSaved] = useState(false);
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
        <div className="max-w-[82%] rounded-2xl bg-ink/[0.05] border border-hairline-strong px-4 py-3 text-[14px] leading-relaxed text-ink shadow-sm">
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
      className="space-y-3"
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
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Quotes size={13} weight="light" className="text-muted/60 mr-1" />
          {citations.map((c, i) => (
            <button
              key={i}
              onClick={() => c.sourceId && onCite(c.sourceId, c.startChar)}
              title={c.citedText.slice(0, 160)}
              className="rounded-md border border-hairline bg-ink/[0.03] px-2 py-0.5 font-mono text-[10.5px] text-brasspale hover:border-brass/40 hover:bg-brass/10 transition-colors"
            >
              {i + 1} · {c.sourceTitle.length > 24 ? `${c.sourceTitle.slice(0, 24)}…` : c.sourceTitle}
            </button>
          ))}
        </div>
      )}

      {/* Action bar — always visible, with explicit success feedback */}
      {!streaming && msg.content && (
        <div aria-live="polite" className="flex items-center justify-between pt-1">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted opacity-60">
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
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
                saved
                  ? "border-sage/40 bg-sage/[0.12] text-sage"
                  : "border-brass/35 bg-brass/[0.08] text-brasspale hover:bg-brass/[0.16]"
              }`}
              title="Save this answer to Studio Notes"
            >
              {saved ? <Check size={13} weight="bold" /> : <BookmarkSimple size={13} />}
              <span>{saved ? "Saved ✓" : "Save to note"}</span>
            </button>
            <button
              onClick={copyText}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
                copied
                  ? "border-sage/40 bg-sage/[0.12] text-sage"
                  : "border-hairline text-muted hover:border-hairline-strong hover:text-ink"
              }`}
              title="Copy answer"
            >
              {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
              <span>{copied ? "Copied ✓" : "Copy"}</span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
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
      .then((rows) => setSources(rows.map((r) => ({ id: r.id, title: r.title }))));
    setFocus(loadFocus(notebook.id));
  }, [notebook.id, sourcesVersion]);

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
    const value = next.length === sources.length || next.length === 0 ? null : next;
    setFocus(value);
    saveFocus(notebook.id, value);
  };

  const label =
    sources.length === 0
      ? "no sources yet"
      : focus === null
        ? `all ${sources.length} sources`
        : `${focus.length} of ${sources.length} sources`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Choose which sources answers ground in"
        className="flex min-w-0 items-center gap-1.5 rounded-full border border-hairline bg-ink/[0.03] px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] text-muted transition-colors hover:border-brass/40 hover:text-brasspale"
      >
        <Stack size={11} weight="light" className="shrink-0" />
        <span className="max-w-[10rem] truncate sm:max-w-none">{label}</span>
        <CaretDown size={9} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={SOFT}
            role="listbox"
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-[var(--radius-dialog)] border border-hairline bg-surface p-1 shadow-modal"
          >
            <div className="max-h-60 overflow-y-auto py-1">
              {sources.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted">
                  Add sources on the left to ground your answers.
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
                    className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[12.5px] text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
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
