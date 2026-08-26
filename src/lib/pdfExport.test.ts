import { describe, expect, it } from "vitest";
import type { Generation, QuizQuestion } from "./types";
import { savePdf } from "./pdfExport";

const solutionQ: QuizQuestion = {
  id: "q0",
  format: "solution",
  topic: "Matrix Addition",
  difficulty: "easy",
  stem: "Show all working. Add the matrices A and B.",
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

describe("savePdf", () => {
  it("builds a quiz paper even when config was never stored", async () => {
    await expect(
      savePdf(gen("quiz", { questions: [solutionQ, mcq] }), "Linear Algebra", "la-quiz"),
    ).resolves.toBeUndefined();
  });

  it("builds a study-guide PDF from markdown", async () => {
    await expect(
      savePdf(
        gen("study-guide", { markdown: "# Fluids\n\n- hydrostatic pressure\n" }, "Study guide"),
        "Nursing",
        "nursing-guide",
      ),
    ).resolves.toBeUndefined();
  });
});
