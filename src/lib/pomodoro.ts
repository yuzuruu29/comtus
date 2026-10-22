/** A pomodoro cycle as plain data: four focus sessions with short rests
 *  between and a long rest after the fourth. The clock is a deadline, not a
 *  counter, so a throttled background tab or a reload keeps true time. */

export type PomodoroPhase = "focus" | "short" | "long";

export interface PomodoroState {
  phase: PomodoroPhase;
  focusMin: number;
  /** Focus sessions finished in the current cycle, 0 to ROUNDS. */
  round: number;
  /** Set while the clock runs. */
  endsAt: number | null;
  /** Time left while paused. */
  leftMs: number;
  /** Focus sessions finished, ever. Milestones read this. */
  kept: number;
}

export const FOCUS_LENGTHS = [15, 25, 50] as const;
export const ROUNDS = 4;
const BREAK_MIN: Record<Exclude<PomodoroPhase, "focus">, number> = { short: 5, long: 15 };
export const POMODORO_STORAGE_KEY = "comtus-pomodoro";

export function phaseMs(phase: PomodoroPhase, focusMin: number): number {
  return (phase === "focus" ? focusMin : BREAK_MIN[phase]) * 60_000;
}

export function initialPomodoro(focusMin = 25, kept = 0): PomodoroState {
  return { phase: "focus", focusMin, round: 0, endsAt: null, leftMs: phaseMs("focus", focusMin), kept };
}

export function remainingMs(s: PomodoroState, now: number): number {
  return s.endsAt === null ? s.leftMs : Math.max(0, s.endsAt - now);
}

/** Started, and not yet back at the top of a fresh focus session. */
export function isUnderway(s: PomodoroState): boolean {
  return s.endsAt !== null || s.phase !== "focus" || s.round > 0 || s.leftMs !== phaseMs("focus", s.focusMin);
}

export function startPomodoro(s: PomodoroState, now: number): PomodoroState {
  return s.endsAt === null ? { ...s, endsAt: now + s.leftMs } : s;
}

export function pausePomodoro(s: PomodoroState, now: number): PomodoroState {
  return s.endsAt === null ? s : { ...s, endsAt: null, leftMs: remainingMs(s, now) };
}

/** Back to the top of the current phase. */
export function resetPomodoro(s: PomodoroState): PomodoroState {
  return { ...s, endsAt: null, leftMs: phaseMs(s.phase, s.focusMin) };
}

/** A new length only rewinds a focus session that has not started. */
export function setFocusLength(s: PomodoroState, focusMin: number): PomodoroState {
  const fresh = s.phase === "focus" && s.endsAt === null && s.leftMs === phaseMs("focus", s.focusMin);
  return { ...s, focusMin, leftMs: fresh ? phaseMs("focus", focusMin) : s.leftMs };
}

/** The next phase, waiting for the student to start it. */
export function advancePomodoro(s: PomodoroState, completed: boolean): PomodoroState {
  if (s.phase === "focus") {
    const round = Math.min(ROUNDS, s.round + 1);
    const phase = round >= ROUNDS ? "long" : "short";
    return { ...s, phase, round, endsAt: null, leftMs: phaseMs(phase, s.focusMin), kept: s.kept + (completed ? 1 : 0) };
  }
  const round = s.phase === "long" ? 0 : s.round;
  return { ...s, phase: "focus", round, endsAt: null, leftMs: phaseMs("focus", s.focusMin) };
}

/** Moves past a phase whose deadline has passed and names the phase that ended. */
export function tickPomodoro(s: PomodoroState, now: number): { state: PomodoroState; ended: PomodoroPhase | null } {
  if (s.endsAt === null || now < s.endsAt) return { state: s, ended: null };
  return { state: advancePomodoro(s, true), ended: s.phase };
}

export function loadPomodoro(): PomodoroState {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(POMODORO_STORAGE_KEY);
    if (!raw) return initialPomodoro();
    const p = JSON.parse(raw) as Partial<PomodoroState>;
    const focusMin = FOCUS_LENGTHS.includes(p.focusMin as never) ? Number(p.focusMin) : 25;
    const phase: PomodoroPhase = p.phase === "short" || p.phase === "long" ? p.phase : "focus";
    const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback);
    return {
      phase,
      focusMin,
      round: Math.min(ROUNDS, Math.floor(num(p.round, 0))),
      endsAt: typeof p.endsAt === "number" && Number.isFinite(p.endsAt) ? p.endsAt : null,
      leftMs: Math.min(num(p.leftMs, phaseMs(phase, focusMin)), phaseMs(phase, focusMin)),
      kept: Math.floor(num(p.kept, 0)),
    };
  } catch {
    return initialPomodoro();
  }
}

export function savePomodoro(s: PomodoroState): void {
  try {
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private windows can refuse storage; the clock still runs this session.
  }
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
