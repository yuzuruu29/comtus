import "fake-indexeddb/auto";
import type { ComponentProps, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db";
import Composer from "./Composer";

// Composer reaches pdfjs transitively through nothing directly, but shares
// the studio's usual jsdom gaps — mock motion for deterministic DOM and
// keep fake-indexeddb so FocusMenu's db.sources query doesn't throw.
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</> };
});

afterEach(async () => {
  cleanup();
  await db.sources.clear();
});

function renderComposer(overrides: Partial<ComponentProps<typeof Composer>> = {}) {
  const props: ComponentProps<typeof Composer> = {
    notebook: { id: "nb1", name: "Test Notebook", createdAt: 0, updatedAt: 0 },
    sourcesVersion: 0,
    input: "hello",
    onInputChange: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    streaming: null,
    showJump: false,
    onJumpToLatest: vi.fn(),
    reasoningEnabled: true,
    onReasoningChange: vi.fn(),
    webSearchEnabled: false,
    onWebSearchChange: vi.fn(),
    voice: { state: "idle", active: false, interim: "", error: "", elapsed: 0, toggle: vi.fn() },
    tkEstimate: 0,
    dismissedFollowUps: true,
    onDismissFollowUps: vi.fn(),
    hasAnswer: false,
    ...overrides,
  };
  render(<Composer {...props} />);
  return props;
}

describe("Composer", () => {
  it("keeps the draft focusable while preparation blocks another submission", () => {
    const props = renderComposer({ preparing: true });
    const editor = screen.getByLabelText("Ask Comtus");
    editor.focus();
    expect(editor).toHaveFocus();
    expect(editor).toHaveValue("hello");
    expect(editor).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("sends on Enter", () => {
    const props = renderComposer();
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
    fireEvent.keyDown(screen.getByLabelText("Ask Comtus"), { key: "Enter" });
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it("does not send on Shift+Enter — the draft gets a newline instead", () => {
    const props = renderComposer();
    fireEvent.keyDown(screen.getByLabelText("Ask Comtus"), { key: "Enter", shiftKey: true });
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("shows the Think toggle by default", () => {
    renderComposer();
    expect(screen.getByRole("button", { name: /Reasoning/i })).toBeInTheDocument();
  });

  it("hides the Think toggle when capabilities.thinking is false", () => {
    renderComposer({ capabilities: { thinking: false } });
    expect(screen.queryByRole("button", { name: /Reasoning/i })).not.toBeInTheDocument();
    // Web Search stays — the capability gate is scoped to Think only.
    expect(screen.getByRole("button", { name: /Web Search/i })).toBeInTheDocument();
  });
});
