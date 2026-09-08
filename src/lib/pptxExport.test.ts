import { afterEach, describe, expect, it, vi } from "vitest";
import PptxGenJS from "pptxgenjs";
import type { Generation, QuizQuestion } from "./types";
import { savePptx } from "./pptxExport";
import { createAssessmentCapture } from "./assessmentExport";

vi.mock("./assessmentExport", () => ({
  createAssessmentCapture: vi.fn(() => ({ render: vi.fn().mockResolvedValue([]), close: vi.fn() })),
}));

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("savePptx", () => {
  it("writes a quiz deck with solution items and no config", async () => {
    const writeFile = vi.spyOn(PptxGenJS.prototype, "writeFile").mockResolvedValue("ok");
    await savePptx(gen("quiz", { questions: [solutionQ, mcq] }), "Linear Algebra", "la-quiz");
    expect(writeFile).toHaveBeenCalled();
    const arg = writeFile.mock.calls[0]?.[0] as { fileName?: string } | undefined;
    expect(arg?.fileName).toMatch(/la-quiz\.pptx$/);
    const capture = vi.mocked(createAssessmentCapture).mock.results.at(-1)!.value;
    expect(capture.render).toHaveBeenCalledWith(expect.stringContaining(solutionQ.answer), expect.any(Number));
    expect(capture.render).toHaveBeenCalledWith(solutionQ.rationale, expect.any(Number));
    expect(capture.close).toHaveBeenCalledOnce();
  });

  it("writes a presentation deck", async () => {
    const writeFile = vi.spyOn(PptxGenJS.prototype, "writeFile").mockResolvedValue("ok");
    await savePptx(
      gen(
        "presentation",
        {
          topic: "Fluids",
          deckTitle: "Hydrostatics",
          slides: [{ id: "s1", slideNumber: 1, title: "Pressure", bullets: ["P = ρgh"] }],
        },
        "Slides",
      ),
      "Nursing",
      "fluids-deck",
    );
    expect(writeFile).toHaveBeenCalled();
  });
});
