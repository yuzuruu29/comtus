import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import MessageList from "./MessageList";

vi.mock("./AssistantMessage", () => ({ default: () => null, SearchStatusStrip: () => null }));
afterEach(cleanup);

it("offers source import before source-based starters, and opens a grounded starter when ready", () => {
  const onAddSources = vi.fn();
  const onSend = vi.fn();
  const onOpenSettings = vi.fn();
  const props = {
    notebook: { id: "nb", name: "Ecology", createdAt: 1, updatedAt: 1 },
    sourceCount: 0, messages: [], settledId: null, streaming: null, smoothedText: "", activeSessionId: null,
    thinkingOpen: false, onToggleThinking: vi.fn(), onCite: vi.fn(), onSaveToNote: vi.fn(),
    onSend, onAddSources, onOpenSettings, scrollRef: createRef<HTMLDivElement>(), onScroll: vi.fn(),
    error: "", searchBanner: null, leave: "instant" as const,
  };
  const { rerender } = render(<MessageList {...props} />);
  expect(screen.queryByRole("button", { name: "Find the key ideas" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Your own notes/ }));
  expect(onAddSources).toHaveBeenCalledExactlyOnceWith("paste");
  expect(onSend).not.toHaveBeenCalled();
  rerender(<MessageList {...props} sourceCount={2} />);
  fireEvent.click(screen.getByRole("button", { name: "Find the key ideas" }));
  expect(onSend).toHaveBeenCalledWith("Summarize the key ideas across my sources");
  rerender(<MessageList {...props} sourceCount={2} hasModel={false} />);
  expect(screen.queryByRole("button", { name: "Find the key ideas" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
  expect(onOpenSettings).toHaveBeenCalledOnce();
});

it("offers to ask an unanswered question again, and AI Models when the key is the problem", () => {
  const onRetry = vi.fn();
  const onOpenSettings = vi.fn();
  const question = { id: "q", notebookId: "nb", sessionId: "s", role: "user" as const, content: "Why osmosis?", createdAt: 1 };
  const props = {
    notebook: { id: "nb", name: "Ecology", createdAt: 1, updatedAt: 1 },
    sourceCount: 1, messages: [question], settledId: null, streaming: null, smoothedText: "", activeSessionId: "s",
    thinkingOpen: false, onToggleThinking: vi.fn(), onCite: vi.fn(), onSaveToNote: vi.fn(),
    onSend: vi.fn(), onRetry, onOpenSettings, scrollRef: createRef<HTMLDivElement>(), onScroll: vi.fn(),
    error: "", searchBanner: null, leave: "instant" as const,
  };
  const { rerender } = render(<MessageList {...props} />);
  expect(screen.getByText("No answer came back for this question.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
  expect(onRetry).toHaveBeenCalledWith("Why osmosis?");

  rerender(<MessageList {...props} busy />);
  expect(screen.queryByRole("button", { name: "Ask again" })).not.toBeInTheDocument();

  rerender(<MessageList {...props} error="The API key was rejected." errorNeedsModel />);
  fireEvent.click(screen.getByRole("button", { name: "Open AI Models" }));
  expect(onOpenSettings).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("button", { name: "Ask again" })).toHaveLength(1);
});
