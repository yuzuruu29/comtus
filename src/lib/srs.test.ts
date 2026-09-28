import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  RELEARN_MS,
  buildReviewQueue,
  deckStatus,
  describeNextDue,
  formatInterval,
  previewIntervals,
  schedule,
  startOfLocalDay,
  type CardSchedule,
} from "./srs";
import type { Flashcard } from "./types";

/** Local noon keeps midnight-snapping arithmetic readable in any TZ. */
const NOON = new Date(2026, 8, 28, 12, 0, 0).getTime();

const card = (id: string): Flashcard => ({ id, front: `Q ${id}`, back: `A ${id}` });

describe("schedule", () => {
  it("graduates a new card on the fixed ladder", () => {
    expect(schedule(undefined, "hard", NOON).intervalDays).toBe(1);
    expect(schedule(undefined, "good", NOON).intervalDays).toBe(1);
    expect(schedule(undefined, "easy", NOON).intervalDays).toBe(4);
  });

  it("puts a forgotten card on a ten-minute relearn step", () => {
    const next = schedule(undefined, "again", NOON);
    expect(next.intervalDays).toBe(0);
    expect(next.dueAt).toBe(NOON + RELEARN_MS);
    expect(next.reps).toBe(1);
  });

  it("lands graduated intervals on local midnight", () => {
    const next = schedule(undefined, "good", NOON);
    expect(next.dueAt).toBe(startOfLocalDay(NOON, 1));
    expect(new Date(next.dueAt).getHours()).toBe(0);
  });

  it("orders intervals strictly: hard < good < easy", () => {
    const prev: CardSchedule = { ease: 2.5, intervalDays: 3, dueAt: NOON, reps: 2 };
    const hard = schedule(prev, "hard", NOON).intervalDays;
    const good = schedule(prev, "good", NOON).intervalDays;
    const easy = schedule(prev, "easy", NOON).intervalDays;
    expect(hard).toBeGreaterThan(3);
    expect(good).toBeGreaterThan(hard);
    expect(easy).toBeGreaterThan(good);
  });

  it("grows good intervals by the card's ease", () => {
    const prev: CardSchedule = { ease: 2.5, intervalDays: 10, dueAt: NOON, reps: 4 };
    expect(schedule(prev, "good", NOON).intervalDays).toBe(25);
  });

  it("keeps ease within bounds", () => {
    let state: CardSchedule | undefined;
    for (let i = 0; i < 20; i++) state = schedule(state, "again", NOON);
    expect(state!.ease).toBe(1.3);
    for (let i = 0; i < 30; i++) state = schedule(state, "easy", NOON);
    expect(state!.ease).toBe(3.5);
  });

  it("caps intervals at a year", () => {
    const prev: CardSchedule = { ease: 3.5, intervalDays: 300, dueAt: NOON, reps: 12 };
    expect(schedule(prev, "easy", NOON).intervalDays).toBe(365);
  });

  it("counts a lapse only when a graduated card is forgotten", () => {
    const learning = schedule(undefined, "again", NOON);
    expect(learning.lapses).toBe(0);
    const graduated: CardSchedule = { ease: 2.5, intervalDays: 6, dueAt: NOON, reps: 3 };
    expect(schedule(graduated, "again", NOON).lapses).toBe(1);
  });

  it("reads rows written before lapses existed", () => {
    const legacy = { ease: 2.3, intervalDays: 2, dueAt: NOON, reps: 2 };
    const next = schedule(legacy, "good", NOON);
    expect(next.lapses).toBe(0);
    expect(next.reps).toBe(3);
  });

  it("returns a relearning card to the graduation ladder", () => {
    const relearning: CardSchedule = { ease: 2.1, intervalDays: 0, dueAt: NOON, reps: 5, lapses: 1 };
    expect(schedule(relearning, "good", NOON).intervalDays).toBe(1);
  });
});

describe("formatInterval / previewIntervals", () => {
  it("labels minutes, days, weeks, months and years", () => {
    expect(formatInterval({ ease: 2.5, intervalDays: 0, dueAt: NOON + RELEARN_MS, reps: 1 }, NOON)).toBe("10 min");
    expect(formatInterval({ ease: 2.5, intervalDays: 1, dueAt: 0, reps: 1 }, NOON)).toBe("1 day");
    expect(formatInterval({ ease: 2.5, intervalDays: 4, dueAt: 0, reps: 1 }, NOON)).toBe("4 days");
    expect(formatInterval({ ease: 2.5, intervalDays: 21, dueAt: 0, reps: 1 }, NOON)).toBe("3 wk");
    expect(formatInterval({ ease: 2.5, intervalDays: 90, dueAt: 0, reps: 1 }, NOON)).toBe("3 mo");
    expect(formatInterval({ ease: 2.5, intervalDays: 365, dueAt: 0, reps: 1 }, NOON)).toBe("1 yr");
  });

  it("previews every rating for a new card", () => {
    expect(previewIntervals(undefined, NOON)).toEqual({
      again: "10 min",
      hard: "1 day",
      good: "1 day",
      easy: "4 days",
    });
  });
});

describe("review queue", () => {
  const cards = ["a", "b", "c", "d", "e"].map(card);
  const progress = new Map<string, CardSchedule>([
    ["a", { ease: 2.5, intervalDays: 3, dueAt: NOON + 2 * DAY_MS, reps: 2 }], // resting
    ["b", { ease: 2.5, intervalDays: 1, dueAt: NOON - 1000, reps: 1 }], // due, recent
    ["c", { ease: 2.5, intervalDays: 5, dueAt: NOON - 3 * DAY_MS, reps: 3 }], // due, most overdue
  ]);

  it("puts due reviews first, most overdue leading, then new cards", () => {
    expect(buildReviewQueue(cards, progress, NOON)).toEqual(["c", "b", "d", "e"]);
  });

  it("summarises the deck", () => {
    expect(deckStatus(cards, progress, NOON)).toEqual({
      due: 2,
      fresh: 2,
      resting: 1,
      nextDueAt: NOON + 2 * DAY_MS,
    });
  });

  it("is empty when every card is resting", () => {
    const allResting = new Map(cards.map((c) => [c.id, { ease: 2.5, intervalDays: 2, dueAt: NOON + DAY_MS, reps: 1 }]));
    expect(buildReviewQueue(cards, allResting, NOON)).toEqual([]);
  });
});

describe("describeNextDue", () => {
  it("speaks in calendar days", () => {
    expect(describeNextDue(NOON + 60_000, NOON)).toBe("later today");
    expect(describeNextDue(startOfLocalDay(NOON, 1), NOON)).toBe("tomorrow");
    expect(describeNextDue(startOfLocalDay(NOON, 4), NOON)).toBe("in 4 days");
    expect(describeNextDue(startOfLocalDay(NOON, 21), NOON)).toBe("in 3 weeks");
    expect(describeNextDue(0, NOON)).toBe("");
  });
});
