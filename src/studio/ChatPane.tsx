import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { streamChat, friendlyError, isAbort, isAuthError } from "../lib/llm";
import type { ChatReply } from "../lib/llm";
import { useSmoothText } from "../lib/useSmoothText";
import { useSettings, useCallSettings } from "../lib/settings";
import { Toast } from "../ui";
import { appendTranscript } from "../lib/voice";
import { useVoiceInput } from "./useVoiceInput";
import SessionMenu from "./SessionMenu";
import MessageList from "./MessageList";
import Composer from "./Composer";
import CompadChat from "./CompadChat";
import { useCompadChat } from "./CompadChatContext";
import { ICON } from "../ui/iconScale";

const lastSessionKey = (notebookId: string) => `comtus:lastChat:${notebookId}`;
type ChatRequest = { controller: AbortController; notebookId: string; token: number };

export default function ChatPane({
  notebook,
  sourcesVersion,
  onNavigateSources,
  modelLabel,
  onOpenSettings,
  onAddSources,
  capabilities,
  surfaceTarget,
  focusRequest = 0,
  pendingSessionId,
  onPendingSessionConsumed,
  quoteRequest,
  onQuoteConsumed,
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
  surfaceTarget?: HTMLElement | null;
  focusRequest?: number;
  /** A conversation to switch to once sessions load (a search result). */
  pendingSessionId?: string | null;
  onPendingSessionConsumed?: () => void;
  /** A passage quoted from the reader, to start the next question with. */
  quoteRequest?: { text: string; nonce: number } | null;
  onQuoteConsumed?: () => void;
}) {
  const { target: compadTarget } = useCompadChat();
  const cs = useCallSettings();
  const hasKey = useSettings((s) => s.hasKey);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Id of the assistant message that just handed off from the streaming slot;
  // that one bubble mounts entrance-free so the swap paints identically.
  const [settledId, setSettledId] = useState<string | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [input, setInput] = useState("");
  const [preparing, setPreparing] = useState(false);
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
  // The error text that a model or key change would fix; the banner offers AI Models only while it is the one showing.
  const [modelError, setModelError] = useState("");
  const [searchBanner, setSearchBanner] = useState<WebSearchMeta | null>(null);
  const [toastNoteSaved, setToastNoteSaved] = useState(false);
  const [dismissedFollowUps, setDismissedFollowUps] = useState(false);
  const requestRef = useRef<ChatRequest | null>(null);
  const notebookIdRef = useRef(notebook?.id);
  notebookIdRef.current = notebook?.id;
  // How the live stream is ending — written BEFORE setStreaming(null) so the
  // streaming slot can pick its exit: "commit" swaps instantly into the
  // identical persisted bubble, "abort" fades away.
  const streamEndRef = useRef<"commit" | "abort">("abort");
  const searchMetaRef = useRef<WebSearchMeta | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fullChatRef = useRef<HTMLDivElement>(null);
  const focusedRequest = useRef(0);
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
    request: ChatRequest;
  } | null>(null);
  const [finalizeTick, setFinalizeTick] = useState(0);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const hasConversation = messages.length > 0 || streaming !== null;
  const requestIsCurrent = useCallback((request: ChatRequest) =>
    requestRef.current === request && request.token === loadToken.current &&
    notebookIdRef.current === request.notebookId && !request.controller.signal.aborted, []);
  const cancelRequest = useCallback(() => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    finalizeRef.current = null;
    streamEndRef.current = "abort";
    setStreaming(null);
    setPreparing(false);
    setSearchBanner(null);
  }, []);

  useEffect(() => {
    cancelRequest();
    const token = ++loadToken.current;
    setSessionReady(false);
    setSessions([]);
    setActiveId(null);
    setMessages([]);
    setInput("");
    setError("");
    setSourceCount(0);
    const nbId = notebook?.id;
    if (!nbId) return;
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
      setSessionReady(true);
    })().catch((err) => { if (token === loadToken.current) setError(friendlyError(err)); });
  }, [notebook?.id, cancelRequest]);

  useEffect(() => {
    if (!notebook) return;
    let current = true;
    void db.sources
      .where("notebookId")
      .equals(notebook.id)
      .count()
      .then((count) => { if (current) setSourceCount(count); })
      .catch((err) => { if (current) setError(friendlyError(err)); });
    return () => { current = false; };
  }, [notebook, sourcesVersion]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickBottom.current) el.scrollTop = messages.length || streaming ? el.scrollHeight : 0;
  }, [streaming, messages, smoothed.text, surfaceTarget]);

  useEffect(() => {
    if (preparing || !focusRequest || focusedRequest.current === focusRequest) return;
    const composer = fullChatRef.current?.querySelector<HTMLTextAreaElement>("textarea");
    if (!composer) return;
    composer.focus({ preventScroll: true });
    composer.setSelectionRange(composer.value.length, composer.value.length);
    if (document.activeElement === composer) focusedRequest.current = focusRequest;
  }, [focusRequest, surfaceTarget, notebook?.id, preparing]);

  // A passage from the reader opens the next question, ahead of any draft,
  // with the cursor after it.
  useEffect(() => {
    if (!quoteRequest || !sessionReady) return;
    setInput((draft) => quoteRequest.text + draft.trimStart());
    onQuoteConsumed?.();
    window.setTimeout(() => {
      const composer = fullChatRef.current?.querySelector<HTMLTextAreaElement>("textarea");
      if (!composer) return;
      composer.focus({ preventScroll: true });
      composer.setSelectionRange(composer.value.length, composer.value.length);
    }, 0);
  }, [onQuoteConsumed, quoteRequest, sessionReady]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vp = window.visualViewport;
    const handleResize = () => {
      const el = scrollRef.current;
      if (el && stickBottom.current) {
        requestAnimationFrame(() => {
          el.scrollTop = hasConversation ? el.scrollHeight : 0;
        });
      }
    };
    vp.addEventListener("resize", handleResize);
    return () => vp.removeEventListener("resize", handleResize);
  }, [hasConversation]);

  useEffect(() => {
    const epoch = loadToken;
    return () => {
      ++epoch.current;
      requestRef.current?.controller.abort();
      requestRef.current = null;
      finalizeRef.current = null;
    };
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
      if (!notebook || (id === activeId && sessionReady)) return;
      cancelRequest();
      const token = ++loadToken.current;
      setSessionReady(false);
      setMessages([]);
      setInput("");
      setError("");
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
          setSessionReady(true);
        }).catch((err) => { if (token === loadToken.current) setError(friendlyError(err)); });
    },
    [notebook, activeId, sessionReady, cancelRequest],
  );

  useEffect(() => {
    if (!pendingSessionId || !sessionReady) return;
    if (sessions.some((s) => s.id === pendingSessionId)) selectSession(pendingSessionId);
    onPendingSessionConsumed?.();
  }, [onPendingSessionConsumed, pendingSessionId, selectSession, sessionReady, sessions]);

  const newSession = useCallback(async () => {
    if (!notebook) return;
    cancelRequest();
    const token = ++loadToken.current;
    setSessionReady(false);
    setError("");
    const previousDraft = input;
    setInput("");
    try {
      const session = await createChatSession(notebook.id);
      if (token !== loadToken.current) return;
      setSessions((prev) => [session, ...prev]);
      setActiveId(session.id);
      setMessages([]);
      rememberActive(notebook.id, session.id);
      stickBottom.current = true;
      setSessionReady(true);
    } catch (err) {
      if (token === loadToken.current) {
        setError(friendlyError(err));
        setInput((draft) => draft || previousDraft);
        setSessionReady(true);
      }
    }
  }, [notebook, cancelRequest, input]);

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
      const selected = id === activeId;
      if (selected) { cancelRequest(); setSessionReady(false); }
      const token = selected ? ++loadToken.current : loadToken.current;
      try {
        await deleteChatSession(id);
        if (token !== loadToken.current) return;
        const rest = sessions.filter((session) => session.id !== id);
        setSessions(rest);
        if (!selected) return;
        setInput("");
        setMessages([]);
        const next = rest[0] ?? await createChatSession(notebook.id);
        if (token !== loadToken.current) return;
        if (!rest.length) setSessions([next]);
        setActiveId(next.id);
        rememberActive(notebook.id, next.id);
        const msgs = await db.messages.where("sessionId").equals(next.id).sortBy("createdAt");
        if (token !== loadToken.current) return;
        setMessages(msgs);
        setSessionReady(true);
        stickBottom.current = true;
      } catch (err) {
        if (token === loadToken.current) setError(friendlyError(err));
      }
    },
    [notebook, sessions, activeId, cancelRequest],
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
    async (raw?: string, retryLast = false) => {
      const question = (raw ?? input).trim();
      if (!question || !notebook || requestRef.current) return;
      if (!sessionReady) { setError("Your conversation is still opening. Try again in a moment."); return; }
      if (!hasKey()) {
        const text = "Choose a model or add your API key in AI Models to chat.";
        setError(text);
        setModelError(text);
        return;
      }
      // Asking an unanswered question again reuses its saved margin note instead of writing a second one.
      const last = messages[messages.length - 1];
      const reuse = retryLast && last?.role === "user" && last.sessionId === activeId && last.content.trim() === question ? last : null;

      const request: ChatRequest = { controller: new AbortController(), notebookId: notebook.id, token: loadToken.current };
      requestRef.current = request;
      setError("");
      setSearchBanner(null);
      searchMetaRef.current = null;
      setPreparing(true);
      setThinkingOpen(true);
      streamEndRef.current = "abort";

      try {
        let sessionId = activeId;
        let untitled = !activeSession?.title;
        if (!sessionId) {
          const created = await createChatSession(notebook.id);
          if (!requestIsCurrent(request)) return;
          sessionId = created.id;
          untitled = true;
          setSessions((prev) => [created, ...prev]);
          setActiveId(created.id);
          rememberActive(notebook.id, created.id);
        }

        const userMsg: ChatMessage = reuse ?? { id: uid(), notebookId: notebook.id, sessionId, role: "user", content: question, createdAt: Date.now() };
        if (!reuse) {
          await saveMessage(userMsg);
          if (!requestIsCurrent(request)) return;
        }
        const history = reuse ? messages : [...messages, userMsg];
        setMessages(history);
        setInput((draft) => draft.trim() === question ? "" : draft);
        setDismissedFollowUps(false);
        stickBottom.current = true;

        if (untitled) {
          const title = deriveSessionTitle(question);
          if (title) {
            await renameChatSession(sessionId, title);
            if (!requestIsCurrent(request)) return;
            setSessions((prev) => prev.map((session) => session.id === sessionId ? { ...session, title, updatedAt: Date.now() } : session));
          }
        }

        const focusedSources = loadFocus(notebook.id);
        setPreparing(false);
        setStreaming({ text: "", thinking: "", phase: webSearchEnabled ? "searching" : "reading" });
        const reply = await streamChat({
          ...cs,
          notebookId: notebook.id,
          notebookName: notebook.name,
          history: history.slice(0, -1),
          question,
          sourceIds: focusedSources !== null ? focusedSources : undefined,
          reasoning: reasoningEnabled,
          webSearch: webSearchEnabled,
          signal: request.controller.signal,
          onSearchStart: () => {
            if (requestIsCurrent(request)) setStreaming((value) => value ? { ...value, phase: "searching" } : value);
          },
          onSearchDone: (meta) => {
            if (!requestIsCurrent(request)) return;
            searchMetaRef.current = meta;
            setStreaming((value) => value ? { ...value, phase: "reading", webSearch: meta } : value);
          },
          onThinking: (_delta, full) => {
            if (requestIsCurrent(request)) setStreaming((value) => value ? { ...value, thinking: full, phase: "thinking" } : value);
          },
          onText: (_delta, full) => {
            if (!requestIsCurrent(request)) return;
            setStreaming((value) => value ? { ...value, text: full, phase: "answering" } : value);
            setThinkingOpen(false);
          },
        });
        if (!requestIsCurrent(request)) return;
        finalizeRef.current = { reply, sessionId, notebookId: notebook.id, request };
        streamEndRef.current = "commit";
        setFinalizeTick((tick) => tick + 1);
      } catch (err) {
        if (!requestIsCurrent(request)) return;
        requestRef.current = null;
        finalizeRef.current = null;
        streamEndRef.current = "abort";
        setStreaming(null);
        setPreparing(false);
        setInput((current) => current || question);
        if (!isAbort(err)) {
          const text = friendlyError(err);
          setError(text);
          if (isAuthError(err)) setModelError(text);
          if (searchMetaRef.current) setSearchBanner(searchMetaRef.current);
        }
      }
    },
    [input, notebook, sessionReady, hasKey, cs, messages, activeId, activeSession, reasoningEnabled, webSearchEnabled, requestIsCurrent],
  );

  const stop = useCallback(() => {
    if (streamEndRef.current === "commit") smoothed.flush();
    else cancelRequest();
  }, [smoothed, cancelRequest]);

  useEffect(() => {
    const fin = finalizeRef.current;
    if (!fin || !smoothed.caughtUp || !requestIsCurrent(fin.request)) return;
    finalizeRef.current = null;
    const assistant: ChatMessage = {
      id: uid(), notebookId: fin.notebookId, sessionId: fin.sessionId, role: "assistant",
      content: fin.reply.text, thinking: fin.reply.thinking, citations: fin.reply.citations,
      webSearch: fin.reply.webSearch, createdAt: Date.now(),
    };
    void (async () => {
      let persistenceError = "";
      try { await saveMessage(assistant); }
      catch { persistenceError = "This answer could not be saved. Copy it before leaving this notebook."; }
      if (!requestIsCurrent(fin.request)) return;
      requestRef.current = null;
      setStreaming(null);
      setSearchBanner(null);
      setSettledId(assistant.id);
      setMessages((current) => [...current, assistant]);
      bumpSession(fin.sessionId);
      if (persistenceError) setError(persistenceError);
    })();
  }, [finalizeTick, smoothed.caughtUp, requestIsCurrent]);

  if (!notebook) return surfaceTarget === undefined ? <div className="flex-1" /> : null;

  const fullChat = (
    <div ref={fullChatRef} className="bg-paper-parchment flex h-full min-h-0 flex-col">
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
        onRetry={(prompt) => void send(prompt, true)}
        busy={preparing}
        onAddSources={onAddSources}
        hasModel={hasKey()}
        onOpenSettings={onOpenSettings}
        scrollRef={scrollRef}
        onScroll={onScroll}
        error={error}
        errorNeedsModel={error !== "" && error === modelError}
        searchBanner={searchBanner}
        leave={streamEndRef.current === "commit" ? "instant" : "fade"}
      />

      {preparing && <p role="status" className="px-5 py-2 text-[12px] text-muted">Preparing your question…</p>}
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
        preparing={preparing}
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
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-[var(--radius-dialog)] border border-sage/40 bg-surface px-4 py-2.5 text-[13px] text-sage shadow-modal"
      >
        <Check size={ICON.md} weight="bold" />
        <span role="status">Saved to Studio Notes</span>
      </Toast>
    </div>
  );

  return <>
    {surfaceTarget === undefined ? fullChat : surfaceTarget ? createPortal(fullChat, surfaceTarget) : null}
    {compadTarget && createPortal(<CompadChat
      notebook={notebook}
      modelLabel={modelLabel}
      sourceCount={sourceCount}
      messages={messages}
      activeSessionId={activeId}
      input={input}
      onInputChange={setInput}
      onSend={() => void send()}
      onStop={stop}
      streaming={streaming}
      smoothedText={smoothed.text}
      error={error}
      hasModel={hasKey()}
      ready={sessionReady}
      preparing={preparing}
      onOpenSettings={onOpenSettings}
      onAddSources={onAddSources}
      onCite={onNavigateSources}
      onSaveToNote={(title, text) => void handleSaveToNote(title, text)}
    />, compadTarget)}
  </>;
}
