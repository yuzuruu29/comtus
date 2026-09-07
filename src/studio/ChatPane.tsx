import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
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
import type { ChatMessage, ChatSession, Notebook, WebSearchMeta } from "../lib/types";
import { deriveSessionTitle } from "../lib/sessionText";
import { streamChat, friendlyError, isAbort } from "../lib/llm";
import type { ChatReply } from "../lib/llm";
import { useSmoothText } from "../lib/useSmoothText";
import { useSettings, useCallSettings } from "../lib/settings";
import { Toast } from "../ui";
import { appendTranscript } from "../lib/voice";
import { useVoiceInput } from "./useVoiceInput";
import SessionMenu from "./SessionMenu";
import MessageList from "./MessageList";
import Composer from "./Composer";

const lastSessionKey = (notebookId: string) => `comtus:lastChat:${notebookId}`;

export default function ChatPane({
  notebook,
  sourcesVersion,
  onNavigateSources,
  modelLabel,
  onOpenSettings,
  onAddSources,
  capabilities,
}: {
  notebook: Notebook | null;
  sourcesVersion: number;
  onNavigateSources: (sourceId: string, startChar?: number) => void;
  modelLabel?: string;
  onOpenSettings?: () => void;
  onAddSources?: () => void;
  /** Task 3.3 supplies real model capabilities; until then callers may pass
   *  { thinking: false } to hide the composer's Think toggle. */
  capabilities?: { thinking?: boolean };
}) {
  const cs = useCallSettings();
  const hasKey = useSettings((s) => s.hasKey);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
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
  const [showJump, setShowJump] = useState(false);
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

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
    setError("");
  }, [notebook]);

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    await renameChatSession(id, title);
    setSessions((prev) =>
      [...prev.map((s) => (s.id === id ? { ...s, title, updatedAt: Date.now() } : s))].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    );
  }, []);

  const removeSession = useCallback(
    async (id: string) => {
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
      const msgs = await db.messages.where("sessionId").equals(next.id).sortBy("createdAt");
      if (token !== loadToken.current) return;
      setMessages(msgs);
      stickBottom.current = true;
    },
    [notebook, sessions, activeId],
  );

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

  const stop = useCallback(() => {
    // While the typewriter drains a finished answer, Stop just finishes the
    // reveal now instead of aborting.
    if (finalizeRef.current) smoothed.flush();
    else abortRef.current?.abort();
  }, [smoothed]);

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

  const tkEstimate = useMemo(
    () =>
      Math.round(
        (input.length + messages.reduce((n, m) => n + m.content.length, 0)) / 4,
      ),
    [input, messages],
  );

  if (!notebook) return <div className="flex-1" />;

  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <SessionMenu
        sessions={sessions}
        activeId={activeId}
        onSelect={selectSession}
        onNew={() => void newSession()}
        onRename={(id, title) => void handleRenameSession(id, title)}
        onDelete={(id) => void removeSession(id)}
      />

      <MessageList
        notebook={notebook}
        sourceCount={sourceCount}
        messages={messages}
        settledId={settledId}
        streaming={streaming}
        smoothedText={smoothed.text}
        activeSessionId={activeId}
        thinkingOpen={thinkingOpen}
        onToggleThinking={toggleThinking}
        onCite={onNavigateSources}
        onSaveToNote={(title, text) => void handleSaveToNote(title, text)}
        onSend={(prompt) => void send(prompt)}
        scrollRef={scrollRef}
        onScroll={onScroll}
        error={error}
        searchBanner={searchBanner}
        leave={streamEndRef.current === "commit" ? "instant" : "fade"}
      />

      <Composer
        notebook={notebook}
        sourcesVersion={sourcesVersion}
        modelLabel={modelLabel}
        onOpenSettings={onOpenSettings}
        onAddSources={onAddSources}
        capabilities={capabilities}
        input={input}
        onInputChange={setInput}
        onSend={(prompt) => void send(prompt)}
        onStop={stop}
        streaming={streaming}
        showJump={showJump}
        onJumpToLatest={() => {
          const el = scrollRef.current;
          if (el) el.scrollTop = el.scrollHeight;
          stickBottom.current = true;
          setShowJump(false);
        }}
        reasoningEnabled={reasoningEnabled}
        onReasoningChange={setReasoningEnabled}
        webSearchEnabled={webSearchEnabled}
        onWebSearchChange={setWebSearchEnabled}
        voice={voice}
        tkEstimate={tkEstimate}
        dismissedFollowUps={dismissedFollowUps}
        onDismissFollowUps={() => setDismissedFollowUps(true)}
        hasAnswer={messages.some((m) => m.role === "assistant")}
      />

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
