import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlashcardsPayload, Generation, QuizPayload, QuizQuestion } from "../../lib/types";

const fx = vi.hoisted(() => ({
  triggerScreenShake: vi.fn(),
}));

vi.mock("../fx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fx")>();
  return {
    ...actual,
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
import { db } from "../../lib/db";
import { missesDeckId } from "../../lib/attempts";

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
    render(<QuizTaker payload={payload} />);
    answerCurrentCorrect();
    fireEvent.click(screen.getByRole("button", { name: /next item/i }));
    answerCurrentCorrect();
    expect(screen.queryByText(/combo/i)).toBeNull();
    expect(screen.queryByText(/🔥/)).toBeNull();
    expect(document.querySelector(".arcade-combo-badge")).toBeNull();
    expect(document.querySelector(".arcade-spark-shower")).toBeNull();
    expect(fx.triggerScreenShake).not.toHaveBeenCalled();
  });

  it("does not fire shake or a streak badge on results", () => {
    render(<QuizTaker payload={payload} />);
    answerCurrentCorrect();
    fireEvent.click(screen.getByRole("button", { name: /next item/i }));
    answerCurrentCorrect();
    fireEvent.click(screen.getByRole("button", { name: /see results/i }));
    expect(fx.triggerScreenShake).not.toHaveBeenCalled();
    expect(screen.queryByText(/streak/i)).toBeNull();
    expect(screen.queryByText(/🔥/)).toBeNull();
  });

  it("reports unfinished work to its host until the results are shown", () => {
    const onActiveChange = vi.fn();
    render(<QuizTaker payload={payload} onActiveChange={onActiveChange} />);
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
    answerCurrentCorrect();
    expect(onActiveChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: /next item/i }));
    answerCurrentCorrect();
    fireEvent.click(screen.getByRole("button", { name: /see results/i }));
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
  });
});

function answer(optionLabel: RegExp) {
  const options = screen.getAllByRole("button", { name: optionLabel });
  fireEvent.click(options.find((b) => !b.hasAttribute("disabled")) ?? options[options.length - 1]);
  const checkBtns = screen.getAllByRole("button", { name: /check answer/i });
  fireEvent.click(checkBtns.find((b) => !b.hasAttribute("disabled")) ?? checkBtns[checkBtns.length - 1]);
}

describe("QuizTaker attempts", () => {
  const gen: Generation = { id: "quiz-1", notebookId: "nb-1", kind: "quiz", title: "Quiz", payload, createdAt: 1 };

  async function finishWithOneMiss() {
    answer(/2/); // q1 right
    fireEvent.click(screen.getByRole("button", { name: /next item/i }));
    answer(/^C/); // q2 wrong
    fireEvent.click(screen.getByRole("button", { name: /see results/i }));
    await screen.findByText("1 item to work on.");
  }

  beforeEach(async () => {
    await Promise.all([db.attempts.clear(), db.generations.clear(), db.notebooks.clear()]);
    await db.notebooks.add({ id: "nb-1", name: "Maths", createdAt: 1, updatedAt: 1 });
  });

  it("saves the attempt and compares it with the last one", async () => {
    await db.attempts.add({
      id: "earlier",
      notebookId: "nb-1",
      generationId: "quiz-1",
      kind: "quiz",
      scope: "full",
      score: 0,
      total: 2,
      items: [],
      finishedAt: 1,
    });
    render(<QuizTaker payload={payload} gen={gen} />);
    await finishWithOneMiss();

    expect(await screen.findByText("Up 50 points from last time (0%).")).toBeInTheDocument();
    const saved = await db.attempts.where("generationId").equals("quiz-1").sortBy("finishedAt");
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ scope: "full", score: 1, total: 2 });
    expect(saved[1].items.map((it) => it.credit)).toEqual([1, 0]);
  });

  it("turns misses into cards and hands off to the deck", async () => {
    const onOpenGeneration = vi.fn();
    render(<QuizTaker payload={payload} gen={gen} onOpenGeneration={onOpenGeneration} />);
    await finishWithOneMiss();

    fireEvent.click(screen.getByRole("button", { name: "Make a flashcard from them" }));
    expect(await screen.findByText("Added 1 card to Missed questions.")).toBeInTheDocument();
    const deck = await db.generations.get(missesDeckId("nb-1"));
    expect((deck?.payload as FlashcardsPayload).cards.map((c) => c.id)).toEqual(["m-quiz-1-q2"]);

    fireEvent.click(screen.getByRole("button", { name: "Review the deck" }));
    expect(onOpenGeneration).toHaveBeenCalledWith(expect.objectContaining({ id: missesDeckId("nb-1") }));
  });

  it("retakes only the missed items, in place", async () => {
    render(<QuizTaker payload={payload} gen={gen} />);
    await finishWithOneMiss();

    fireEvent.click(screen.getByRole("button", { name: "Retake the 1 I missed" }));
    expect(screen.getByText("Item 1 of 1")).toBeInTheDocument();
    expect(screen.getByText("What is 3-1?")).toBeInTheDocument();

    answer(/2/);
    fireEvent.click(screen.getByRole("button", { name: /see results/i }));
    expect(await screen.findByText("Every missed item is right this time.")).toBeInTheDocument();
    expect(screen.getByText("Retake of missed items")).toBeInTheDocument();
    await waitFor(async () =>
      expect((await db.attempts.toArray()).map((a) => a.scope).sort()).toEqual(["full", "misses"]),
    );
  });

  it("restarts the whole quiz in place", async () => {
    render(<QuizTaker payload={payload} gen={gen} />);
    await finishWithOneMiss();
    fireEvent.click(screen.getByRole("button", { name: /^Retake$/ }));
    expect(screen.getByText("Item 1 of 2")).toBeInTheDocument();
  });
});
