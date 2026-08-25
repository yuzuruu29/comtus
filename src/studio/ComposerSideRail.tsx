import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { EFFORTS, effortLabelFor } from "../lib/llm";
import { useSettings } from "../lib/settings";
import type { Effort } from "../lib/types";
import { effortToStep, stepFromTrackX, stepToEffort } from "./composerControls";
import { POPOVER, SOFT } from "./fx";

export function ComposerSideRail({
  effort,
  onEffortChange,
  onOpenSettings,
}: {
  effort: Effort;
  onEffortChange: (effort: Effort) => void;
  onOpenSettings?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const step = effortToStep(effort);
  const along = `calc(9px + ${step / 2} * (100% - 18px))`;
  const fill = `calc(${step / 2} * (100% - 18px))`;
  const label = effortLabelFor(effort);

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

  const applyPointer = useCallback(
    (target: HTMLElement, clientX: number) => {
      const rect = target.getBoundingClientRect();
      onEffortChange(
        stepToEffort(stepFromTrackX({ clientX, left: rect.left, width: rect.width })),
      );
    },
    [onEffortChange],
  );

  return (
    <div ref={rootRef} className="effort-picker">
      <button
        type="button"
        aria-label="Thinking effort"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="How hard the model thinks"
        onClick={() => setOpen((v) => !v)}
        className={`effort-chip ${open ? "is-open" : ""}`}
      >
        <span>{label}</span>
        <CaretDown size={10} className={open ? "rotate-180" : ""} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={POPOVER.initial}
            animate={POPOVER.animate}
            exit={POPOVER.exit}
            transition={SOFT}
            className="effort-popover"
            role="dialog"
            aria-label="Thinking effort"
          >
            <div
              role="slider"
              tabIndex={0}
              aria-label="Thinking effort"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={2}
              aria-valuenow={step}
              aria-valuetext={label}
              className="effort-track"
              onPointerDown={(e) => {
                dragging.current = true;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                applyPointer(e.currentTarget, e.clientX);
              }}
              onPointerMove={(e) => {
                if (!dragging.current) return;
                applyPointer(e.currentTarget, e.clientX);
              }}
              onPointerUp={() => {
                dragging.current = false;
              }}
              onPointerCancel={() => {
                dragging.current = false;
              }}
              onKeyDown={(e) => {
                const current = effortToStep(effort);
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  onEffortChange(stepToEffort(current + 1));
                } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  onEffortChange(stepToEffort(current - 1));
                } else if (e.key === "Home") {
                  e.preventDefault();
                  onEffortChange("medium");
                } else if (e.key === "End") {
                  e.preventDefault();
                  onEffortChange("xhigh");
                }
              }}
            >
              <span className="effort-fill" style={{ width: fill }} />
              {EFFORTS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-pressed={item.id === effort}
                  title={item.label}
                  className={`effort-dot ${index <= step ? "is-lit" : ""}`}
                  style={{ left: `calc(9px + ${index / 2} * (100% - 18px))` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onEffortChange(item.id)}
                />
              ))}
              <span className="effort-thumb" style={{ left: along }} />
            </div>
            {onOpenSettings && (
              <button
                type="button"
                className="effort-advanced"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
              >
                Advanced
                <CaretRight size={11} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ComposerSideRailDock({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}) {
  const effort = useSettings((s) => s.effort);
  return (
    <ComposerSideRail
      effort={effort}
      onEffortChange={(next) => useSettings.getState().update({ effort: next })}
      onOpenSettings={onOpenSettings}
    />
  );
}
