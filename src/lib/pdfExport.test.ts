import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Generation, QuizQuestion } from "./types";
import { savePdf } from "./pdfExport";

// pdfExport.ts:406 calls doc.save(), which under the test runner wrote
// la-quiz.pdf and nursing-guide.pdf into the repo root on every run.
// jsPDF assigns save as an own property in its constructor, so there is no
// prototype to spy on. Subclass instead: real jsPDF everywhere, save stubbed.
const { saveSpy } = vi.hoisted(() => ({ saveSpy: vi.fn() }));

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  class PatchedPdf extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      this.save = saveSpy as unknown as typeof this.save;
    }
  }
  return { ...actual, jsPDF: PatchedPdf };
});

beforeEach(() => {
  saveSpy.mockClear();
});

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
    await savePdf(gen("quiz", { questions: [solutionQ, mcq] }), "Linear Algebra", "la-quiz");
    expect(saveSpy).toHaveBeenCalledOnce();
    expect(saveSpy.mock.calls[0]?.[0]).toMatch(/la-quiz\.pdf$/);
  });

  it("builds a study-guide PDF from markdown", async () => {
    await savePdf(
      gen("study-guide", { markdown: "# Fluids\n\n- hydrostatic pressure\n" }, "Study guide"),
      "Nursing",
      "nursing-guide",
    );
    expect(saveSpy).toHaveBeenCalledOnce();
    expect(saveSpy.mock.calls[0]?.[0]).toMatch(/nursing-guide\.pdf$/);
  });
});
