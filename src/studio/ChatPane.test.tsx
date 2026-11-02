import "fake-indexeddb/auto";
import { useState, type ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as database from "../lib/db";
import { streamChat, type ChatReply } from "../lib/llm";
import type { Notebook } from "../lib/types";
import type Composer from "./Composer";
import type MessageList from "./MessageList";
import type SessionMenu from "./SessionMenu";
import ChatPane from "./ChatPane";
import { CompadChatProvider, useCompadChat } from "./CompadChatContext";

const connection = vi.hoisted(() => ({ ready: true }));
vi.mock("../lib/settings", () => ({
  useSettings: (select: (value: { hasKey: () => boolean; motionMode: string }) => unknown) => select({ hasKey: () => connection.ready, motionMode: "none" }),
  useCallSettings: () => ({ provider: "openrouter", model: "selected-study-model", apiKey: "test-only" }),
}));
vi.mock("../lib/llm", () => ({ streamChat: vi.fn(), friendlyError: (error: Error) => error.message, isAbort: (error: Error) => error.name === "AbortError", isAuthError: () => false }));
vi.mock("../lib/useSmoothText", () => ({ useSmoothText: (text: string) => ({ text, caughtUp: true, flush: () => {} }) }));
vi.mock("./useVoiceInput", () => ({ useVoiceInput: () => ({ state: "idle", active: false, interim: "", error: "", elapsed: 0, toggle: () => {} }) }));
vi.mock("./focus", () => ({ loadFocus: () => ["source-1"] }));
vi.mock("./Composer", () => ({ default: (props: ComponentProps<typeof Composer>) => <div><textarea aria-label="Main draft" value={props.input} readOnly={props.preparing} onChange={(event) => props.onInputChange(event.target.value)} /><button type="button" disabled={!!props.streaming || props.preparing} onClick={() => props.onSend()}>Main send</button></div> }));
vi.mock("./MessageList", () => ({ default: (props: ComponentProps<typeof MessageList>) => <div ref={props.scrollRef} aria-label="Main transcript">{props.messages.map((message) => <p key={message.id}>{message.content}</p>)}{props.streaming && <p>{props.smoothedText}</p>}{props.error && <p role="alert">{props.error}</p>}</div> }));
vi.mock("./SessionMenu", () => ({ default: (props: ComponentProps<typeof SessionMenu>) => <div><button type="button" onClick={props.onNew}>New thread</button>{props.sessions.map((session) => <button key={session.id} type="button" onClick={() => props.onSelect(session.id)}>Open {session.id}</button>)}</div> }));

const notebook: Notebook = { id: "notebook-1", name: "Learning notebook", createdAt: 0, updatedAt: 0 };
const otherNotebook: Notebook = { id: "notebook-2", name: "Other notebook", createdAt: 0, updatedAt: 0 };
const reply: ChatReply = { text: "**Recall** brings an idea back.", thinking: "", citations: [{ documentIndex: 0, sourceId: "source-1", sourceTitle: "Reading notes", citedText: "Bring an idea to mind.", startChar: 8 }] };

function CompactTarget({ open }: { open: boolean }) {
  const { setTarget } = useCompadChat();
  return open ? <div data-testid="compact" ref={setTarget} /> : null;
}

function SharedChat({ book = notebook, open = true, full = true, focusRequest = 0, onCite = () => {} }: { book?: Notebook; open?: boolean; full?: boolean; focusRequest?: number; onCite?: (id: string, start?: number) => void }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  return <CompadChatProvider><div data-testid="full" ref={setTarget} /><ChatPane notebook={book} sourcesVersion={0} onNavigateSources={onCite} modelLabel="Selected study model" surfaceTarget={full ? target : null} focusRequest={focusRequest} /><CompactTarget open={open} /></CompadChatProvider>;
}

const compact = () => within(screen.getByTestId("compact"));
async function ready() { await waitFor(() => expect(compact().getByPlaceholderText("Ask about your notebook…")).toBeInTheDocument()); }

beforeEach(async () => {
  connection.ready = true;
  vi.mocked(streamChat).mockReset();
  localStorage.clear();
  await database.db.messages.clear();
  await database.db.chatSessions.clear();
  await database.db.sources.clear();
  await database.db.generations.clear();
  await database.db.notebooks.bulkPut([notebook, otherNotebook]);
  await database.db.chatSessions.bulkPut([
    { id: "thread-1", notebookId: notebook.id, title: "First thread", createdAt: 0, updatedAt: 2 },
    { id: "thread-2", notebookId: notebook.id, title: "Second thread", createdAt: 0, updatedAt: 1 },
    { id: "thread-other", notebookId: otherNotebook.id, title: "Other thread", createdAt: 0, updatedAt: 0 },
  ]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shares draft and transcript, claims a send before DB setup, and keeps the request across compact close/reopen", async () => {
  let releaseSave!: () => void;
  const saving = new Promise<void>((resolve) => { releaseSave = resolve; });
  const actualSave = database.saveMessage;
  const save = vi.spyOn(database, "saveMessage").mockImplementationOnce(async (message) => { await saving; await actualSave(message); });
  let finish!: (reply: ChatReply) => void;
  vi.mocked(streamChat).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const cite = vi.fn();
  const scene = render(<SharedChat onCite={cite} />);
  await ready();
  fireEvent.change(screen.getByLabelText("Main draft"), { target: { value: "Explain recall" } });
  expect(compact().getByLabelText("Message Compad")).toHaveValue("Explain recall");
  fireEvent.change(compact().getByLabelText("Message Compad"), { target: { value: "How does recall work?" } });
  expect(screen.getByLabelText("Main draft")).toHaveValue("How does recall work?");
  const mainSend = screen.getByRole("button", { name: "Main send" });
  const compactSend = compact().getByRole("button", { name: "Send message" });
  act(() => { mainSend.click(); compactSend.click(); });
  expect(save).toHaveBeenCalledTimes(1);
  expect(compact().getByLabelText("Message Compad")).toHaveValue("How does recall work?");
  expect(compactSend).toBeDisabled();
  expect(compact().queryByRole("button", { name: "Stop response" })).not.toBeInTheDocument();
  await act(async () => { releaseSave(); });
  await waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));
  const request = vi.mocked(streamChat).mock.calls[0][0];
  expect(request).toMatchObject({ model: "selected-study-model", notebookId: notebook.id, sourceIds: ["source-1"], question: "How does recall work?" });
  scene.rerender(<SharedChat open={false} full={false} onCite={cite} />);
  expect(request.signal?.aborted).toBe(false);
  act(() => request.onText?.("A thought", "A thought in progress"));
  scene.rerender(<SharedChat onCite={cite} />);
  expect(compact().getByText("A thought in progress")).toBeInTheDocument();
  await act(async () => { finish(reply); });
  await waitFor(() => expect(compact().getByText("Recall", { selector: "strong" })).toBeInTheDocument());
  expect(screen.getByTestId("full")).toHaveTextContent(reply.text);
  fireEvent.click(compact().getByRole("button", { name: "[1] Reading notes" }));
  expect(cite).toHaveBeenCalledWith("source-1", 8);
  fireEvent.click(compact().getByRole("button", { name: "Save to note" }));
  await waitFor(async () => expect(await database.db.generations.count()).toBe(1));
  expect(await database.db.messages.filter((message) => message.role === "assistant").count()).toBe(1);
});

