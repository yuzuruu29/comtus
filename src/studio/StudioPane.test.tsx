import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Generation } from "../lib/types";

const database = vi.hoisted(() => {
  type StoredGeneration = {
    id: string;
    notebookId: string;
    kind: "note";
    title: string;
    payload: { content: string };
    createdAt: number;
  };
  const rows: StoredGeneration[] = [];
  const sortBy = vi.fn(async () => [...rows]);
  const deleteGeneration = vi.fn(async (id: string) => {
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return undefined;
    return rows.splice(index, 1)[0];
  });
  const restoreGeneration = vi.fn(async (generation: StoredGeneration) => {
    rows.push(generation);
  });
  return { rows, sortBy, deleteGeneration, restoreGeneration };
});

vi.mock("../lib/db", () => ({
  db: {
    generations: {
      where: () => ({
        equals: () => ({
          reverse: () => ({ sortBy: database.sortBy }),
        }),
      }),
    },
  },
  createCustomNote: vi.fn(),
  updateCustomNote: vi.fn(),
  deleteGeneration: database.deleteGeneration,
  restoreGeneration: database.restoreGeneration,
}));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

vi.mock("./ExportMenu", () => ({ default: () => null }));
vi.mock("./generators/QuizFlow", () => ({
  QuizConfigForm: () => null,
  QuizTaker: () => null,
}));
vi.mock("./generators/ExamFlow", () => ({
  ExamConfigForm: () => null,
  ExamRunner: () => null,
}));
vi.mock("./generators/EssayFlow", () => ({
  EssayConfigForm: () => null,
  EssayFeedback: () => null,
}));
vi.mock("./generators/AidsFlow", () => ({
  AidsConfigForm: () => null,
  DocViewer: () => null,
  FlashcardsConfigForm: () => null,
  FlashcardsView: () => null,
  PresentationConfigForm: () => null,
  SlideshowView: () => null,
}));

import StudioPane from "./StudioPane";

const note: Generation = {
  id: "note-1",
  notebookId: "notebook-1",
  kind: "note",
  title: "Keyboard note",
  payload: { content: "Keep this safe." },
  createdAt: 1_700_000_000_000,
};

describe("StudioPane saved-work deletion", () => {
  beforeEach(() => {
    database.rows.splice(0, database.rows.length, note as (typeof database.rows)[number]);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("offers a focused Undo action and restores the exact deleted generation", async () => {
    render(<StudioPane notebookId="notebook-1" />);

    const deleteButton = await screen.findByRole("button", {
      name: "Delete note Keyboard note",
    });
    expect(deleteButton.parentElement).toHaveClass("artifact-actions");

    fireEvent.click(deleteButton);

    await waitFor(() => expect(database.deleteGeneration).toHaveBeenCalledWith("note-1"));
    const undoButton = await screen.findByRole("button", { name: "Undo deletion" });
    expect(undoButton).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Removed “Keyboard note”.");

    fireEvent.click(undoButton);

    await waitFor(() => expect(database.restoreGeneration).toHaveBeenCalledWith(note));
    await screen.findByRole("button", { name: "Delete note Keyboard note" });
  }, 15000);

  it("expires a pointer-triggered Undo notice after five seconds", async () => {
    render(<StudioPane notebookId="notebook-1" />);
    const deleteButton = await screen.findByRole("button", {
      name: "Delete note Keyboard note",
    });
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(deleteButton, { detail: 1 });
      await Promise.resolve();
      await Promise.resolve();
    });

    const undoButton = screen.getByRole("button", { name: "Undo deletion" });
    expect(undoButton).not.toHaveFocus();
    act(() => vi.advanceTimersByTime(4_999));
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(1_001));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }, 15000);
});
