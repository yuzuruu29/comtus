import { useEffect, useRef } from "react";
import { ArrowUp, Stop } from "@phosphor-icons/react";
import type { ChatMessage, Notebook, WebSearchMeta } from "../lib/types";
import AssistantMessage from "./AssistantMessage";

export default function CompadChat({
  notebook, modelLabel, sourceCount, messages, activeSessionId, input, onInputChange,
  onSend, onStop, streaming, smoothedText, error, hasModel, ready, preparing, onOpenSettings,
  onAddSources, onCite, onSaveToNote,
}: {
  notebook: Notebook;
  modelLabel?: string;
  sourceCount: number;
  messages: ChatMessage[];
  activeSessionId: string | null;
  input: string;
  onInputChange: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: { text: string; thinking: string; phase?: "searching" | "reading" | "thinking" | "answering"; webSearch?: WebSearchMeta } | null;
  smoothedText: string;
  error: string;
  hasModel: boolean;
  ready: boolean;
  preparing: boolean;
  onOpenSettings?: () => void;
  onAddSources?: () => void;
  onCite: (sourceId: string, startChar?: number) => void;
  onSaveToNote: (title: string, text: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickBottom = useRef(true);

  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (!messages.length && !smoothedText) { element.scrollTop = 0; stickBottom.current = true; }
    else if (stickBottom.current) element.scrollTop = element.scrollHeight;
  }, [messages, smoothedText, streaming]);

  return (
    <div className="compad-chat">
      <div className="compad-context"><strong>{notebook.name}</strong><span>{modelLabel || "Your selected model"} · {sourceCount} {sourceCount === 1 ? "source" : "sources"}</span></div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div ref={scrollRef} className="compad-transcript" role="region" aria-label="Compad conversation" tabIndex={0}
        onScroll={() => {
          const element = scrollRef.current;
          if (element) stickBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 60;
        }}>
        {!messages.length && !streaming && <div className="compad-empty"><p>A small space for a good question.</p><span>This is your notebook’s chat, using its sources and selected model.</span>{sourceCount === 0 && onAddSources && <button type="button" onClick={onAddSources}>Add a source to study together</button>}</div>}
        {messages.map((message) => message.role === "user" ? (
          <div key={message.id} className="compad-question"><span>You</span><p>{message.content}</p></div>
        ) : (
          <div key={message.id} className="compad-answer"><span className="compad-answer-label">{modelLabel || "Assistant"}</span><AssistantMessage msg={message} onCite={onCite} onSaveToNote={onSaveToNote} settled /></div>
        ))}
        {streaming && <div className="compad-answer" data-battery-think><span className="compad-answer-label">{modelLabel || "Assistant"}</span>{smoothedText ? <AssistantMessage
          msg={{ id: "compad-stream", notebookId: notebook.id, sessionId: activeSessionId ?? undefined, role: "assistant", content: smoothedText, thinking: streaming.thinking, webSearch: streaming.webSearch, createdAt: 0 }}
          streaming phase={streaming.phase} onCite={onCite} settled
        /> : <p className="compad-progress" role="status">{streaming.phase === "searching" ? "Looking for sources…" : streaming.phase === "thinking" ? "Thinking through your question…" : "Getting your answer ready…"}</p>}</div>}
      </div>
      {!hasModel && <p className="compad-model-notice">Connect a model to chat. <button type="button" onClick={onOpenSettings}>Choose a model</button></p>}
      {error && <p className="compad-error" role="alert">{error}</p>}
      {preparing && <p className="compad-progress" role="status">Preparing your question…</p>}
      <form className="compad-compose" onSubmit={(event) => { event.preventDefault(); stickBottom.current = true; onSend(); }}>
        <label className="sr-only" htmlFor="compad-message">Message Compad</label>
        <textarea ref={inputRef} id="compad-message" rows={2} value={input} readOnly={preparing} onChange={(event) => onInputChange(event.target.value)}
          placeholder={ready ? "Ask about your notebook…" : "Opening your conversation…"}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!streaming && !preparing && hasModel && ready && input.trim()) { stickBottom.current = true; onSend(); }
            }
          }} />
        {streaming ? <button type="button" className="compad-send" onClick={onStop} aria-label="Stop response"><Stop size={17} weight="fill" aria-hidden="true" /></button>
          : <button type="submit" className="compad-send" disabled={preparing || !hasModel || !ready || !input.trim()} aria-label="Send message"><ArrowUp size={19} weight="bold" aria-hidden="true" /></button>}
      </form>
    </div>
  );
}