it("preserves a new question typed while a new thread is being created", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const actualCreate = database.createChatSession;
  vi.spyOn(database, "createChatSession").mockImplementationOnce(async (id) => { await pending; return actualCreate(id); });
  render(<SharedChat />);
  await ready();
  fireEvent.change(compact().getByLabelText("Message Compad"), { target: { value: "Old draft" } });
  fireEvent.click(screen.getByRole("button", { name: "New thread" }));
  expect(compact().getByLabelText("Message Compad")).toHaveValue("");
  fireEvent.change(compact().getByLabelText("Message Compad"), { target: { value: "New thread question" } });
  await act(async () => { release(); });
  await ready();
  expect(compact().getByLabelText("Message Compad")).toHaveValue("New thread question");
  expect(screen.getByLabelText("Main draft")).toHaveValue("New thread question");
});

it("keeps the question visible until session setup completes, then lets Stop retain its saved history", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const actualCreate = database.createChatSession;
  vi.spyOn(database, "ensureChatSessions").mockResolvedValueOnce([]);
  vi.spyOn(database, "createChatSession").mockImplementationOnce(async (id) => { await pending; return actualCreate(id); });
  let finish!: (value: ChatReply) => void;
  vi.mocked(streamChat).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  render(<SharedChat />);
  await ready();
  fireEvent.change(compact().getByLabelText("Message Compad"), { target: { value: "Keep this question" } });
  fireEvent.click(compact().getByRole("button", { name: "Send message" }));
  expect(compact().getByLabelText("Message Compad")).toHaveValue("Keep this question");
  expect(compact().getByLabelText("Message Compad")).toHaveAttribute("readonly");
  expect(compact().queryByRole("button", { name: "Stop response" })).not.toBeInTheDocument();
  await act(async () => { release(); });
  await waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));
  fireEvent.click(compact().getByRole("button", { name: "Stop response" }));
  expect(compact().getByText("Keep this question")).toBeInTheDocument();
  expect(await database.db.messages.filter((message) => message.content === "Keep this question").count()).toBe(1);
  await act(async () => { finish(reply); });
  expect(compact().queryByText("Recall", { selector: "strong" })).not.toBeInTheDocument();
});

