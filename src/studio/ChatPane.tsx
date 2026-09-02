import {
  useCallback,
  useEffect,
  useMemo,
  memo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mathRemarkPlugins, mathRehypePlugins } from "../lib/markdownMath";
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
  Globe,
  Microphone,
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
import { loadFocus, pruneFocus, saveFocus, subscribeFocus } from "./focus";
import ModelPickerMenu from "./ModelPickerMenu";
import ComposerSideRailDock from "./ComposerSideRail";
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
import type { ChatMessage, ChatSession, Notebook, Citation, WebSearchMeta } from "../lib/types";
import { deriveSessionTitle } from "../lib/sessionText";
import { streamChat, friendlyError, isAbort } from "../lib/llm";
import type { ChatReply } from "../lib/llm";
import { useSmoothText } from "../lib/useSmoothText";
import { useSettings, useCallSettings } from "../lib/settings";
import StudyGlyph from "../components/icons/StudyGlyph";
import { Collapse, SOFT, SPRING, HOUSE, DRIFT_X, RISE_1, POPOVER } from "./fx";
import { Toast } from "./Toast";
import { timeAgo } from "./ui";
import { appendTranscript } from "../lib/voice";
import { useVoiceInput } from "./useVoiceInput";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Id of the assistant message that just handed off from the streaming slot;
  // that one bubble mounts entrance-free so the swap paints identically.
  const [settledId, setSettledId] = useState<string | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [input, setInput] = useState("");
  // Voice input lands in the composer for review — never auto-sent.
  const voice = useVoiceInput((text) => setInput((prev) => appendTranscript(prev, text)));
  const [streaming, setStreaming] = useState<{
    text: string;
    thinking: string;
    phase?: "searching" | "reading" | "thinking" | "answering";
    webSearch?: WebSearchMeta;
  } | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [error, setError] = useState("");
  const [searchBanner, setSearchBanner] = useState<WebSearchMeta | null>(null);
  const [toastNoteSaved, setToastNoteSaved] = useState(false);
  const [dismissedFollowUps, setDismissedFollowUps] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // How the live stream is ending — written BEFORE setStreaming(null) so the
  // streaming slot can pick its exit: "commit" swaps instantly into the
  // identical persisted bubble, "abort" fades away.
  const streamEndRef = useRef<"commit" | "abort">("abort");
  const searchMetaRef = useRef<WebSearchMeta | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);
  const loadToken = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Typewriter reveal of the streaming answer. The finished reply is held in
  // finalizeRef until the reveal has drained, so the tail doesn't snap in at
  // network speed the instant the stream ends.
  const smoothed = useSmoothText(streaming?.text ?? "", !!streaming);
  const finalizeRef = useRef<{
    reply: ChatReply;
    sessionId: string;
    notebookId: string;
    token: number;
  } | null>(null);
  const [finalizeTick, setFinalizeTick] = useState(0);

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
  }, [streaming, messages, smoothed.text]);

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

  const handleSaveToNote = useCallback(
    async (title: string, text: string) => {
      if (!notebook) return;
      await createCustomNote(notebook.id, title, text);
      // Toast owns the fuse (and its hover/focus pause) from here.
      setToastNoteSaved(true);
    },
    [notebook],
  );

  const toggleThinking = useCallback(() => setThinkingOpen((v) => !v), []);

  const send = useCallback(
    async (raw?: string) => {
      const question = (raw ?? input).trim();
      if (!question || !notebook || streaming) return;
      if (!hasKey()) {
        setError("Add your API key in Settings (or select a local/free model) first — the lamp needs it.");
        return;
      }
      setError("");
      setSearchBanner(null);
      searchMetaRef.current = null;
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
      streamEndRef.current = "abort";
      setStreaming({
        text: "",
        thinking: "",
        phase: webSearchEnabled ? "searching" : "reading",
      });

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
          sourceIds: focusedSources !== null ? focusedSources : undefined,
          reasoning: reasoningEnabled,
          webSearch: webSearchEnabled,
          signal: controller.signal,
          onSearchStart: () =>
            setStreaming((s) => (s ? { ...s, phase: "searching" } : s)),
          onSearchDone: (meta) => {
            searchMetaRef.current = meta;
            setStreaming((s) => (s ? { ...s, phase: "reading", webSearch: meta } : s));
          },
          onThinking: (_d, full) =>
            setStreaming((s) => (s ? { ...s, thinking: full, phase: "thinking" } : s)),
          onText: (_d, full) => {
            setStreaming((s) => (s ? { ...s, text: full, phase: "answering" } : s));
            setThinkingOpen(false);
          },
        });
        // Answer complete — hold it until the typewriter catches up so the
        // tail doesn't pop in at network speed (commit happens in the drain
        // effect below).
        finalizeRef.current = {
          reply,
          sessionId,
          notebookId: notebook.id,
          token: loadToken.current,
        };
        // From here every render of the streaming slot carries the instant
        // exit — when the drain commits, the persisted twin replaces it in
        // the same paint instead of stacking behind a fade.
        streamEndRef.current = "commit";
        abortRef.current = null;
        setFinalizeTick((n) => n + 1);
      } catch (err) {
        abortRef.current = null;
        finalizeRef.current = null;
        streamEndRef.current = "abort";
        setStreaming(null);
        if (!isAbort(err) && !controller.signal.aborted) {
          setError(friendlyError(err));
          if (searchMetaRef.current) setSearchBanner(searchMetaRef.current);
        }
      }
    },
    [input, notebook, streaming, hasKey, cs, messages, activeId, activeSession, reasoningEnabled, webSearchEnabled],
  );

  useEffect(() => {
    const fin = finalizeRef.current;
    if (!fin || !smoothed.caughtUp) return;
    finalizeRef.current = null;
    void (async () => {
      const assistant: ChatMessage = {
        id: uid(),
        notebookId: fin.notebookId,
        sessionId: fin.sessionId,
        role: "assistant",
        content: fin.reply.text,
        thinking: fin.reply.thinking,
        citations: fin.reply.citations,
        webSearch: fin.reply.webSearch,
        createdAt: Date.now(),
      };
      await saveMessage(assistant);
      setStreaming(null);
      setSearchBanner(null);
      if (fin.token !== loadToken.current) return;
      setSettledId(assistant.id);
      setMessages((m) => [...m, assistant]);
      bumpSession(fin.sessionId);
    })();
  }, [finalizeTick, smoothed.caughtUp]);


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
                      className={`group relative flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-2.5 py-1 text-left text-[12.5px] transition-colors ${
                        isActive
                          ? "bg-brass/10 text-brasspale font-medium"
                          : "text-muted hover:bg-ink/[0.04] hover:text-ink"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectSession(session.id)}
                        className="truncate min-w-0 flex-1 py-0.5 text-left outline-none cursor-pointer focus-visible:underline"
                      >
                        {session.title || "New chat"}
                      </button>

                      {/* Right-hand slot: timestamp at rest, swaps smoothly to edit/delete buttons on hover */}
                      <div className="relative flex items-center justify-end shrink-0 pl-2">
                        {/* Timestamp — visible at rest, fades out on hover */}
                        <span
                          className={`font-mono text-[9px] text-muted/60 transition-all duration-200 ${
                            "opacity-70 group-hover:opacity-0 group-hover:invisible group-hover:scale-95"
                          }`}
                        >
                          {timeAgo(session.updatedAt)}
                        </span>

                        {/* Edit & Delete Actions — hidden at rest, fades & glides in on hover */}
                        <div
                          className="absolute right-0 flex items-center gap-0.5 opacity-0 translate-x-1 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto"
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
                            className="flex h-5 w-5 items-center justify-center rounded text-muted/70 hover:bg-rust/15 hover:text-rust transition-colors"
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash size={12} weight="bold" />
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
                : "No sources added yet. Add documents or links in Sources to ground your discussions."}
            </p>

            {/* Quick Starters Grid — kept mounted; collapse-grid folds it away
                once the conversation starts (no unmount layout snap). */}
            <div className={`collapse-grid mt-5 ${messages.length === 0 ? "is-open" : ""}`}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {STARTERS.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
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
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                settled={m.id === settledId}
                onCite={onNavigateSources}
                onSaveToNote={handleSaveToNote}
              />
            ))}

            {/* Streaming slot — AnimatePresence owns the teardown: an instant
                drop when committing (the identical persisted bubble takes over
                in one paint), a short fade on abort/error. */}
            <AnimatePresence initial={false}>
              {streaming && (
                <MessageBubble
                  msg={{
                    id: "streaming",
                    notebookId: notebook.id,
                    sessionId: activeId ?? undefined,
                    role: "assistant",
                    content: smoothed.text,
                    thinking: streaming.thinking,
                    webSearch: streaming.webSearch,
                    createdAt: Date.now(),
                  }}
                  streaming
                  phase={streaming.phase}
                  thinkingOpen={thinkingOpen}
                  onToggleThinking={toggleThinking}
                  onCite={onNavigateSources}
                  onSaveToNote={handleSaveToNote}
                  leave={streamEndRef.current === "commit" ? "instant" : "fade"}
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

      {/* Composer — console deck. Three bands inside the lamp-lit
          shell: context strip, textarea, action rail. No orbiting
          beam or spotlight wash — those read as a yellow bar on
          click. The shell still wakes with a brass ring. */}
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
        <div className="mx-auto w-full max-w-3xl rounded-[var(--radius-dialog)]">
          <div
            data-focused={focused ? "" : undefined}
            data-streaming={streaming ? "" : undefined}
            className="composer-shell relative"
          >

            <div className="relative z-[2]">
              {/* Context strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible no-scrollbar px-3 sm:px-3.5 pb-2 pt-2 sm:pt-2.5">
                <div className="relative shrink-0">
                  <ModelPickerMenu modelLabel={modelLabel} onOpenSettings={onOpenSettings} />
                </div>
                {notebook && (
                  <div className="relative shrink-0">
                    <FocusMenu notebook={notebook} sourcesVersion={sourcesVersion} />
                  </div>
                )}
                <span className="flex-1 min-w-1 sm:min-w-2" />
                <AnimatePresence>
                  {streaming && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, x: 4 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.92, x: 4, transition: { duration: 0.12 } }}
                      transition={SOFT}
                      className="phase-pill-inline shrink-0"
                      role="status"
                    >
                      <span className="phase-dot" />
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={streaming.phase ?? "reading"}
                          className="phase-label"
                          initial={{ opacity: 0, y: RISE_1 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -RISE_1 }}
                          transition={{ duration: 0.14, ease: HOUSE }}
                        >
                          {streaming.phase === "thinking"
                            ? "thinking"
                            : streaming.phase === "answering"
                              ? "answering"
                              : streaming.phase === "searching"
                                ? "searching the web"
                                : "reading sources"}
                        </motion.span>
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="relative shrink-0">
                  <ComposerSideRailDock onOpenSettings={onOpenSettings} />
                </div>
              </div>
              <div className="mx-3 sm:mx-3.5 border-t border-hairline" />

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
                  className="min-h-9 w-full resize-none border-0 bg-transparent text-[16px] leading-relaxed text-ink caret-brass outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 placeholder:text-muted/55 sm:text-[14px]"
                />
                {voice.state !== "idle" && (
                  <div className="flex min-h-5 items-center gap-2 text-[12px] leading-snug" role="status">
                    {(voice.state === "listening" || voice.state === "recording") && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass/50 [animation-duration:1.4s]" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-brass" />
                      </span>
                    )}
                    {voice.state === "listening" && (
                      <span className="truncate italic text-muted">
                        {voice.interim || "Listening…"}
                      </span>
                    )}
                    {voice.state === "recording" && (
                      <span className="font-mono text-[11px] text-muted">
                        Recording {Math.floor(voice.elapsed / 60)}:
                        {String(voice.elapsed % 60).padStart(2, "0")} — transcribes itself when
                        you pause
                      </span>
                    )}
                    {voice.state === "transcribing" && (
                      <span className="flex items-center gap-2 text-muted">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass/50 [animation-duration:1.6s]" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-brass" />
                        </span>
                        Transcribing…
                      </span>
                    )}
                  </div>
                )}
                {voice.error && (
                  <p role="alert" className="pt-1 text-[12px] leading-relaxed text-rust">
                    {voice.error}
                  </p>
                )}
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
                {/* Reasoning/Web-search rail — kept mounted so the toggles'
                    state survives streams; collapse-grid hides height and,
                    once visibility flips, keyboard tab order when folded. */}
                <div className={`collapse-grid ml-1 ${streaming ? "" : "is-open"}`}>
                  <div className="flex items-center gap-1.5">
                    {/* Deep Reasoning Toggle */}
                    <button
                      type="button"
                      onClick={() => setReasoningEnabled((v) => !v)}
                      aria-pressed={reasoningEnabled}
                      title={
                        reasoningEnabled
                          ? "Deep Reasoning active — Step-by-step logic, edge cases & verification"
                          : "Enable Deep Reasoning"
                      }
                      className={`flex items-center gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-2.5 py-1 font-mono text-[10px] sm:text-[10.5px] transition-all active:scale-[0.96] ${
                        reasoningEnabled
                          ? "border-brass/60 bg-brass/15 text-brasspale shadow-[0_0_10px_rgba(227,176,75,0.2)] font-medium"
                          : "border-hairline bg-ink/[0.03] text-muted hover:border-brass/30 hover:text-ink"
                      }`}
                    >
                      <Brain
                        size={12}
                        weight={reasoningEnabled ? "fill" : "regular"}
                        className={reasoningEnabled ? "text-brass" : "text-muted"}
                      />
                      <span className="hidden xs:inline">Reasoning</span>
                      <span className="xs:hidden">Think</span>
                    </button>

                    {/* Web Search Toggle */}
                    <button
                      type="button"
                      onClick={() => setWebSearchEnabled((v) => !v)}
                      aria-pressed={webSearchEnabled}
                      title={
                        webSearchEnabled
                          ? "Web Search active — Searches live web summaries & external knowledge"
                          : "Enable Web Search (useful when no sources are attached)"
                      }
                      className={`flex items-center gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-2.5 py-1 font-mono text-[10px] sm:text-[10.5px] transition-all active:scale-[0.96] ${
                        webSearchEnabled
                          ? "border-moon/60 bg-moon/15 text-moon shadow-[0_0_10px_color-mix(in_srgb,var(--moon)_20%,transparent)] font-medium"
                          : "border-hairline bg-ink/[0.03] text-muted hover:border-moon/30 hover:text-ink"
                      }`}
                    >
                      <Globe
                        size={12}
                        weight={webSearchEnabled ? "fill" : "regular"}
                        className={webSearchEnabled ? "text-moon" : "text-muted"}
                      />
                      <span className="hidden xs:inline">Web Search</span>
                      <span className="xs:hidden">Web</span>
                    </button>
                  </div>
                </div>
                <span className="flex-1" />
                {tkEstimate > 0 && (
                  <span className="chip-in mr-1 hidden font-mono text-[9.5px] tracking-[0.06em] text-muted/60 sm:inline">
                    ~{tkEstimate.toLocaleString()} tk
                  </span>
                )}
                {!streaming && (
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={voice.toggle}
                    disabled={voice.state === "transcribing"}
                    data-armed={voice.state !== "idle"}
                    title="Voice input — your browser's speech engine, or your own key for clip transcription"
                    aria-label="Voice input"
                    aria-pressed={voice.state !== "idle"}
                    className={`relative mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-fast disabled:opacity-50 ${
                      voice.state === "idle"
                        ? "border-transparent text-muted hover:bg-ink/[0.06] hover:text-ink"
                        : "border-brass/50 bg-brass/[0.09] text-brasspale"
                    }`}
                  >
                    {voice.state === "listening" && (
                      <span
                        aria-hidden
                        className="absolute inset-0 animate-ping rounded-full bg-brass/25 [animation-duration:1.6s]"
                      />
                    )}
                    <Microphone
                      size={14}
                      weight={voice.state === "idle" ? "light" : "fill"}
                      className="relative z-10"
                    />
                  </motion.button>
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
                      onClick={() => {
                        // While the typewriter drains a finished answer, Stop
                        // just finishes the reveal now instead of aborting.
                        if (finalizeRef.current) smoothed.flush();
                        else abortRef.current?.abort();
                      }}
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
          </div>
        </div>

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

      {/* Note Saved Toast Notification — shared Toast owns enter/exit and the
          hover-paused fuse; the card chrome stays with the caller because
          .toast-card carries none of the sage styling. */}
      <Toast
        open={toastNoteSaved}
        onClose={() => setToastNoteSaved(false)}
        durationMs={2600}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-sage/40 bg-surface px-4 py-2.5 text-[13px] text-sage shadow-modal"
      >
        <Check size={16} weight="bold" />
        <span role="status">Saved to Studio Notes</span>
      </Toast>
    </div>
  );
}

// Memoized so typewriter ticks only re-render the streaming bubble, not the
// whole transcript (ReactMarkdown re-parses on every render).
const MessageBubble = memo(function MessageBubble({
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

  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, x: DRIFT_X, scale: 0.98 }}
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
  // Transcript bubbles never animate out (session swaps replace the whole
  // list); the streaming slot picks its teardown by how the stream ended.
  const exit =
    leave === "instant"
      ? { opacity: 0, transition: { duration: 0 } }
      : leave === "fade"
        ? { opacity: 0, y: 6, transition: { duration: 0.15, ease: HOUSE } }
        : undefined;

  return (
    <motion.div
      initial={settled ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={exit}
      transition={SOFT}
      className="space-y-3"
    >
      {(msg.webSearch || phase === "searching") && (
        <SearchStatusStrip meta={msg.webSearch} searching={phase === "searching" && !msg.webSearch} />
      )}

      {/* High-Precision Pixelated Reasoning Process Drawer */}
      {hasThinking && (
        <div className="think-rule relative overflow-hidden rounded-xl border border-brass/35 bg-surface shadow-sm">
          {isThinking && <span className="pixel-reasoning-laser-top" aria-hidden="true" />}

          <button
            onClick={() => (onToggleThinking ? onToggleThinking() : setOpen((v) => !v))}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-brass/[0.06] cursor-pointer"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-brass/15 text-brass">
              <Brain size={14} weight="bold" />
            </div>

            <span
              className={`font-mono text-[12px] font-semibold tracking-wide ${
                isThinking ? "thinking-live" : "text-brass"
              }`}
            >
              {isThinking ? "COGNITIVE REASONING MATRIX ACTIVE…" : "Socratic Reasoning Process"}
            </span>

            {/* Pixelated Equalizer Waves while reasoning */}
            {isThinking && (
              <div className="flex items-center gap-1 h-3.5 px-1.5 py-0.5 rounded bg-brass/15 border border-brass/30" title="Active inference stream">
                <span className="pixel-eq-bar pixel-eq-bar-1" />
                <span className="pixel-eq-bar pixel-eq-bar-2" />
                <span className="pixel-eq-bar pixel-eq-bar-3" />
                <span className="pixel-eq-bar pixel-eq-bar-4" />
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted bg-ground px-2 py-0.5 rounded border border-hairline">
                {isThinking ? "STREAMING" : "TRACE"}
              </span>
              <CaretDown
                size={13}
                className={`text-muted transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
              />
            </div>
          </button>

          <Collapse open={open}>
            <div className="max-h-64 overflow-y-auto px-4 pb-3.5 pt-1 font-mono text-[12px] leading-relaxed text-ink/90 whitespace-pre-wrap border-t border-hairline bg-ground/50">
              {msg.thinking}
              {isThinking && <span className="pixel-thought-cursor" aria-hidden="true" />}
            </div>
          </Collapse>

          {/* Glowing light sweep while reasoning streams */}
          {isThinking && <span aria-hidden className="think-gloss" />}
        </div>
      )}

      {/* Formatted Markdown Content */}
      {msg.content ? (
        <div className="md text-[14.5px] leading-relaxed text-ink">
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
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brass/10 border border-brass/30 shadow-sm">
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

      {/* Citations list */}
      {citations.length > 0 && !streaming && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Quotes size={13} weight="light" className="text-muted/60 mr-1" />
          {/* Chips-only wrapper — .cite-chip staggers by nth-child, so nothing
              but chips may sit in here or every delay shifts by one slot. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {citations.map((c, i) => (
              <button
                key={`${c.sourceId ?? "cite"}-${i}`}
                onClick={() => c.sourceId && onCite(c.sourceId, c.startChar)}
                title={c.citedText.slice(0, 160)}
                className="cite-chip rounded-md border border-hairline bg-ink/[0.03] px-2 py-0.5 font-mono text-[10.5px] text-brasspale hover:border-brass/40 hover:bg-brass/10 transition-colors"
              >
                {i + 1} · {c.sourceTitle.length > 24 ? `${c.sourceTitle.slice(0, 24)}…` : c.sourceTitle}
              </button>
            ))}
          </div>
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
});

function formatSearchMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.max(ms, 0)}ms`;
}

function SearchStatusStrip({
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
        className="anim-rise flex items-center gap-2 rounded-xl border border-moon/25 bg-moon/[0.06] px-3.5 py-2 text-[12px] text-moon"
      >
        <Globe size={15} weight="fill" className="shrink-0 text-moon" />
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
        className="anim-rise anim-shake flex items-start gap-2 rounded-xl border border-rust/30 bg-rust/[0.07] px-3.5 py-2 text-[12px] text-rust"
      >
        <Flame size={15} className="mt-0.5 shrink-0" />
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
        className="anim-rise flex items-center gap-2 rounded-xl border border-hairline bg-ink/[0.03] px-3.5 py-2 text-[12px] text-muted"
      >
        <Globe size={15} className="shrink-0" />
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
      className="anim-rise flex items-center gap-2 rounded-xl border border-moon/25 bg-moon/[0.06] px-3.5 py-2 text-[12px] text-moon"
    >
      <Globe size={15} weight="fill" className="shrink-0 text-moon" />
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
      .then((rows) => {
        const list = rows.map((r) => ({ id: r.id, title: r.title }));
        setSources(list);
        const pruned = pruneFocus(notebook.id, list.map((s) => s.id));
        setFocus(pruned);
      });
  }, [notebook.id, sourcesVersion]);

  useEffect(() => {
    return subscribeFocus(notebook.id, (ids) => {
      setFocus(ids);
    });
  }, [notebook.id]);

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
    const value = next.length === sources.length ? null : next;
    setFocus(value);
    saveFocus(notebook.id, value);
  };

  const selectAll = () => {
    setFocus(null);
    saveFocus(notebook.id, null);
  };

  const selectNone = () => {
    setFocus([]);
    saveFocus(notebook.id, []);
  };

  const label =
    sources.length === 0
      ? "no sources yet"
      : focus === null || focus.length === sources.length
        ? `all ${sources.length} sources`
        : focus.length === 0
          ? "no sources focused"
          : `${focus.length} of ${sources.length} sources`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Choose which sources answers ground in"
        className={`flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] transition-all active:scale-[0.97] ${
          open
            ? "border-brass/70 bg-brass/20 text-brasspale shadow-[0_0_12px_rgba(227,176,75,0.2)]"
            : "border-hairline bg-ink/[0.03] text-muted hover:border-brass/40 hover:text-brasspale"
        }`}
      >
        <Stack size={11} weight="light" className="shrink-0" />
        <span className="max-w-[10rem] truncate sm:max-w-none">{label}</span>
        <CaretDown
          size={9}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={POPOVER.initial}
            animate={POPOVER.animate}
            exit={POPOVER.exit}
            transition={SOFT}
            role="listbox"
            className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-2xl border border-hairline-strong bg-surface/95 p-1 text-ink shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-hairline px-3 py-1.5 text-[11px] text-muted">
              <span>Grounding Sources</span>
              {sources.length > 0 && (
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-brass hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-muted/40">|</span>
                  <button
                    type="button"
                    onClick={selectNone}
                    className="text-muted hover:text-ink hover:underline cursor-pointer"
                  >
                    None
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {sources.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted">
                  Add sources in the Sources tab to ground your answers.
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
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[12.5px] text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
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
