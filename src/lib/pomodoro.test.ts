import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  advancePomodoro,
  formatClock,
  initialPomodoro,
  isUnderway,
  loadPomodoro,
  pausePomodoro,
  phaseMs,
  POMODORO_STORAGE_KEY,
  remainingMs,
  savePomodoro,
  setFocusLength,
  startPomodoro,
  tickPomodoro,
} from "./pomodoro";

const MIN = 60_000;

describe("pomodoro", () => {
  // Lib tests run in node; a Map stands in for the browser's storage.
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps true time from a deadline and pauses where it stopped", () => {
    let s = startPomodoro(initialPomodoro(25), 0);
    expect(remainingMs(s, 10 * MIN)).toBe(15 * MIN);
    s = pausePomodoro(s, 10 * MIN);
    expect(remainingMs(s, 99 * MIN)).toBe(15 * MIN);
    s = startPomodoro(s, 100 * MIN);
    expect(remainingMs(s, 105 * MIN)).toBe(10 * MIN);
  });

  it("runs four focus sessions with short rests, then one long rest", () => {
    let s = initialPomodoro(25);
    const phases: string[] = [];
    let now = 0;
    for (let i = 0; i < 9; i++) {
      s = startPomodoro(s, now);
      now += phaseMs(s.phase, s.focusMin);
      expect(tickPomodoro(s, now - 1).ended).toBeNull();
      const { state, ended } = tickPomodoro(s, now);
      phases.push(ended!);
      s = state;
    }
    expect(phases).toEqual(["focus", "short", "focus", "short", "focus", "short", "focus", "long", "focus"]);
    expect(s.phase).toBe("short");
    expect(s.round).toBe(1);
    expect(s.kept).toBe(5);
  });

  it("counts only sessions that ran to the bell", () => {
    expect(advancePomodoro(initialPomodoro(), false).kept).toBe(0);
    expect(advancePomodoro(initialPomodoro(), true).kept).toBe(1);
  });

  it("changes length only before a session starts", () => {
    expect(setFocusLength(initialPomodoro(25), 50).leftMs).toBe(50 * MIN);
    const running = startPomodoro(initialPomodoro(25), 0);
    expect(setFocusLength(running, 50).leftMs).toBe(25 * MIN);
    expect(isUnderway(initialPomodoro(25))).toBe(false);
    expect(isUnderway(running)).toBe(true);
  });

  it("restores a saved clock and repairs a bad one", () => {
    const s = startPomodoro(initialPomodoro(50, 3), 1000);
    savePomodoro(s);
    expect(loadPomodoro()).toEqual(s);
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify({ phase: "nap", focusMin: 7, leftMs: -4, kept: "x" }));
    expect(loadPomodoro()).toEqual(initialPomodoro(25));
  });

  it("formats the clock rounding up to the whole second", () => {
    expect(formatClock(25 * MIN)).toBe("25:00");
    expect(formatClock(61_001)).toBe("01:02");
    expect(formatClock(0)).toBe("00:00");
  });
});
