import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db";
import { toDateInput } from "../lib/exam";
import { DAY_MS, startOfLocalDay } from "../lib/srs";
import ExamPlan from "./ExamPlan";

const deck = {
  id: "deck-1",
  notebookId: "nb",
  kind: "flashcards" as const,
  title: "Organelles",
  payload: { cards: [{ id: "a", front: "Q", back: "A" }, { id: "b", front: "The {{c1::nucleus}} holds DNA", back: "" }] },
  createdAt: 1,
};

function renderPlan() {
  const props = { onOpenDeck: vi.fn(), onPractice: vi.fn(), onMockExam: vi.fn() };
  render(<ExamPlan notebookId="nb" version={0} {...props} />);
  return props;
}

beforeEach(async () => {
  await Promise.all([db.notebooks.clear(), db.generations.clear(), db.cardProgress.clear(), db.attempts.clear()]);
  await db.notebooks.add({ id: "nb", name: "Bio", createdAt: 1, updatedAt: 1 });
  await db.generations.add(deck);
});

describe("ExamPlan", () => {
  it("asks quietly for a date, then plans the day", async () => {
    const props = renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Add date" }));
    const inTwelve = toDateInput(startOfLocalDay(Date.now(), 12));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: inTwelve } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Midterm" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Midterm in 12 days" })).toBeInTheDocument();
    expect(screen.getByText("For today")).toBeInTheDocument();
    // Two cards, one of them cloze, none seen: a pace of one a day.
    expect(screen.getByText("Learn 1 new card")).toBeInTheDocument();
    expect(screen.getByText("Take a practice quiz")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start: Learn 1 new card" }));
    expect(props.onOpenDeck).toHaveBeenCalledWith(expect.objectContaining({ id: "deck-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Start: Take a practice quiz" }));
    expect(props.onPractice).toHaveBeenCalledWith();
  });

  it("offers the review due today and can remove the date", async () => {
    await db.notebooks.update("nb", { examAt: startOfLocalDay(Date.now(), 3) });
    await db.cardProgress.add({
      id: "deck-1:a",
      generationId: "deck-1",
      notebookId: "nb",
      ease: 2.5,
      intervalDays: 1,
      dueAt: Date.now() - DAY_MS,
      reps: 1,
    });
    renderPlan();
    expect(await screen.findByText("Review 1 card")).toBeInTheDocument();
    expect(screen.getByText("About 1 min in Organelles")).toBeInTheDocument();
    expect(screen.getByText("Sit a timed mock exam")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Change the exam date" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove date" }));
    expect(await screen.findByRole("button", { name: "Add date" })).toBeInTheDocument();
    await waitFor(async () => expect((await db.notebooks.get("nb"))?.examAt).toBeUndefined());
  });

  it("says when the exam has passed", async () => {
    await db.notebooks.update("nb", { examAt: startOfLocalDay(Date.now(), -2), examName: "Final" });
    renderPlan();
    expect(await screen.findByText(/Your Final was on .+\. Reviews are back on their usual schedule\./)).toBeInTheDocument();
  });
});
