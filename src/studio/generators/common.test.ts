import { describe, expect, it } from "vitest";
import { sanitizeQuestions, solutionCredit, fmtScore } from "./common";
import type { SolutionCheck } from "../../lib/types";

describe("sanitizeQuestions — solution format", () => {
  it("keeps a well-formed solution item and strips its options", () => {
    const [q] = sanitizeQuestions([
      {
        format: "solution",
        topic: "Mathematics & Surveying",
        difficulty: "hard",
        stem: "A vertical sag curve connects a -3% grade to a +2% grade. Find the length of curve.",
        options: ["oops"],
        answerIndex: 0,
        answer: "120 m",
        rationale: "1. L = A·V²/…  2. …",
      },
    ]);
    expect(q).toBeDefined();
    expect(q.format).toBe("solution");
    expect(q.options).toEqual([]);
    expect(q.answerIndex).toBe(0);
    expect(q.answer).toBe("120 m");
    expect(q.rationale).toContain("L =");
  });

  it("drops solution items that carry no expected answer", () => {
    const out = sanitizeQuestions([
      { format: "solution", stem: "Solve for x.", answer: "   ", rationale: "" },
    ]);
    expect(out).toEqual([]);
  });

  it("still coerces unknown formats to mcq", () => {
    const [q] = sanitizeQuestions([
      { format: "essay", stem: "What is the passing pace?", options: ["A", "B"], answerIndex: 1, answer: "B" },
    ]);
    expect(q.format).toBe("mcq");
  });
});

describe("solutionCredit", () => {
  const check = (verdict: SolutionCheck["verdict"]): SolutionCheck => ({
    verdict,
    finalAnswerOk: verdict === "correct",
    transcribedAnswer: "",
    errors: [],
    feedback: "",
  });

  it("full, half, and no credit", () => {
    expect(solutionCredit(check("correct"))).toBe(1);
    expect(solutionCredit(check("partial"))).toBe(0.5);
    expect(solutionCredit(check("incorrect"))).toBe(0);
    expect(solutionCredit(check("unreadable"))).toBe(0);
  });

  it("an unchecked sheet earns nothing", () => {
    expect(solutionCredit(null)).toBe(0);
    expect(solutionCredit(undefined)).toBe(0);
  });
});

describe("fmtScore", () => {
  it("keeps halves, cleans wholes", () => {
    expect(fmtScore(7)).toBe("7");
    expect(fmtScore(7.5)).toBe("7.5");
    expect(fmtScore(10)).toBe("10");
  });
});
