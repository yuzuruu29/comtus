import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Brain, CaretDown } from "@phosphor-icons/react";
import { EFFORTS, effortLabelFor } from "../lib/llm";
import { isTauri } from "../lib/desktop";
import { useSettings } from "../lib/settings";
import type { Effort } from "../lib/types";
import { effortStepsFor, effortToStep, stepFromTrackX, stepToEffort } from "./composerControls";
import { DUR, EXIT, POPOVER, RISE_1, SOFT, SPRING } from "./fx";
import { ICON } from "../ui/iconScale";

/** Whether the model thinks before it answers. Per conversation, so it lives
 *  with the chat rather than in settings; absent when the model can't think. */
export type ReasoningToggle = { enabled: boolean; onChange: (enabled: boolean) => void };

export function ComposerSideRail({
  effort,
  onEffortChange,
  onOpenSettings,
  reasoning,
}: {
  effort: Effort;
  onEffortChange: (effort: Effort) => void;
  onOpenSettings?: () => void;
  reasoning?: ReasoningToggle;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const reduceMotion = !!useReducedMotion();
  const allowExtraDeep = isTauri();
  const steps = effortStepsFor(allowExtraDeep);
  const topStep = steps.length - 1;
  const shownEfforts = allowExtraDeep ? EFFORTS : EFFORTS.filter((item) => item.id !== "xhigh");
  const step = effortToStep(effort, steps);
  const shownEffort = stepToEffort(step, steps);
  const along = `calc(12px + ${step / topStep} * (100% - 24px))`;
  const label = effortLabelFor(shownEffort);
  const active = shownEfforts.find((e) => e.id === shownEffort) ?? shownEfforts[topStep];
  const off = reasoning ? !reasoning.enabled : false;
  const chipText = off ? "Thinking off" : label;

  // Choosing a level is asking for thought, so it also turns thinking back on.
  const pick = useCallback(
    (next: Effort) => {
      onEffortChange(next);
      if (reasoning && !reasoning.enabled) reasoning.onChange(true);
    },
    [onEffortChange, reasoning],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const applyPointer = (target: HTMLElement, clientX: number) => {
    const rect = target.getBoundingClientRect();
    pick(stepToEffort(stepFromTrackX({ clientX, left: rect.left, width: rect.width, steps }), steps));
  };

  const settle = (e?: React.PointerEvent<HTMLElement>) => {
    if (e?.currentTarget && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    dragging.current = false;
    setIsDragging(false);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => {
      dragging.current = false;
      setIsDragging(false);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging]);

  return (
    <div ref={rootRef} className="effort-picker">
      <button
        type="button"
        aria-label="Thinking effort"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="How much the model thinks before answering"
        onClick={() => setOpen((v) => !v)}
        className={`effort-chip ${open ? "is-open" : ""}`}
        data-level={shownEffort}
        data-off={off ? "" : undefined}
      >
        <Brain size={ICON.sm} weight={off ? "regular" : "fill"} className="shrink-0" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={chipText}
            initial={{ y: reduceMotion ? 0 : RISE_1, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduceMotion ? 0 : -RISE_1, opacity: 0 }}
            transition={{ duration: DUR.fast }}
          >
            {chipText}
          </motion.span>
        </AnimatePresence>
        <CaretDown size={ICON.xs} className={`shrink-0 effort-caret ${open ? "is-open" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={POPOVER.initial}
            animate={POPOVER.animate}
            exit={{ ...POPOVER.exit, transition: EXIT }}
            transition={SOFT}
            className="effort-popover"
            role="dialog"
            aria-label="Thinking effort"
            data-level={shownEffort}
          >
            {reasoning && (
              <div className="effort-section effort-switch-row">
                <span id="effort-switch-label">Think before answering</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reasoning.enabled}
                  aria-labelledby="effort-switch-label"
                  className="effort-switch"
                  onClick={() => reasoning.onChange(!reasoning.enabled)}
                >
                  <span className="effort-switch-thumb" />
                </button>
              </div>
            )}

            <div className="effort-section" data-off={off ? "" : undefined}>
              <p className="effort-heading">How hard to think</p>
              <div
                role="slider"
                tabIndex={0}
                aria-label="Thinking effort"
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={topStep}
                aria-valuenow={step}
                aria-valuetext={label}
                className={`effort-track ${isDragging ? "is-dragging" : ""}`}
                data-level={shownEffort}
                onPointerDown={(e) => {
                  dragging.current = true;
                  setIsDragging(true);
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  applyPointer(e.currentTarget, e.clientX);
                }}
                onPointerMove={(e) => {
                  if (!dragging.current) return;
                  applyPointer(e.currentTarget, e.clientX);
                }}
                onPointerUp={settle}
                onPointerCancel={settle}
                onKeyDown={(e) => {
                  const keys: Record<string, Effort> = {
                    Home: "low",
                    "1": "low",
                    "2": "medium",
                    "3": "high",
                    End: steps[topStep],
                    ...(allowExtraDeep ? { "4": "xhigh" as const } : {}),
                  };
                  let next: Effort | undefined = keys[e.key];
                  if (e.key === "ArrowRight" || e.key === "ArrowUp") next = stepToEffort(step + 1, steps);
                  if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = stepToEffort(step - 1, steps);
                  if (!next) return;
                  e.preventDefault();
                  pick(next);
                }}
              >
                <span className="effort-fill" style={{ "--fill": step / topStep } as CSSProperties} />
                {shownEfforts.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    tabIndex={-1}
                    aria-label={item.label}
                    aria-pressed={item.id === shownEffort}
                    className={`effort-dot ${index <= step ? "is-lit" : ""}`}
                    style={{ left: `calc(12px + ${index / topStep} * (100% - 24px))` }}
                    onClick={() => pick(item.id)}
                  />
                ))}
                <span className="effort-thumb" style={{ left: along }}>
                  <span className="effort-thumb-ring" aria-hidden="true" />
                  <motion.span
                    className="effort-thumb-core"
                    animate={isDragging && !reduceMotion ? { scale: 1.15 } : { scale: 1 }}
                    transition={SPRING}
                  />
                </span>
              </div>
              <div className="effort-ticks">
                {shownEfforts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === shownEffort}
                    className="effort-tick"
                    onClick={() => pick(item.id)}
                  >
                    {item.shortLabel}
                  </button>
                ))}
              </div>
              <p className="effort-desc">{off ? "The model answers straight away, without a thinking step." : active.desc}</p>
            </div>

            {onOpenSettings && (
              <div className="effort-section effort-footer">
                <button
                  type="button"
                  className="effort-settings"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings();
                  }}
                >
                  More in Settings
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ComposerSideRailDock({
  onOpenSettings,
  reasoning,
}: {
  onOpenSettings?: () => void;
  reasoning?: ReasoningToggle;
}) {
  const effort = useSettings((s) => s.effort);
  return (
    <ComposerSideRail
      effort={effort}
      onEffortChange={(next) => useSettings.getState().update({ effort: next })}
      onOpenSettings={onOpenSettings}
      reasoning={reasoning}
    />
  );
}
