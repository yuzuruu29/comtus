import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuizPayload, QuizQuestion } from "../../lib/types";

const fx = vi.hoisted(() => ({
  triggerConfettiCannon: vi.fn(),
  triggerScreenShake: vi.fn(),
}));

vi.mock("../fx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fx")>();
  return {
    ...actual,
    triggerConfettiCannon: fx.triggerConfettiCannon,
    triggerScreenShake: fx.triggerScreenShake,
  };
});

vi.mock("../../lib/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/settings")>();
  return {
    ...actual,
    useCallSettings: () => ({
      provider: "openai-compatible" as const,
      apiKey: "",
      baseUrl: "",
      model: "test",
      effort: "steady" as const,
    }),
    useSettings: (selector: (s: { companionSfx: boolean }) => unknown) =>
      selector({ companionSfx: true }),
  };
});

vi.mock("../../lib/llm", () => ({
  generateJSON: vi.fn(),
  checkSolution: vi.fn(),
  friendlyError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock("../companion/sfx", () => ({
  playSfx: vi.fn(),
  playComboSfx: vi.fn(),
  playRetroArpeggio: vi.fn(),
}));

import { QuizTaker } from "./QuizFlow";

const mcq = (id: string, stem: string): QuizQuestion => ({
  id,
  format: "mcq",
  topic: "Arithmetic",
  difficulty: "easy",
  stem,
  options: ["1", "2", "3", "4"],
  answerIndex: 1,
  answer: "2",
  rationale: "Basic arithmetic.",
});

const payload: QuizPayload = {
  questions: [mcq("q1", "What is 1+1?"), mcq("q2", "What is 3-1?")],
  config: { count: 2, formats: ["mcq"], difficulty: "easy", scope: "" },
};

afterEach(() => {
  cleanup();
  fx.triggerConfettiCannon.mockClear();
  fx.triggerScreenShake.mockClear();
});

function answerCurrentCorrect() {
  const options = screen.getAllByRole("button", { name: /2/ });
  const opt = options.find((b) => !b.hasAttribute("disabled")) ?? options[options.length - 1];
  fireEvent.click(opt);
  const checkBtns = screen.getAllByRole("button", { name: /check answer/i });
  const checkBtn = checkBtns.find((b) => !b.hasAttribute("disabled")) ?? checkBtns[checkBtns.length - 1];
  fireEvent.click(checkBtn);
}

describe("QuizTaker juice", () => {
  it("does not show combo / FIRE after consecutive correct answers", () => {
    render(<QuizTaker payload={payload} onRetake={() => {}} />);
    answerCurrentCorrect();
    fireEvent.click(screen.getByRole("button", { name: /next item/i }));
    answerCurrentCorrect();
    expect(screen.queryByText(/combo/i)).toBeNull();
    expect(screen.queryByText(/🔥/)).toBeNull();
    expect(document.querySelector(".arcade-combo-badge")).toBeNull();
    expect(document.querySelector(".arcade-spark-shower")).toBeNull();
    expect(fx.triggerScreenShake).not.toHaveBeenCalled();
  });

  it("does not fire confetti, shake, or a streak badge on results", () => {
    render(<QuizTaker payload={payload} onRetake={() => {}} />);
    answerCurrentCorrect();
    fireEvent.click(screen.getByRole("button", { name: /next item/i }));
    answerCurrentCorrect();
    fireEvent.click(screen.getByRole("button", { name: /see results/i }));
    expect(fx.triggerConfettiCannon).not.toHaveBeenCalled();
    expect(fx.triggerScreenShake).not.toHaveBeenCalled();
    expect(screen.queryByText(/streak/i)).toBeNull();
    expect(screen.queryByText(/🔥/)).toBeNull();
  });
});
