import { useEffect, useRef, useState, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion } from "motion/react";

/* ── Motion primitives for the studio ────────────────────────
   The 21st.dev-style vocabulary: spring physics everywhere,
   AnimatePresence for enter/exit, mouse-tracked spotlights and
   orbiting border beams for the expensive-feeling details.
   Everything here respects prefers-reduced-motion. */

/** House springs — one feel across the whole app. */
export const SPRING = { type: "spring", stiffness: 380, damping: 34 } as const;
export const SOFT = { type: "spring", stiffness: 240, damping: 26 } as const;
/** Cubic approximation of the house ease, for non-spring tweens. */
export const HOUSE = [0.22, 1, 0.36, 1] as const;

/** Distances for spring/tween keyframes — mirror --rise-* / --drift-x in
 *  index.css. motion/react cannot interpolate var()/calc() strings, so
 *  TSX reads these numbers; the CSS tokens serve CSS-declared animation. */
export const RISE_1 = 4;
export const RISE_2 = 8;
export const RISE_3 = 14;
export const DRIFT_X = 12;

/** House stagger — mirrors `--stagger-step` / the 10-item cap in BRAND.md §5. */
export const STAGGER_STEP_MS = 30;
export const STAGGER_CAP = 10;

/** Inline `--d` for `.anim-rise` / `.chip-in`. Caps at 10 items (300ms). */
export function staggerDelay(index: number): string {
  return `${Math.min(Math.max(index, 0), STAGGER_CAP) * STAGGER_STEP_MS}ms`;
}

/** BorderBeam orbit tempo, seconds — idle vs streaming. */
export const BEAM_IDLE_S = 5;
export const BEAM_STREAM_S = 3.4;

/** Standard popover travel for AnimatePresence-wrapped menus (model picker,
 *  effort picker, sessions, focus menu). Spread onto a motion element:
 *  <motion.div {...POPOVER.initial} animate={POPOVER.animate} exit={POPOVER.exit}> */
export const POPOVER = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.985 },
} as const;

/** Bound desk pane — flush to the window, split by hairlines. */
export const deskPane = "h-full min-h-0 bg-ground";
/** @deprecated Use deskPane. Kept so older imports fail loudly in typecheck. */
export const glassPane = deskPane;

/** Wraps the studio in motion's reduced-motion awareness so every
 *  spring/tween collapses to an instant state change when asked. */
export function MotionPrefs({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>{children}</MotionConfig>
  );
}

/* ── Spotlight — a lamp of light follows the cursor ────────── */

export function Spotlight({
  children,
  className = "",
  radius = 260,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
} & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: MouseEvent) => {
    // Only track cursor on fine hover-capable pointers
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} {...rest} onMouseMove={onMove} className={`spotlight group relative ${className}`}>
      <div
        aria-hidden
        className="spotlight-glow pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ ["--sr" as string]: `${radius}px` }}
      />
      <div className="relative z-[1] h-full">{children}</div>
    </div>
  );
}

/* ── Border beam — light orbits the edge of a card ─────────── */

export function BorderBeam({
  size = 90,
  duration = 7,
  delay = 0,
  reverse = false,
  colorFrom = "rgba(227,176,75,0.85)",
  colorTo = "rgba(127,168,201,0.4)",
}: {
  size?: number;
  duration?: number;
  delay?: number;
  reverse?: boolean;
  colorFrom?: string;
  colorTo?: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-[1.5px] border-transparent overflow-hidden [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
    >
      <motion.div
        className="absolute aspect-square"
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            background: `linear-gradient(to left, ${colorFrom}, transparent 55%, ${colorTo})`,
          } as React.CSSProperties
        }
        initial={{ offsetDistance: reverse ? "100%" : "0%" }}
        animate={{ offsetDistance: reverse ? ["100%", "0%"] : ["0%", "100%"] }}
        transition={{ repeat: Infinity, ease: "linear", duration, delay: -delay }}
      />
    </div>
  );
}

/* ── Collapse — height-animated reveal (0 ↔ auto) ──────────── */

export function Collapse({
  open,
  children,
  className = "",
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.36, ease: HOUSE }}
          className={`overflow-hidden ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── CountUp — numbers land with weight, not instantly ─────── */

export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const reduce = useReducedMotion();
  // Seed each sweep from wherever the last one ended — meters refresh
  // periodically and replaying 0→X on every refresh reads as a glitch.
  // The first mount still sweeps from 0 so entrances keep their weight.
  const lastRef = useRef(0);
  useEffect(() => {
    const from = lastRef.current;
    lastRef.current = target;
    if (reduce || from === target) {
      setValue(target);
      return;
    }
    const controls = animate(from, target, {
      duration: durationMs / 1000,
      ease: HOUSE,
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, durationMs, reduce]);
  return value;
}
