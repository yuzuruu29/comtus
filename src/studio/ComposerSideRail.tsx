import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Brain, CaretDown, Gauge, Lightning, Sparkle } from "@phosphor-icons/react";
import { EFFORTS, effortLabelFor } from "../lib/llm";
import { useSettings } from "../lib/settings";
import type { Effort } from "../lib/types";
import { effortToStep, stepFromTrackX, stepToEffort } from "./composerControls";
import { DUR, EXIT, POPOVER, RISE_2, SOFT, SPRING } from "./fx";
import { ICON } from "../ui/iconScale";

/* Per-level metadata for chip, preview card, and indicators. */
const LEVEL_FACES: Record<
  Effort,
  { icon: typeof Brain; tone: string; title: string; accentClass: string }
> = {
  low: {
    icon: Gauge,
    tone: "fast",
    title: "Light & Quick",
    accentClass: "text-sage border-sage/30 bg-sage/10",
  },
  medium: {
    icon: Brain,
    tone: "calm",
    title: "Balanced Thinking",
    accentClass: "text-moon border-moon/30 bg-moon/10",
  },
  high: {
    icon: Sparkle,
    tone: "deep",
    title: "Deep Reasoning",
    accentClass: "text-brass border-brass/30 bg-brass/10",
  },
  xhigh: {
    icon: Lightning,
    tone: "blazing",
    title: "Maximum Compute",
    accentClass: "text-rust border-rust/30 bg-rust/10",
  },
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
  const colors = ["var(--brass)", "var(--rust)", "var(--brass-pale)"];
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
  const along = `calc(12px + ${step / 3} * (100% - 24px))`;
  const fill = step / 3;
  const label = effortLabelFor(effort);
  const face = LEVEL_FACES[effort] ?? LEVEL_FACES.high;
  const FaceIcon = face.icon;
  const activeOption = EFFORTS.find((e) => e.id === effort) ?? EFFORTS[2];

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

  const slide = reduceMotion ? { duration: 0 } : { duration: DUR.fast };

  return (
    <div ref={rootRef} className="effort-picker">
      <button
        type="button"
        aria-label="Thinking effort"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Reasoning effort: Control how deeply the model thinks before answering"
        onClick={() => setOpen((v) => !v)}
        className={`effort-chip ${open ? "is-open" : ""}`}
        data-level={effort}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            className="effort-chip-face"
            initial={{ y: reduceMotion ? 0 : RISE_2, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduceMotion ? 0 : -RISE_2, opacity: 0 }}
            transition={slide}
          >
            <FaceIcon size={ICON.xs} weight="fill" className="shrink-0 text-brass" />
            <span className="hidden xs:inline">Think: {label}</span>
            <span className="xs:hidden">{label}</span>
          </motion.span>
        </AnimatePresence>
        <CaretDown
          size={ICON.xs}
          className={`transition-transform duration-med ${open ? "rotate-180" : ""}`}
        />
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
            data-level={effort}
          >
            {/* Header: Title + Active Badge */}
            <div className="flex items-center justify-between border-b border-hairline px-3.5 py-2.5">
              <div className="flex items-center gap-1.5">
                <Brain size={ICON.sm} weight="fill" className="text-brass" />
                <span className="font-mono text-[11px] font-semibold tracking-wide text-ink">
                  Reasoning effort
                </span>
              </div>
              <span
                className={`font-mono text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-pill)] border ${face.accentClass}`}
              >
                {activeOption.badge}
              </span>
            </div>

            <div className="px-3.5 pt-2.5 pb-1 text-[11.5px] text-muted">
              Choose how deeply the model thinks before answering.
            </div>

            {/* Slider track */}
            <div className="px-3.5 py-2.5">
              <div
                role="slider"
                tabIndex={0}
                aria-label="Thinking effort"
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={3}
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
                  } else if (e.key === "Home" || e.key === "1") {
                    e.preventDefault();
                    onEffortChange("low");
                  } else if (e.key === "2") {
                    e.preventDefault();
                    onEffortChange("medium");
                  } else if (e.key === "3") {
                    e.preventDefault();
                    onEffortChange("high");
                  } else if (e.key === "End" || e.key === "4") {
                    e.preventDefault();
                    onEffortChange("xhigh");
                  }
                }}
              >
                <span className="effort-fill" style={{ "--fill": fill } as CSSProperties} />
                {EFFORTS.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    aria-pressed={item.id === effort}
                    title={item.label}
                    className={`effort-dot ${index <= step ? "is-lit" : ""}`}
                    style={{ left: `calc(12px + ${index / 3} * (100% - 24px))` }}
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
                        ? { scaleX: 1.35, scaleY: 0.72 }
                        : { scaleX: 1, scaleY: 1 }
                    }
                    transition={SPRING}
                  />
                </span>
              </div>

              {/* Tick labels underneath track */}
              <div className="flex items-center justify-between px-0.5 pt-1.5">
                {EFFORTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onEffortChange(item.id)}
                    className={`font-mono text-[10px] tracking-wide transition-colors cursor-pointer ${
                      item.id === effort
                        ? "font-semibold text-brass"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {item.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Tier Info Card */}
            <div className="mx-3.5 mb-2.5 rounded-[var(--radius-dialog)] border border-hairline bg-ground/80 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-medium text-[12px] text-ink">
                  <FaceIcon size={ICON.sm} weight="fill" className="text-brass" />
                  <span>{face.title}</span>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
                  {step + 1} of 4
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                {activeOption.desc}
              </p>
            </div>

            {/* Quick 1-click pills */}
            <div className="flex items-center gap-1 px-3.5 pb-2">
              {EFFORTS.map((item) => {
                const active = item.id === effort;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onEffortChange(item.id)}
                    className={`flex-1 rounded-[var(--radius-field)] border py-1 font-mono text-[10px] uppercase tracking-wider transition-all active:scale-[0.96] cursor-pointer ${
                      active
                        ? "border-brass/60 bg-brass/20 text-brass font-semibold shadow-[0_0_8px_rgba(227,176,75,0.2)]"
                        : "border-hairline bg-ground/40 text-muted hover:border-brass/30 hover:text-ink"
                    }`}
                  >
                    {item.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-hairline px-3.5 py-2 flex items-center justify-between">
              <span className="font-mono text-[9px] text-muted uppercase tracking-widest">
                Arrow keys / 1-4
              </span>
              {onOpenSettings && (
                <button
                  type="button"
                  className="font-mono text-[10px] text-brass hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings();
                  }}
                >
                  Settings
                </button>
              )}
            </div>
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
