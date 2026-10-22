import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowCounterClockwise, Pause, Play, SkipForward, Timer } from "@phosphor-icons/react";
import { cueCompad, notifyDeskActivity } from "../lib/activity";
import {
  advancePomodoro,
  FOCUS_LENGTHS,
  formatClock,
  isUnderway,
  loadPomodoro,
  pausePomodoro,
  phaseMs,
  remainingMs,
  resetPomodoro,
  ROUNDS,
  savePomodoro,
  setFocusLength,
  startPomodoro,
  tickPomodoro,
  type PomodoroPhase,
  type PomodoroState,
} from "../lib/pomodoro";
import { useSettings } from "../lib/settings";
import { Button, IconButton, Segmented } from "../ui";
import { ICON } from "../ui/iconScale";
import { playSfx } from "./companion/sfx";
import "./focus-timer.css";

const PHASE_NAME: Record<PomodoroPhase, string> = { focus: "Focus", short: "Short break", long: "Long break" };
const PHASE_NOTE: Record<PomodoroPhase, string> = {
  focus: "One source, one question at a time. A chime marks the rest.",
  short: "Stand, stretch, and look at something far away.",
  long: "Four sessions kept. A longer rest helps it settle.",
};
// Past this, the bell rang while the desk was closed: move on quietly.
const LATE_MS = 60_000;

/** Pomodoro in the notebook header: a ring that empties as the session runs,
 *  four sessions with short rests between and a long rest after the fourth. */
export default function FocusTimer() {
  const sfxOn = useSettings((s) => s.companionSfx !== false);
  const [state, setState] = useState<PomodoroState>(loadPomodoro);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const commit = useCallback((next: PomodoroState) => {
    setState(next);
    savePomodoro(next);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (state.endsAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state.endsAt]);

  useEffect(() => {
    const { state: next, ended } = tickPomodoro(state, now);
    if (!ended) return;
    commit(next);
    if (ended === "focus") notifyDeskActivity();
    setAnnouncement(`${PHASE_NAME[ended]} is over. ${PHASE_NAME[next.phase]} is ready.`);
    if (now - (state.endsAt ?? now) > LATE_MS) return;
    if (ended === "focus") {
      playSfx("unlock", sfxOn);
      cueCompad(next.phase === "long" ? "long-break" : "break");
    } else {
      playSfx("focusResume", sfxOn);
      cueCompad("pause");
    }
  }, [commit, now, sfxOn, state]);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>(".focus-actions .btn")?.focus({ preventScroll: true });
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !rootRef.current?.contains(document.activeElement)) return;
      event.stopPropagation();
      setOpen(false);
      rootRef.current.querySelector<HTMLButtonElement>(".focus-trigger")?.focus();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const running = state.endsAt !== null;
  const underway = isUnderway(state);
  const total = phaseMs(state.phase, state.focusMin);
  const left = remainingMs(state, now);
  const spent = 1 - left / total;
  const clock = formatClock(left);
  const fresh = !running && left === total;

  const toggle = () => {
    if (running) {
      commit(pausePomodoro(state, Date.now()));
      cueCompad("pause");
    } else {
      commit(startPomodoro(state, Date.now()));
      cueCompad(state.phase === "focus" ? "focus" : "pause");
    }
  };

  const action = running ? "Pause" : !fresh ? "Resume" : state.phase === "focus" ? "Start focus" : "Start break";

  return (
    <div ref={rootRef} className="focus-timer no-drag" data-phase={state.phase} data-running={running || undefined}>
      <button
        type="button"
        className="focus-trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={underway ? `Focus timer, ${PHASE_NAME[state.phase]}, ${clock} left${running ? "" : ", paused"}` : "Focus timer"}
        title="Focus timer"
        onClick={() => setOpen((v) => !v)}
      >
        {underway ? (
          <>
            <svg className="focus-mini-ring" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <circle cx="10" cy="10" r="8" className="focus-ring-track" />
              <circle cx="10" cy="10" r="8" pathLength={100} className="focus-ring-arc" style={{ strokeDashoffset: spent * 100 }} />
            </svg>
            <span className="focus-trigger-clock">{clock}</span>
          </>
        ) : (
          <>
            <Timer size={ICON.lg} aria-hidden="true" />
            <span className="focus-trigger-label">Focus</span>
          </>
        )}
      </button>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      {open && (
        <div id={panelId} className="focus-panel glass" role="dialog" aria-modal="false" aria-label="Focus timer">
          <div className="focus-dial">
            <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
              <circle cx="60" cy="60" r="53" className="focus-ring-track" />
              <circle cx="60" cy="60" r="53" pathLength={100} className="focus-ring-arc" style={{ strokeDashoffset: spent * 100 }} />
            </svg>
            <div className="focus-dial-face">
              <span className="focus-dial-phase">{PHASE_NAME[state.phase]}</span>
              <span className="focus-dial-time">{clock}</span>
              <span className="focus-dial-state">{running ? "Running" : fresh ? "Ready" : "Paused"}</span>
            </div>
          </div>

          <ol className="focus-rounds" aria-label={`${state.round} of ${ROUNDS} sessions kept this round`}>
            {Array.from({ length: ROUNDS }, (_, i) => (
              <li
                key={i}
                data-kept={i < state.round || undefined}
                data-current={(state.phase === "focus" && i === state.round) || undefined}
                style={{ ["--i" as string]: i } as CSSProperties}
              />
            ))}
          </ol>

          <p className="focus-note">{PHASE_NOTE[state.phase]}</p>

          <div className="focus-actions">
            <Button
              onClick={toggle}
              icon={running ? <Pause size={ICON.md} weight="fill" aria-hidden="true" /> : <Play size={ICON.md} weight="fill" aria-hidden="true" />}
            >
              {action}
            </Button>
            <IconButton
              aria-label="Restart this session"
              title="Restart this session"
              disabled={fresh}
              onClick={() => {
                commit(resetPomodoro(state));
                if (running) cueCompad("pause");
              }}
            >
              <ArrowCounterClockwise size={ICON.md} aria-hidden="true" />
            </IconButton>
            <IconButton
              aria-label={state.phase === "focus" ? "Skip to the break" : "Skip the break"}
              title={state.phase === "focus" ? "Skip to the break" : "Skip the break"}
              onClick={() => {
                commit(advancePomodoro(state, false));
                cueCompad("pause");
              }}
            >
              <SkipForward size={ICON.md} aria-hidden="true" />
            </IconButton>
          </div>

          <div className="focus-length">
            <span aria-hidden="true">Session length</span>
            <Segmented
              aria-label="Session length"
              value={String(state.focusMin)}
              onChange={(v) => commit(setFocusLength(state, Number(v)))}
              options={FOCUS_LENGTHS.map((mins) => ({ value: String(mins), label: `${mins} min` }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
