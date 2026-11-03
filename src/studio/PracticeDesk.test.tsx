import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, deleteGeneration } from "../lib/db";
import PracticeDesk from "./PracticeDesk";

vi.mock("./ExportMenu", () => ({ default: () => null }));
// The forms report the sources they were given; the taker opens a sitting.
vi.mock("./generators/QuizFlow", () => ({
  QuizConfigForm: ({ sourceIds }: { sourceIds?: string[] }) => (
    <p data-testid="quiz-form">{sourceIds ? sourceIds.join(",") : "all"}</p>
  ),
  QuizTaker: ({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) => {
    useEffect(() => onActiveChange?.(true), [onActiveChange]);
    return <p>Question 1</p>;
  },
}));
vi.mock("./generators/AidsFlow", () => ({
  AidsConfigForm: () => null,
  DocViewer: () => null,
  FlashcardsConfigForm: () => <p>Deck set-up</p>,
  FlashcardsView: () => null,
  PresentationConfigForm: () => null,
  SlideshowView: () => null,
}));

afterEach(async () => {
  cleanup();
  await Promise.all([db.sources.clear(), db.generations.clear(), db.notebooks.clear()]);
});

const source = (id: string, title: string, addedAt: number) => ({
  id,
  notebookId: "nb1",
  title,
  kind: "txt" as const,
  content: "Osmosis moves water.",
  chars: 20,
  tokens: 5,
  addedAt,
});

const quiz = {
  id: "g1",
  notebookId: "nb1",
  kind: "quiz" as const,
  title: "Tonicity quiz",
  payload: { questions: [] },
  createdAt: 1,
};

describe("PracticeDesk", () => {
  it("writes from every source until one is ticked off", async () => {
    await db.sources.bulkPut([source("s1", "Chapter 4", 1), source("s2", "Lecture 6", 2)]);
    render(<PracticeDesk notebookId="nb1" sourcesVersion={0} />);

    fireEvent.click(screen.getByRole("button", { name: /Practice quiz/ }));
    expect(screen.getByTestId("quiz-form")).toHaveTextContent("all");

    fireEvent.click(await screen.findByRole("checkbox", { name: "Lecture 6" }));
    expect(screen.getByTestId("quiz-form")).toHaveTextContent("s1");
  });

  it("drops an exclusion once the last other source is deleted", async () => {
    await db.sources.bulkPut([source("s1", "Chapter 4", 1), source("s2", "Lecture 6", 2)]);
    const { rerender } = render(<PracticeDesk notebookId="nb1" sourcesVersion={0} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Chapter 4" }));
    fireEvent.click(screen.getByRole("button", { name: /Practice quiz/ }));
    expect(screen.getByTestId("quiz-form")).toHaveTextContent("s2");

    await db.sources.delete("s2");
    rerender(<PracticeDesk notebookId="nb1" sourcesVersion={1} />);
    await waitFor(() => expect(screen.getByTestId("quiz-form")).toHaveTextContent("all"));
  });

  it("takes deleted work off the recent list", async () => {
    await db.generations.put(quiz);
    render(<PracticeDesk notebookId="nb1" sourcesVersion={0} />);
    expect(await screen.findByRole("button", { name: /Tonicity quiz/ })).toBeInTheDocument();

    await deleteGeneration("g1");
    await waitFor(() => expect(screen.queryByRole("button", { name: /Tonicity quiz/ })).not.toBeInTheDocument());
  });

  it("keeps guarding a sitting when its own recent entry is clicked again", async () => {
    await db.generations.put(quiz);
    render(<PracticeDesk notebookId="nb1" sourcesVersion={0} />);
    const entry = await screen.findByRole("button", { name: /Tonicity quiz/ });
    fireEvent.click(entry);
    expect(await screen.findByText("Question 1")).toBeInTheDocument();

    fireEvent.click(entry);
    expect(screen.queryByRole("dialog", { name: "Leave this sitting?" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Flashcards/ }));
    expect(await screen.findByRole("dialog", { name: "Leave this sitting?" })).toBeInTheDocument();
  });

  it("asks before putting away a sitting in progress", async () => {
    await db.generations.put(quiz);
    render(<PracticeDesk notebookId="nb1" sourcesVersion={0} />);

    fireEvent.click(await screen.findByRole("button", { name: /Tonicity quiz/ }));
    expect(await screen.findByText("Question 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Flashcards/ }));
    expect(await screen.findByRole("dialog", { name: "Leave this sitting?" })).toBeInTheDocument();
    expect(screen.getByText("Question 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(screen.getByText("Deck set-up")).toBeInTheDocument());
    expect(screen.queryByText("Question 1")).not.toBeInTheDocument();
  });
});
