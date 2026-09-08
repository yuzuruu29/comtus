import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Generation, QuizQuestion } from "./types";
import { savePdf } from "./pdfExport";
import { createAssessmentCapture } from "./assessmentExport";

vi.mock("./assessmentExport", () => ({
  createAssessmentCapture: vi.fn(() => ({ render: vi.fn().mockResolvedValue([]), close: vi.fn() })),
}));

// pdfExport.ts:406 calls doc.save(), which under the test runner wrote
// la-quiz.pdf and nursing-guide.pdf into the repo root on every run.
// jsPDF assigns save as an own property in its constructor, so there is no
// prototype to spy on. Subclass instead: real jsPDF everywhere, save stubbed.
const { saveSpy, imagePlacements } = vi.hoisted(() => ({
  saveSpy: vi.fn(),
  imagePlacements: [] as { data: string; page: number }[],
}));

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  class PatchedPdf extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      this.save = saveSpy as unknown as typeof this.save;
      this.addImage = (data: unknown) => {
        if (typeof data !== "string") throw new TypeError("Expected an image data URL");
        imagePlacements.push({ data, page: this.getCurrentPageInfo().pageNumber });
        return this;
      };
    }
  }
  return { ...actual, jsPDF: PatchedPdf };
});

beforeEach(() => {
  saveSpy.mockClear();
  imagePlacements.length = 0;
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
    const capture = vi.mocked(createAssessmentCapture).mock.results.at(-1)!.value;
    expect(capture.render).toHaveBeenCalledWith(solutionQ.answer, expect.any(Number));
    expect(capture.render).toHaveBeenCalledWith(solutionQ.rationale, expect.any(Number));
    expect(capture.close).toHaveBeenCalledOnce();
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

  it("preserves graphs and complete worked explanations", async () => {
    const graph = { title: "Demand", xLabel: "Quantity", yLabel: "Price", series: [{ label: "Demand", points: [[0, 10], [10, 0]] as [number, number][] }] };
    const rationale = "A complete worked explanation. ".repeat(100);
    await savePdf(gen("quiz", { questions: [{ ...solutionQ, graph, rationale }] }), "Economics", "economics");
    const capture = vi.mocked(createAssessmentCapture).mock.results.at(-1)!.value;
    expect(capture.render).toHaveBeenCalledWith(graph, expect.any(Number));
    expect(capture.render).toHaveBeenCalledWith(rationale, expect.any(Number));
  });

  it("propagates rendering failure and closes the export document", async () => {
    const close = vi.fn();
    vi.mocked(createAssessmentCapture).mockReturnValueOnce({ render: vi.fn().mockRejectedValue(new Error("Capture failed")), close });
    await expect(savePdf(gen("quiz", { questions: [solutionQ] }), "Math", "math")).rejects.toThrow("Capture failed");
    expect(close).toHaveBeenCalledOnce();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("keeps a fitting stem and all four options on one page", async () => {
    const render = vi.fn(async (content: string) => [{ data: content, width: 478, height: 75 }]);
    vi.mocked(createAssessmentCapture).mockReturnValueOnce({ render, close: vi.fn() });
    const questions = [mcq, { ...mcq, id: "indices", stem: "Find the index.", options: ["$I_t=100$", "$I_t=125$", "$I_t=150$", "$I_t=200$"] }];
    await savePdf(gen("quiz", { questions }), "Economics", "indices");
    const item = imagePlacements.filter(({ data }) => data === questions[1].stem || questions[1].options.some((option, i) => data === `**${String.fromCharCode(65 + i)}.** ${option}`));
    expect(item).toHaveLength(5);
    expect(new Set(item.map(({ page }) => page)).size).toBe(1);
    expect(item[0].page).toBeGreaterThan(1);
  });
});
