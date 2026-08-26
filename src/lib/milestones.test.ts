import { describe, expect, it } from "vitest";
import {
  dayOffset,
  emptyMilestoneRecord,
  evolveRecord,
  isNightHour,
  kindAccent,
  localDayKey,
  MILESTONES,
  tickActivity,
  type DeskSnapshot,
} from "./milestones";

function snap(partial: Partial<DeskSnapshot> = {}): DeskSnapshot {
  return {
    notebooks: 0,
    sources: 0,
    userMessages: 0,
    generations: 0,
    kinds: {},
    streakDays: 0,
    nightStudy: false,
    ...partial,
  };
}

describe("localDayKey / dayOffset", () => {
  it("formats a local calendar day", () => {
    expect(localDayKey(new Date(2026, 7, 26, 23, 50))).toBe("2026-08-26");
  });

  it("counts whole days between keys", () => {
    expect(dayOffset("2026-08-25", "2026-08-26")).toBe(1);
    expect(dayOffset("2026-08-20", "2026-08-26")).toBe(6);
  });
});

describe("isNightHour", () => {
  it("treats the small hours as night watch", () => {
    expect(isNightHour(0)).toBe(true);
    expect(isNightHour(4)).toBe(true);
    expect(isNightHour(5)).toBe(false);
    expect(isNightHour(23)).toBe(false);
  });
});

describe("tickActivity", () => {
  it("opens a streak on the first visit", () => {
    const next = tickActivity(emptyMilestoneRecord(), new Date(2026, 7, 26, 10));
    expect(next.streakDays).toBe(1);
    expect(next.lastActiveDay).toBe("2026-08-26");
    expect(next.nightStudy).toBe(false);
  });

  it("does not double-count the same day", () => {
    const first = tickActivity(emptyMilestoneRecord(), new Date(2026, 7, 26, 9));
    const second = tickActivity(first, new Date(2026, 7, 26, 21));
    expect(second.streakDays).toBe(1);
  });

  it("increments across consecutive days and resets after a gap", () => {
    const day1 = tickActivity(emptyMilestoneRecord(), new Date(2026, 7, 24, 18));
    const day2 = tickActivity(day1, new Date(2026, 7, 25, 18));
    const day3 = tickActivity(day2, new Date(2026, 7, 26, 18));
    expect(day3.streakDays).toBe(3);
    const gap = tickActivity(day3, new Date(2026, 7, 29, 18));
    expect(gap.streakDays).toBe(1);
  });

  it("remembers a night sitting", () => {
    const next = tickActivity(emptyMilestoneRecord(), new Date(2026, 7, 26, 1, 12));
    expect(next.nightStudy).toBe(true);
  });
});

describe("evolveRecord", () => {
  it("seeds existing work silently on first run", () => {
    const { record, unlocked } = evolveRecord(
      emptyMilestoneRecord(),
      snap({ notebooks: 2, sources: 5 }),
      1,
    );
    expect(record.seeded).toBe(true);
    expect(unlocked).toEqual([]);
    expect(record.unlockedAt["first-desk"]).toBe(1);
    expect(record.unlockedAt["first-source"]).toBe(1);
    expect(record.unlockedAt["five-sources"]).toBe(1);
  });

  it("announces only newly met milestones after seed", () => {
    const seeded = evolveRecord(emptyMilestoneRecord(), snap({ notebooks: 1 }), 1).record;
    const { unlocked, record } = evolveRecord(seeded, snap({ notebooks: 1, sources: 1 }), 2);
    expect(unlocked.map((m) => m.id)).toEqual(["first-source"]);
    expect(record.unlockedAt["first-source"]).toBe(2);
  });

  it("does not re-announce a milestone already held", () => {
    const seeded = evolveRecord(emptyMilestoneRecord(), snap({ notebooks: 1 }), 1).record;
    const again = evolveRecord(seeded, snap({ notebooks: 3 }), 3);
    expect(again.unlocked).toEqual([]);
  });
});

describe("MILESTONES catalog", () => {
  it("covers twelve study-craft marks", () => {
    expect(MILESTONES).toHaveLength(12);
    expect(new Set(MILESTONES.map((m) => m.id)).size).toBe(12);
  });

  it("treats study aids as one family", () => {
    const aid = MILESTONES.find((m) => m.id === "first-aid");
    expect(aid?.met(snap({ kinds: { faq: 1 } }))).toBe(true);
    expect(aid?.met(snap({ kinds: { quiz: 1 } }))).toBe(false);
  });
});

describe("kindAccent", () => {
  it("maps generation kinds onto the Lamplight accents", () => {
    expect(kindAccent("quiz")).toBe("brass");
    expect(kindAccent("exam")).toBe("rust");
    expect(kindAccent("flashcards")).toBe("sage");
    expect(kindAccent("study-guide")).toBe("moon");
  });
});
