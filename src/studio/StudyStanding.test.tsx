import "fake-indexeddb/auto";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db";
import type { Attempt } from "../lib/types";
import StudyStanding from "./StudyStanding";

const attempt = (items: [string, number][]): Attempt => ({
  id: `a-${Math.random()}`,
  notebookId: "nb-1",
  generationId: "quiz-1",
  kind: "quiz",
  scope: "full",
  score: 0,
  total: items.length,
  finishedAt: Date.now(),
  items: items.map(([topic, credit], i) => ({ questionId: `q${i}`, topic, credit, answered: true })),
});

describe("StudyStanding", () => {
  beforeEach(async () => {
    await db.attempts.clear();
  });

  it("stays hidden before any quiz is finished", async () => {
    const { container } = render(<StudyStanding notebookId="nb-1" version={0} onPractice={() => {}} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("lists weak topics first and opens practice for one", async () => {
    await db.attempts.add(
      attempt([
        ["Renal", 0],
        ["Renal", 1],
        ["Cardiac", 0],
        ["Cardiac", 0],
        ["Ethics", 1],
        ["Ethics", 1],
      ]),
    );
    const onPractice = vi.fn();
    render(<StudyStanding notebookId="nb-1" version={0} onPractice={onPractice} />);

    expect(await screen.findByRole("heading", { name: "Where you stand" })).toBeInTheDocument();
    const practice = screen.getAllByRole("button", { name: /^Practice / });
    expect(practice.map((b) => b.getAttribute("aria-label"))).toEqual(["Practice Cardiac", "Practice Renal"]);
    expect(screen.queryByText("Ethics")).toBeNull();
    fireEvent.click(practice[0]);
    expect(onPractice).toHaveBeenCalledWith("Cardiac");
  });

  it("says so when every topic is holding", async () => {
    await db.attempts.add(attempt([["Ethics", 1], ["Ethics", 1]]));
    render(<StudyStanding notebookId="nb-1" version={0} onPractice={() => {}} />);
    expect(await screen.findByText(/holding at 80% or better/)).toBeInTheDocument();
  });
});
