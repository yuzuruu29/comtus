import type { TopicStanding } from "./attempts";
import { daysUntil } from "./exam";
import { DAY_MS, progressId } from "./srs";
import type { Attempt, CardProgress, Flashcard } from "./types";

/**
 * Today's plan for a notebook with an exam ahead: a few concrete things,
 * worked out fresh each day from what is actually due. Nothing carries
 * over and nothing is counted against the student — a skipped day simply
 * changes tomorrow's numbers.
 */

export interface PlanDeck {
  id: string;
  title: string;
  /** Cards as reviewed (cloze cards already expanded). */
  cards: Flashcard[];
}

export interface PlanInput {
  now: number;
  examAt: number;
  decks: PlanDeck[];
  /** The notebook's progress rows. */
  progress: CardProgress[];
  standing: TopicStanding[];
  attempts: Attempt[];
}

export type PlanItem =
  | { kind: "review"; deckId: string; deckTitle: string; due: number; decks: number; minutes: number }
  | { kind: "learn"; deckId: string; deckTitle: string; count: number }
  | { kind: "practice"; topic: string; percent: number }
  | { kind: "first-quiz" }
  | { kind: "mock-exam" };

export interface StudyPlan {
  /** 0 on exam day; negative once it has passed. */
  daysLeft: number;
  items: PlanItem[];
}

const SECONDS_PER_CARD = 20;
const STEADY = 0.8;
const MOCK_WINDOW_DAYS = 7;

/** New cards a day that shows every unseen card by the day before the
 *  exam: today plus each day until then. */
export function newCardPace(unseen: number, daysLeft: number): number {
  if (unseen <= 0) return 0;
  return Math.ceil(unseen / Math.max(1, daysLeft));
}

export function buildPlan(input: PlanInput): StudyPlan {
  const { now } = input;
  const daysLeft = daysUntil(input.examAt, now);
  const items: PlanItem[] = [];
  if (daysLeft < 0) return { daysLeft, items };

  const done = new Map(input.progress.map((p) => [p.id, p]));
  let due = 0;
  let dueDecks = 0;
  let unseen = 0;
  let mostDue: { deck: PlanDeck; n: number } | null = null;
  let mostUnseen: { deck: PlanDeck; n: number } | null = null;
  for (const deck of input.decks) {
    let d = 0;
    let u = 0;
    for (const card of deck.cards) {
      const p = done.get(progressId(deck.id, card.id));
      if (!p) u++;
      else if (p.dueAt <= now) d++;
    }
    due += d;
    unseen += u;
    if (d > 0) dueDecks++;
    if (d > (mostDue?.n ?? 0)) mostDue = { deck, n: d };
    if (u > (mostUnseen?.n ?? 0)) mostUnseen = { deck, n: u };
  }

  if (mostDue) {
    items.push({
      kind: "review",
      deckId: mostDue.deck.id,
      deckTitle: mostDue.deck.title,
      due,
      decks: dueDecks,
      minutes: Math.max(1, Math.round((due * SECONDS_PER_CARD) / 60)),
    });
  }
  // Exam day is for a light review, not new material.
  if (daysLeft === 0) return { daysLeft, items };

  if (mostUnseen) {
    items.push({
      kind: "learn",
      deckId: mostUnseen.deck.id,
      deckTitle: mostUnseen.deck.title,
      count: Math.min(unseen, newCardPace(unseen, daysLeft)),
    });
  }

  const weakest = input.standing.find((t) => t.earned / t.total < STEADY);
  if (weakest) {
    items.push({ kind: "practice", topic: weakest.topic, percent: Math.round((100 * weakest.earned) / weakest.total) });
  } else if (input.attempts.length === 0) {
    items.push({ kind: "first-quiz" });
  }

  const recentMock = input.attempts.some((a) => a.kind === "exam" && a.finishedAt >= now - MOCK_WINDOW_DAYS * DAY_MS);
  if (daysLeft <= MOCK_WINDOW_DAYS && !recentMock) items.push({ kind: "mock-exam" });

  return { daysLeft, items };
}
