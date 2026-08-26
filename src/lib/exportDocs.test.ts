import { describe, expect, it } from "vitest";
import type { Generation, QuizQuestion } from "./types";
import { answerText, exportFormatsFor, metaLineFor } from "./exportDocs";

const stem = "Show all working. Add the matrices.";

const solutionQ: QuizQuestion = {
  id: "q0",
  format: "solution",
  topic: "Matrix Addition",
  difficulty: "easy",
  stem,
  options: [],
  answerIndex: 0,
  answer: "[[6, 9], [2, 8]]",
  rationale: "Add corresponding entries.",
};

const mcq: QuizQuestion = {
  id: "q1",
  format: "mcq",
  topic: "Arithmetic",
  difficulty: "easy",
  stem: "What is 1+1?",
  options: ["1", "2", "3", "4"],
  answerIndex: 1,
  answer: "2",
  rationale: "Basic arithmetic.",
};

function gen(kind: Generation["kind"], payload: unknown, title = "Quiz · 10 items"): Generation {
  return {
    id: "g1",
    notebookId: "nb1",
    kind,
    title,
    payload,
    createdAt: Date.parse("2026-08-26T00:00:00Z"),
  };
}

describe("answerText", () => {
  it("uses the worked final answer for solution items, not option letter A", () => {
    expect(answerText(solutionQ)).toBe("[[6, 9], [2, 8]]");
  });

  it("uses the identification string and True/False labels", () => {
    expect(
      answerText({ ...solutionQ, format: "identification", answer: "mitochondria" }),
    ).toBe("mitochondria");
    expect(answerText({ ...mcq, format: "truefalse", options: ["True", "False"], answerIndex: 0 })).toBe(
      "True",
    );
  });
});

describe("metaLineFor", () => {
  it("does not throw when a quiz payload has no config (LLM often omits it)", () => {
    expect(() => metaLineFor(gen("quiz", { questions: [solutionQ, mcq] }))).not.toThrow();
    expect(metaLineFor(gen("quiz", { questions: [solutionQ, mcq] }))).toMatch(/2 items/);
  });

  it("uses exam blueprint when present and still works without it", () => {
    const withBp = metaLineFor(
      gen("exam", {
        questions: [mcq],
        blueprint: { totalItems: 50, minutes: 90, sections: [], preset: "custom", title: "Mock", difficulty: "mixed" },
      }),
    );
    expect(withBp).toMatch(/50 items/);
    expect(withBp).toMatch(/90 minutes/);
    expect(metaLineFor(gen("exam", { questions: [mcq, mcq] }))).toMatch(/2 items/);
  });
});

describe("exportFormatsFor", () => {
  it("offers PDF and PowerPoint for quiz, exam, and flashcards", () => {
    expect(exportFormatsFor("quiz")).toEqual(["pdf", "pptx"]);
    expect(exportFormatsFor("exam")).toEqual(["pdf", "pptx"]);
    expect(exportFormatsFor("flashcards")).toEqual(["pdf", "pptx"]);
  });

  it("offers PDF for study aids and PPT for decks", () => {
    expect(exportFormatsFor("study-guide")).toEqual(["pdf"]);
    expect(exportFormatsFor("presentation")).toEqual(["pptx"]);
  });
});
