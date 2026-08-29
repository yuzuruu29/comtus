import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Brain, CaretDown, CaretRight, Gauge, Lightning } from "@phosphor-icons/react";
import { EFFORTS, effortLabelFor } from "../lib/llm";
import { useSettings } from "../lib/settings";
import type { Effort } from "../lib/types";
import { effortToStep, stepFromTrackX, stepToEffort } from "./composerControls";
import { POPOVER, SOFT, SPRING } from "./fx";

/* Per-level face for chip + caption: Steady strolls, Deep ponders,
   Exhaustive sparks. */
const LEVEL_FACES: Record<Effort, { icon: typeof Brain; tone: string }> = {
  medium: { icon: Gauge, tone: "calm" },
  high: { icon: Brain, tone: "deep" },
  xhigh: { icon: Lightning, tone: "blazing" },
};

type Burst = { key: number; parts: BurstPart[] };
type BurstPart = {
  dx: number;
  dy: number;
  size: number;
  color: string;
  delay: string;
};

function makeBurst(): Burst {
  const colors = ["var(--brass)", "var(--rust)", "var(--brasspale)"];
  const parts = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5);
    const dist = 13 + Math.random() * 13;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 7,
      size: 3 + Math.round(Math.random() * 2),
      color: colors[i % colors.length] ?? "var(--brass)",
      delay: `${Math.round(Math.random() * 50)}ms`,
    };
  });
  return { key: Date.now(), parts };
}

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
  const [isDragging, setIsDragging] = useState(false);
  const [burst, setBurst] = useState<Burst | null>(null);
  const burstTimer = useRef<number | null>(null);
  const prevStep = useRef(effortToStep(effort));
  const reduceMotion = !!useReducedMotion();
  const step = effortToStep(effort);
  const along = `calc(9px + ${step / 2} * (100% - 18px))`;
  const fill = `calc(${step / 2} * (100% - 18px))`;
  const label = effortLabelFor(effort);
  const face = LEVEL_FACES[effort];
  const FaceIcon = face.icon;

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

  useEffect(() => {
    if (step > prevStep.current && !reduceMotion && open) {
      if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
      setBurst(makeBurst());
      burstTimer.current = window.setTimeout(() => {
        setBurst(null);
        burstTimer.current = null;
      }, 620);
    }
    prevStep.current = step;
  }, [step, reduceMotion, open]);

  useEffect(() => {
    return () => {
      if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
    };
  }, []);

  const applyPointer = useCallback(
    (target: HTMLElement, clientX: number) => {
      const rect = target.getBoundingClientRect();
      onEffortChange(
        stepToEffort(stepFromTrackX({ clientX, left: rect.left, width: rect.width })),
      );
    },
    [onEffortChange],
  );

  const settle = () => {
    dragging.current = false;
    setIsDragging(false);
  };

  const slide = reduceMotion ? { duration: 0 } : { duration: 0.18 };

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
        data-level={effort}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            className="effort-chip-face"
            initial={{ y: reduceMotion ? 0 : 7, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduceMotion ? 0 : -7, opacity: 0 }}
            transition={slide}
          >
            <FaceIcon size={11} weight="fill" />
            {label}
          </motion.span>
        </AnimatePresence>
        <CaretDown
          size={10}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
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
            data-level={effort}
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
              className={`effort-track ${isDragging ? "is-dragging" : ""}`}
              data-level={effort}
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
              {burst && (
                <span
                  key={burst.key}
                  className="effort-sparks"
                  style={{ left: along }}
                  aria-hidden="true"
                >
                  {burst.parts.map((part, i) => (
                    <span
                      key={i}
                      className="effort-spark"
                      style={
                        {
                          width: part.size,
                          height: part.size,
                          background: part.color,
                          animationDelay: part.delay,
                          "--dx": `${part.dx.toFixed(1)}px`,
                          "--dy": `${part.dy.toFixed(1)}px`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </span>
              )}
              <span className="effort-thumb" style={{ left: along }}>
                <span className="effort-thumb-ring" aria-hidden="true" />
                <motion.span
                  className="effort-thumb-core"
                  animate={
                    isDragging && !reduceMotion
                      ? { scaleX: 1.4, scaleY: 0.68 }
                      : { scaleX: 1, scaleY: 1 }
                  }
                  transition={SPRING}
                />
              </span>
            </div>
            <div className={`effort-level effort-level-${face.tone}`} aria-hidden="true">
              <FaceIcon size={12} weight="fill" className="effort-level-icon" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={label}
                  className="effort-level-text"
                  initial={{ y: reduceMotion ? 0 : 9, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: reduceMotion ? 0 : -9, opacity: 0 }}
                  transition={slide}
                >
                  {label}
                </motion.span>
              </AnimatePresence>
              <span className="effort-bars">
                {[0, 1, 2].map((bar) => (
                  <span
                    key={bar}
                    className={`effort-bar ${bar <= step ? "is-active" : ""}`}
                  />
                ))}
              </span>
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
