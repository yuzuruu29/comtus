import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db } from "./db";
import { daysUntil, examCountdown, fromDateInput, setNotebookExam, toDateInput } from "./exam";
import { recordRating } from "./reviews";
import { DAY_MS, buildReviewQueue, capToExam, schedule, startOfLocalDay } from "./srs";
import { buildPlan, newCardPace, type PlanInput } from "./studyPlan";
import type { Attempt, CardProgress } from "./types";

// Noon on a Wednesday, local time: far from midnight so day math is plain.
const NOW = new Date(2026, 8, 30, 12, 0).getTime();
const day = (n: number) => startOfLocalDay(NOW, n);

describe("exam dates", () => {
  it("counts calendar days and names the countdown", () => {
    expect(daysUntil(day(12), NOW)).toBe(12);
    expect(daysUntil(day(0) + 5 * 3600_000, NOW)).toBe(0);
    expect(examCountdown({ examAt: day(12), examName: "Midterm" }, NOW)).toBe("Midterm in 12 days");
    expect(examCountdown({ examAt: day(1) }, NOW)).toBe("Exam tomorrow");
    expect(examCountdown({ examAt: day(0) }, NOW)).toBe("Exam today");
    expect(examCountdown({ examAt: day(-1) }, NOW)).toBeNull();
    expect(examCountdown({}, NOW)).toBeNull();
  });

  it("reads and writes date inputs in local time", () => {
    expect(toDateInput(day(0))).toBe("2026-09-30");
    expect(fromDateInput("2026-10-12")).toBe(new Date(2026, 9, 12).getTime());
    expect(fromDateInput("2026-02-31")).toBeNull();
    expect(fromDateInput("soon")).toBeNull();
  });
});

describe("reviews before the exam", () => {
  it("brings a card due after the exam back the day before it", () => {
    const next = schedule({ ease: 2.5, intervalDays: 10, dueAt: NOW, reps: 3 }, "good", NOW);
    expect(next.intervalDays).toBe(25);
    const capped = capToExam(next, NOW, day(6));
    expect(capped).toMatchObject({ dueAt: day(5), intervalDays: 5 });
  });

  it("leaves short intervals, relearning and past exams alone", () => {
    const soon = schedule(undefined, "good", NOW);
    expect(capToExam(soon, NOW, day(6))).toEqual(soon);
    const again = schedule(soon, "again", NOW);
    expect(capToExam(again, NOW, day(6))).toEqual(again);
    const long = schedule({ ease: 2.5, intervalDays: 10, dueAt: NOW, reps: 3 }, "good", NOW);
    expect(capToExam(long, NOW, day(-2))).toEqual(long);
    // An exam tomorrow still leaves a day to review: tomorrow.
    expect(capToExam(long, NOW, day(1)).dueAt).toBe(day(1));
  });

  it("applies the cap when a rating is recorded", async () => {
    await db.notebooks.clear();
    await db.cardProgress.clear();
    await db.notebooks.add({ id: "nb", name: "Bio", createdAt: 1, updatedAt: 1 });
    await setNotebookExam("nb", day(4), "Final");
    await db.cardProgress.add({ id: "deck:c", generationId: "deck", notebookId: "nb", ease: 2.5, intervalDays: 10, dueAt: NOW, reps: 3 });
    const row = await recordRating({ id: "deck", notebookId: "nb" }, "c", "easy", NOW);
    expect(row.dueAt).toBe(day(3));
    expect((await db.notebooks.get("nb"))?.examName).toBe("Final");

    await setNotebookExam("nb", null);
    const cleared = await db.notebooks.get("nb");
    expect(cleared?.examAt).toBeUndefined();
    expect(cleared?.examName).toBeUndefined();
  });

  it("paces new cards so all are seen by the day before", () => {
    expect(newCardPace(100, 10)).toBe(10);
    expect(newCardPace(101, 10)).toBe(11);
    expect(newCardPace(7, 1)).toBe(7);
    expect(newCardPace(0, 5)).toBe(0);
    const cards = ["a", "b", "c", "d"].map((id) => ({ id, front: id, back: id }));
    expect(buildReviewQueue(cards, new Map(), NOW, 2)).toEqual(["a", "b"]);
  });
});

describe("today's plan", () => {
  const progress = (card: string, dueAt: number): CardProgress => ({
    id: `deck-1:${card}`,
    generationId: "deck-1",
    notebookId: "nb",
    ease: 2.5,
    intervalDays: 1,
    dueAt,
    reps: 1,
  });
  const input = (over: Partial<PlanInput> = {}): PlanInput => ({
    now: NOW,
    examAt: day(10),
    decks: [
      { id: "deck-1", title: "Organelles", cards: ["a", "b", "c", "d"].map((id) => ({ id, front: id, back: id })) },
      { id: "deck-2", title: "Energy", cards: Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, front: "f", back: "b" })) },
    ],
    progress: [progress("a", NOW - DAY_MS), progress("b", NOW - 1), progress("c", day(3))],
    standing: [],
    attempts: [],
    ...over,
  });

  it("lists due reviews, paced new cards and a first quiz", () => {
    const plan = buildPlan(input());
    expect(plan.daysLeft).toBe(10);
    expect(plan.items).toEqual([
      { kind: "review", deckId: "deck-1", deckTitle: "Organelles", due: 2, decks: 1, minutes: 1 },
      // 31 unseen cards over 10 days.
      { kind: "learn", deckId: "deck-2", deckTitle: "Energy", count: 4 },
      { kind: "first-quiz" },
    ]);
  });

  it("points at the weakest topic and suggests a mock exam in the last week", () => {
    const quiz: Attempt = {
      id: "t",
      notebookId: "nb",
      generationId: "q",
      kind: "quiz",
      scope: "full",
      score: 3,
      total: 5,
      items: [],
      finishedAt: NOW - DAY_MS,
    };
    const plan = buildPlan(
      input({
        examAt: day(5),
        standing: [{ topic: "Krebs cycle", earned: 2, total: 5, lastSeenAt: NOW }],
        attempts: [quiz],
      }),
    );
    expect(plan.items.map((i) => i.kind)).toEqual(["review", "learn", "practice", "mock-exam"]);
    expect(plan.items[2]).toEqual({ kind: "practice", topic: "Krebs cycle", percent: 40 });
    // A mock exam taken this week is enough.
    const mocked = buildPlan(input({ examAt: day(5), attempts: [{ ...quiz, kind: "exam" }] }));
    expect(mocked.items.map((i) => i.kind)).not.toContain("mock-exam");
  });

  it("keeps exam day to a light review and says nothing once it has passed", () => {
    expect(buildPlan(input({ examAt: day(0) })).items.map((i) => i.kind)).toEqual(["review"]);
    expect(buildPlan(input({ examAt: day(-1) }))).toEqual({ daysLeft: -1, items: [] });
  });
});

