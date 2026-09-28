import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addMissesToDeck,
  cardFromQuestion,
  latestAttempts,
  missedQuestions,
  missesDeckId,
  notebookStanding,
  recordAttempt,
  scoreItems,
  topicStanding,
  typedAnswerMatches,
} from "./attempts";
import { db } from "./db";
import type { Attempt, FlashcardsPayload, QuizQuestion } from "./types";

const q = (id: string, over: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id,
  format: "mcq",
  topic: "Pharmacology",
  difficulty: "moderate",
  stem: `Stem ${id}`,
  options: ["Alpha", "Beta", "Gamma", "Delta"],
  answerIndex: 1,
  answer: "Beta",
  rationale: `Because ${id}.`,
  ...over,
});

describe("typed answers", () => {
  it("ignores case, accents and punctuation", () => {
    expect(typedAnswerMatches("  Niño!", "nino")).toBe(true);
    expect(typedAnswerMatches("mitochondri", "Mitochondria")).toBe(true);
  });

  it("grades non-Latin answers by content, never by blankness", () => {
    expect(typedAnswerMatches("光合作用", "光合作用")).toBe(true);
    expect(typedAnswerMatches("水", "光合作用")).toBe(false);
    expect(typedAnswerMatches("", "光合作用")).toBe(false);
    expect(typedAnswerMatches("!!!", "???")).toBe(false);
  });
});

describe("scoring a sitting", () => {
  const questions = [
    q("q0"),
    q("q1", { format: "identification", options: [], answerIndex: 0, answer: "Warfarin", topic: "Anticoagulants" }),
    q("q2", { format: "solution", options: [], answerIndex: 0, answer: "5 mL", topic: "Dosage" }),
    q("q3"),
  ];

  it("credits each format and marks blanks", () => {
    const items = scoreItems(questions, [
      { picked: 1, typed: "", check: null },
      { picked: null, typed: "warfarin", check: null },
      { picked: null, typed: "", check: { verdict: "partial", finalAnswerOk: false, transcribedAnswer: "", errors: [], feedback: "" } },
      { picked: null, typed: "", check: null },
    ]);
    expect(items.map((it) => [it.questionId, it.credit, it.answered])).toEqual([
      ["q0", 1, true],
      ["q1", 1, true],
      ["q2", 0.5, true],
      ["q3", 0, false],
    ]);
    expect(missedQuestions(questions, items).map((m) => m.id)).toEqual(["q2", "q3"]);
  });
});

describe("cards from misses", () => {
  it("shows the options and teaches the key", () => {
    const card = cardFromQuestion("gen-1", q("q4"));
    expect(card.id).toBe("m-gen-1-q4");
    expect(card.front).toContain("Stem q4");
    expect(card.front).toContain("B. Beta");
    expect(card.back).toBe("**Answer:** B. Beta\n\nBecause q4.");
  });

  it("asks true-or-false and keeps typed keys as they are", () => {
    const tf = cardFromQuestion("g", q("t", { format: "truefalse", options: ["True", "False"], answerIndex: 1 }));
    expect(tf.front).toMatch(/True or false\?$/);
    expect(tf.back).toMatch(/^\*\*Answer:\*\* False/);
    const id = cardFromQuestion("g", q("i", { format: "identification", options: [], answer: "Protamine" }));
    expect(id.back).toMatch(/^\*\*Answer:\*\* Protamine/);
  });
});

describe("attempt storage", () => {
  beforeEach(async () => {
    await Promise.all([db.attempts.clear(), db.generations.clear(), db.notebooks.clear()]);
  });

  const base = {
    notebookId: "nb",
    generationId: "quiz-1",
    kind: "quiz" as const,
    scope: "full" as const,
    total: 2,
  };

  it("returns the previous full attempt on the same quiz", async () => {
    const first = await recordAttempt({ ...base, score: 1, items: [] }, 1000);
    await recordAttempt({ ...base, scope: "misses", score: 1, total: 1, items: [] }, 2000);
    const third = await recordAttempt({ ...base, score: 2, items: [] }, 3000);
    expect(first.previous).toBeUndefined();
    expect(third.previous?.id).toBe(first.attempt.id);

    const latest = await latestAttempts("nb");
    expect(latest.get("quiz-1")?.id).toBe(third.attempt.id);
  });

  it("grows one misses deck per notebook without duplicates", async () => {
    await db.notebooks.add({ id: "nb", name: "Pharm", createdAt: 1, updatedAt: 1 });
    const first = await addMissesToDeck({ id: "quiz-1", notebookId: "nb" }, [q("q0"), q("q1")]);
    expect(first.added).toBe(2);
    const second = await addMissesToDeck({ id: "quiz-1", notebookId: "nb" }, [q("q1"), q("q2")]);
    expect(second.added).toBe(1);

    const deck = await db.generations.get(missesDeckId("nb"));
    expect(deck?.title).toBe("Missed questions");
    expect((deck?.payload as FlashcardsPayload).cards.map((c) => c.id)).toEqual([
      "m-quiz-1-q0",
      "m-quiz-1-q1",
      "m-quiz-1-q2",
    ]);
  });
});

describe("standing by topic", () => {
  const attempt = (at: number, items: [string, number][]): Attempt => ({
    id: `a${at}`,
    notebookId: "nb",
    generationId: "g",
    kind: "quiz",
    scope: "full",
    score: 0,
    total: items.length,
    finishedAt: at,
    items: items.map(([topic, credit], i) => ({ questionId: `q${i}`, topic, credit, answered: true })),
  });

  it("ranks weakest first and merges topic spellings", () => {
    const standing = topicStanding([
      attempt(1, [
        ["Pharmacology", 0],
        ["pharmacology ", 0],
        ["Anatomy", 1],
        ["Anatomy", 1],
        ["Ethics", 1],
      ]),
    ]);
    expect(standing.map((s) => [s.topic, s.earned, s.total])).toEqual([
      ["Pharmacology", 0, 2],
      ["Anatomy", 2, 2],
    ]);
  });

  it("weighs recent items, so improvement shows", () => {
    const old = attempt(1, Array.from({ length: 12 }, () => ["Renal", 0] as [string, number]));
    const recent = attempt(2, Array.from({ length: 12 }, () => ["Renal", 1] as [string, number]));
    expect(topicStanding([old, recent])[0]).toMatchObject({ earned: 12, total: 12, lastSeenAt: 2 });
  });

  it("reads a notebook's attempts from the store", async () => {
    await db.attempts.clear();
    await db.attempts.bulkAdd([attempt(1, [["Renal", 0], ["Renal", 1]])]);
    expect(await notebookStanding("nb")).toEqual([{ topic: "Renal", earned: 1, total: 2, lastSeenAt: 1 }]);
  });
});
