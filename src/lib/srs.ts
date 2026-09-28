import type { CardProgress, Flashcard } from "./types";

/**
 * Spaced repetition for flashcard decks — an SM-2 descendant, deterministic
 * so the tests can pin every interval.
 *
 * - "again" puts the card back in this session and schedules a short
 *   relearn step; a graduated card that fails also counts a lapse.
 * - Graduated intervals land on local midnight, so a card due "tomorrow"
 *   is due for the whole of tomorrow, not from the minute it was rated.
 * - Stored rows keep the original CardProgress shape; `lapses` is optional,
 *   so progress written before this module still schedules correctly.
 */

export type Rating = "again" | "hard" | "good" | "easy";

export const RATINGS: readonly Rating[] = ["again", "hard", "good", "easy"];

export const DAY_MS = 86_400_000;
/** "Again" resurfaces within the session and is due again in ten minutes. */
export const RELEARN_MS = 10 * 60_000;

const START_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3.5;
const MAX_INTERVAL_DAYS = 365;

const EASE_DELTA: Record<Rating, number> = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };

/** The part of a progress row the scheduler owns. */
export type CardSchedule = Pick<CardProgress, "ease" | "intervalDays" | "dueAt" | "reps" | "lapses">;

/** Local midnight `days` days after `now` (DST-safe: steps calendar days). */
export function startOfLocalDay(now: number, days = 0): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

const clampEase = (ease: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, ease));
const clampDays = (days: number) => Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)));

/** Next interval in days for a rating; 0 means "relearn today". */
function nextIntervalDays(prev: CardSchedule | undefined, rating: Rating, ease: number): number {
  if (rating === "again") return 0;
  const interval = prev?.intervalDays ?? 0;

  // New or relearning card: graduate on a fixed ladder.
  if (interval <= 0) return rating === "easy" ? 4 : 1;

  const hard = clampDays(Math.max(interval + 1, interval * 1.2));
  if (rating === "hard") return hard;
  // Each better answer must move the card strictly further out.
  const good = clampDays(Math.max(hard + 1, interval * ease));
  if (rating === "good") return good;
  return clampDays(Math.max(good + 1, interval * ease * 1.3));
}

/** Pure scheduling step: previous state + rating → next state. */
export function schedule(prev: CardSchedule | undefined, rating: Rating, now: number): CardSchedule {
  const ease = clampEase((prev?.ease ?? START_EASE) + EASE_DELTA[rating]);
  const intervalDays = nextIntervalDays(prev, rating, ease);
  const wasGraduated = (prev?.intervalDays ?? 0) > 0;
  return {
    ease,
    intervalDays,
    dueAt: intervalDays === 0 ? now + RELEARN_MS : startOfLocalDay(now, intervalDays),
    reps: (prev?.reps ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (rating === "again" && wasGraduated ? 1 : 0),
  };
}

/**
 * With an exam ahead, no review is pushed past it: a graduated card due
 * after the exam comes back the day before instead (or tomorrow, if the
 * exam is that close), so everything gets one more look in time. Once
 * the exam has passed, scheduling is ordinary again.
 */
export function capToExam(next: CardSchedule, now: number, examAt?: number): CardSchedule {
  if (!examAt || next.intervalDays === 0 || examAt <= startOfLocalDay(now)) return next;
  const latest = Math.max(startOfLocalDay(now, 1), startOfLocalDay(examAt, -1));
  if (next.dueAt <= latest) return next;
  const intervalDays = Math.max(1, Math.round((latest - startOfLocalDay(now)) / DAY_MS));
  return { ...next, dueAt: latest, intervalDays };
}

/** Human interval for the rating buttons: "10 min", "1 day", "3 wk"… */
export function formatInterval(next: CardSchedule, now: number): string {
  if (next.intervalDays === 0) {
    const minutes = Math.max(1, Math.round((next.dueAt - now) / 60_000));
    return `${minutes} min`;
  }
  const days = next.intervalDays;
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;
  if (days < 60) return `${Math.round(days / 7)} wk`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, "")} yr`;
}

/** Interval preview for every rating, keyed by rating. */
export function previewIntervals(prev: CardSchedule | undefined, now: number, examAt?: number): Record<Rating, string> {
  return Object.fromEntries(
    RATINGS.map((r) => [r, formatInterval(capToExam(schedule(prev, r, now), now, examAt), now)]),
  ) as Record<Rating, string>;
}

export const progressId = (generationId: string, cardId: string) => `${generationId}:${cardId}`;

export interface DeckStatus {
  /** Studied before and due now. */
  due: number;
  /** Never studied. */
  fresh: number;
  /** Studied and not yet due. */
  resting: number;
  /** Earliest future due time among resting cards (0 when none). */
  nextDueAt: number;
}

export function deckStatus(
  cards: Flashcard[],
  progress: ReadonlyMap<string, CardSchedule>,
  now: number,
): DeckStatus {
  const status: DeckStatus = { due: 0, fresh: 0, resting: 0, nextDueAt: 0 };
  for (const card of cards) {
    const p = progress.get(card.id);
    if (!p) status.fresh++;
    else if (p.dueAt <= now) status.due++;
    else {
      status.resting++;
      if (!status.nextDueAt || p.dueAt < status.nextDueAt) status.nextDueAt = p.dueAt;
    }
  }
  return status;
}

/**
 * Today's session order: due reviews first (most overdue leading), then
 * cards never studied, in deck order — at most `newLimit` of them when a
 * pace is set. Resting cards stay out until due.
 */
export function buildReviewQueue(
  cards: Flashcard[],
  progress: ReadonlyMap<string, CardSchedule>,
  now: number,
  newLimit = Infinity,
): string[] {
  const due = cards
    .filter((c) => {
      const p = progress.get(c.id);
      return p !== undefined && p.dueAt <= now;
    })
    .sort((a, b) => progress.get(a.id)!.dueAt - progress.get(b.id)!.dueAt)
    .map((c) => c.id);
  const fresh = cards.filter((c) => !progress.has(c.id)).map((c) => c.id);
  return [...due, ...fresh.slice(0, newLimit)];
}

/** "tomorrow", "in 3 days", "later today" — for the caught-up state. */
export function describeNextDue(nextDueAt: number, now: number): string {
  if (!nextDueAt) return "";
  if (nextDueAt < startOfLocalDay(now, 1)) return "later today";
  const days = Math.round((startOfLocalDay(nextDueAt) - startOfLocalDay(now)) / DAY_MS);
  if (days <= 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}
