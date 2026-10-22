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
  fireEvent.click(screen.getByRole("button", { name: "Add your first source" }));
  expect(onAddSources).toHaveBeenCalledOnce();
  expect(onSend).not.toHaveBeenCalled();
  rerender(<MessageList {...props} sourceCount={2} />);
  fireEvent.click(screen.getByRole("button", { name: "Find the key ideas" }));
  expect(onSend).toHaveBeenCalledWith("Summarize the key ideas across my sources");
  rerender(<MessageList {...props} sourceCount={2} hasModel={false} />);
  expect(screen.queryByRole("button", { name: "Find the key ideas" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
  expect(onOpenSettings).toHaveBeenCalledOnce();
});
