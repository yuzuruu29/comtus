import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../lib/db";
import { DAY_MS } from "../../lib/srs";
import type { Generation } from "../../lib/types";
import ReviewDueStrip from "../ReviewDueStrip";
import { FlashcardsView } from "./FlashcardReview";

const deck: Generation = {
  id: "deck-1",
  notebookId: "nb-1",
  kind: "flashcards",
  title: "Flashcards · 2",
  payload: {
    cards: [
      { id: "c0", front: "What does the facial nerve control?", back: "Facial expression." },
      { id: "c1", front: "Define homeostasis.", back: "A stable internal environment." },
    ],
  },
  createdAt: 1,
};

async function reveal() {
  fireEvent.click(await screen.findByRole("button", { name: "Show answer" }));
  return screen.findByRole("group", { name: "Rate your recall" });
}

describe("FlashcardsView", () => {
  beforeEach(async () => {
    await Promise.all([db.notebooks.clear(), db.generations.clear(), db.cardProgress.clear()]);
    await db.notebooks.add({ id: "nb-1", name: "Physiology", createdAt: 1, updatedAt: 1 });
    await db.generations.add(deck);
  });

  it("brings a forgotten card back within the session", async () => {
    render(<FlashcardsView gen={deck} notebookId="nb-1" />);
    expect(await screen.findByText("What does the facial nerve control?")).toBeInTheDocument();
    expect(screen.getByText("2 cards left")).toBeInTheDocument();

    await reveal();
    fireEvent.click(screen.getByRole("button", { name: /^Again: next review in 10 min/ }));

    // The forgotten card went to the back; the other card is up next.
    expect(await screen.findByText("Define homeostasis.")).toBeInTheDocument();
    expect(screen.getByText("2 cards left")).toBeInTheDocument();

    await reveal();
    fireEvent.click(screen.getByRole("button", { name: /^Good: next review in 1 day/ }));

    expect(await screen.findByText("What does the facial nerve control?")).toBeInTheDocument();
    expect(screen.getByText("Relearning")).toBeInTheDocument();
    expect(screen.getByText("1 card left")).toBeInTheDocument();

    await reveal();
    fireEvent.click(screen.getByRole("button", { name: /^Good:/ }));

    expect(await screen.findByText("Session complete.")).toBeInTheDocument();
    expect(screen.getByText(/2 cards reviewed, 1 with another pass\./)).toBeInTheDocument();
    await waitFor(async () => expect(await db.cardProgress.count()).toBe(2));
  });

  it("rests when nothing is due, and can still study everything", async () => {
    const tomorrow = Date.now() + DAY_MS;
    await db.cardProgress.bulkAdd(
      ["c0", "c1"].map((c) => ({
        id: `deck-1:${c}`,
        generationId: "deck-1",
        notebookId: "nb-1",
        ease: 2.5,
        intervalDays: 1,
        dueAt: tomorrow,
        reps: 1,
      })),
    );
    render(<FlashcardsView gen={deck} notebookId="nb-1" />);

    expect(await screen.findByText("Nothing is due in this deck.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Study all 2 cards" }));
    expect(await screen.findByText("What does the facial nerve control?")).toBeInTheDocument();
    expect(screen.getByText("Studying all")).toBeInTheDocument();
  });

  it("flips with Space and answers with number keys", async () => {
    render(<FlashcardsView gen={deck} notebookId="nb-1" />);
    await screen.findByText("What does the facial nerve control?");

    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    expect(await screen.findByRole("group", { name: "Rate your recall" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "3" });

    expect(await screen.findByText("Define homeostasis.")).toBeInTheDocument();
    const row = await db.cardProgress.get("deck-1:c0");
    expect(row).toMatchObject({ intervalDays: 1, reps: 1 });
  });
});

describe("cloze cards", () => {
  const clozeDeck: Generation = {
    ...deck,
    id: "deck-cloze",
    payload: {
      cards: [{ id: "k", front: "The {{c1::Krebs cycle}} runs in the {{c2::matrix}}.", back: "Chapter 4", topic: "Energy" }],
    },
  };

  beforeEach(async () => {
    await Promise.all([db.generations.clear(), db.cardProgress.clear()]);
    await db.generations.add(clozeDeck);
  });

  it("reviews each blank as its own card with its own schedule", async () => {
    render(<FlashcardsView gen={clozeDeck} notebookId="nb-1" />);
    expect(await screen.findByText("2 cards left")).toBeInTheDocument();
    const front = document.querySelector(".fc-face-front")!;
    expect(front).toHaveTextContent("The […] runs in the matrix.");

    await reveal();
    expect(document.querySelector(".fc-face-back")).toHaveTextContent("The Krebs cycle runs in the matrix. Chapter 4");
    fireEvent.click(screen.getByRole("button", { name: /^Good:/ }));

    await waitFor(() => expect(document.querySelector(".fc-face-front")).toHaveTextContent("The Krebs cycle runs in the […]."));
    await waitFor(async () => expect(await db.cardProgress.get("deck-cloze:k~c1")).toBeDefined());
  });
});

describe("ReviewDueStrip", () => {
  beforeEach(async () => {
    await Promise.all([db.notebooks.clear(), db.generations.clear(), db.cardProgress.clear()]);
    await db.notebooks.add({ id: "nb-1", name: "Physiology", createdAt: 1, updatedAt: 1 });
    await db.generations.add(deck);
  });

  it("stays out of the way when nothing is due", async () => {
    const { container } = render(<ReviewDueStrip onReview={() => {}} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("lists due decks and opens one", async () => {
    await db.cardProgress.add({
      id: "deck-1:c1",
      generationId: "deck-1",
      notebookId: "nb-1",
      ease: 2.5,
      intervalDays: 1,
      dueAt: Date.now() - 1000,
      reps: 1,
    });
    const onReview = vi.fn();
    render(<ReviewDueStrip onReview={onReview} />);

    expect(await screen.findByRole("heading", { name: "Ready for review" })).toBeInTheDocument();
    expect(screen.getByText(/1 card is due\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Review 1 due card in Physiology/ }));
    expect(onReview).toHaveBeenCalledWith("nb-1", "deck-1");
  });
});