it("keeps an empty transcript at the top and transfers focus when the full portal becomes available", async () => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(300);
  const scene = render(<SharedChat full={false} />);
  await ready();
  expect(compact().getByRole("region", { name: "Compad conversation" }).scrollTop).toBe(0);
  fireEvent.change(compact().getByLabelText("Message Compad"), { target: { value: "Continue this draft" } });
  scene.rerender(<SharedChat open={false} full={false} focusRequest={1} />);
  scene.rerender(<SharedChat open={false} focusRequest={1} />);
  expect(screen.getByLabelText("Main draft")).toHaveFocus();
  expect(screen.getByLabelText("Main draft")).toHaveValue("Continue this draft");
  expect(screen.getByLabelText("Main transcript").scrollTop).toBe(0);
  screen.getByRole("button", { name: "Main send" }).focus();
  scene.rerender(<SharedChat open={false} focusRequest={2} />);
  expect(screen.getByLabelText("Main draft")).toHaveFocus();
});

it("scrolls a loaded conversation to its latest message", async () => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(900);
  await database.db.messages.put({ id: "saved-message", notebookId: notebook.id, sessionId: "thread-1", role: "user", content: "Continue our reading", createdAt: 1 });
  render(<SharedChat />);
  await waitFor(() => expect(screen.getByLabelText("Main transcript")).toHaveTextContent("Continue our reading"));
  await waitFor(() => expect(screen.getByLabelText("Main transcript").scrollTop).toBe(900));
});

it.each(["stop", "thread", "notebook"] as const)("rejects late callbacks and final answers after %s changes request ownership", async (change) => {
  let finish!: (reply: ChatReply) => void;
  vi.mocked(streamChat).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const scene = render(<SharedChat />);
  await ready();
  fireEvent.change(compact().getByLabelText("Message Compad"), { target: { value: "First question" } });
  fireEvent.click(compact().getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));
  const oldRequest = vi.mocked(streamChat).mock.calls[0][0];
  if (change === "stop") fireEvent.click(compact().getByRole("button", { name: "Stop response" }));
  if (change === "thread") fireEvent.click(screen.getByRole("button", { name: "Open thread-2" }));
  if (change === "notebook") scene.rerender(<SharedChat book={otherNotebook} />);
  await ready();
  expect(oldRequest.signal?.aborted).toBe(true);
  await act(async () => { oldRequest.onText?.("old", "Stale answer"); finish({ ...reply, text: "Stale answer" }); });
  expect(screen.queryByText("Stale answer")).not.toBeInTheDocument();
  expect(await database.db.messages.filter((message) => message.role === "assistant").count()).toBe(0);
  vi.mocked(streamChat).mockResolvedValueOnce(reply);
  fireEvent.change(compact().getByLabelText("Message Compad"), { target: { value: "Current question" } });
  fireEvent.click(compact().getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(streamChat).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(compact().getByText("Recall", { selector: "strong" })).toBeInTheDocument());
});

it.each(["session", "message", "provider"] as const)("restores the question and releases the send guard after a %s failure", async (failure) => {
  if (failure === "session") {
    vi.spyOn(database, "ensureChatSessions").mockResolvedValueOnce([]);
    vi.spyOn(database, "createChatSession").mockRejectedValueOnce(new Error("Session could not be saved"));
  }
  if (failure === "message") vi.spyOn(database, "saveMessage").mockRejectedValueOnce(new Error("Message could not be saved"));
  if (failure === "provider") vi.mocked(streamChat).mockRejectedValueOnce(new Error("Model unavailable"));
  render(<SharedChat />);
  await ready();
  fireEvent.change(compact().getByLabelText("Message Compad"), { target: { value: "Keep this question" } });
  fireEvent.click(compact().getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(compact().getByRole("alert")).toBeInTheDocument());
  expect(compact().getByLabelText("Message Compad")).toHaveValue("Keep this question");
  expect(compact().getByRole("button", { name: "Send message" })).toBeEnabled();
  vi.mocked(streamChat).mockResolvedValueOnce(reply);
  fireEvent.click(compact().getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(compact().getByText("Recall", { selector: "strong" })).toBeInTheDocument());
});

it("preserves a completed answer when persistence fails and never sends without a selected connection", async () => {
  connection.ready = false;
  const scene = render(<SharedChat />);
  await ready();
  fireEvent.change(compact().getByLabelText("Message Compad"), { target: { value: "A careful question" } });
  expect(compact().getByRole("button", { name: "Send message" })).toBeDisabled();
  expect(compact().getByText("Connect a model to chat.")).toBeInTheDocument();
  expect(streamChat).not.toHaveBeenCalled();
  connection.ready = true;
  scene.rerender(<SharedChat />);
  const actualSave = database.saveMessage;
  vi.spyOn(database, "saveMessage").mockImplementation(async (message) => { if (message.role === "assistant") throw new Error("Disk full"); await actualSave(message); });
  vi.mocked(streamChat).mockResolvedValueOnce(reply);
  fireEvent.click(compact().getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(compact().getByRole("alert")).toHaveTextContent("could not be saved"));
  expect(compact().getByText("Recall", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getByTestId("full")).toHaveTextContent(reply.text);
});
