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
  AidsConfigForm: ({ initialKind }: { initialKind?: string }) => <p>Configure {initialKind}</p>,
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

describe("StudioPane", () => {
  beforeEach(() => {
    database.rows.splice(0, database.rows.length, note as (typeof database.rows)[number]);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("discloses secondary tools and opens the selected document generator", async () => {
    render(<StudioPane notebookId="notebook-1" />);
    await screen.findByRole("button", { name: "Delete note Keyboard note" });

    expect(screen.getByRole("button", { name: /Practice quiz/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Flashcards/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Mock exam/ })).toBeVisible();
    expect(screen.queryByText("Coming Soon")).not.toBeInTheDocument();

    const summary = screen.getByText("More ways to study");
    const disclosure = summary.closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Essay coach" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Slides & deck" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Study guide" }));

    expect(screen.getByRole("dialog", { name: "Study aid" })).toBeInTheDocument();
    expect(screen.getByText("Configure study-guide")).toBeInTheDocument();
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

  it("keeps section labels unique when desktop and mobile panes are both mounted", () => {
    const { container } = render(<><StudioPane notebookId="notebook-1" /><StudioPane notebookId="notebook-1" /></>);
    const sections = [...container.querySelectorAll("section[aria-labelledby]")];
    const labels = sections.map((section) => section.getAttribute("aria-labelledby"));
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(document.getElementById(label!)).toBeInTheDocument();
  });

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
