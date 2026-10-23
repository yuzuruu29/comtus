import { useEffect, useRef, useState, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion } from "motion/react";
import { useSettings } from "../lib/settings";

/** Hook to query the user's active motion mode with system fallback. */
export function useMotionMode(): "none" | "minimal" | "full" {
  const mode = useSettings((s) => s.motionMode) ?? "full";
  const reduce = useReducedMotion();
  if (reduce) return "none";
  return mode;
}

/* ── Motion primitives for the studio ────────────────────────
   One feel across the whole app: tweened entrances, spring presses,
   AnimatePresence for enter/exit, and a three-tier motion budget
   the user controls (full / minimal / none).
   Everything here respects prefers-reduced-motion. */

/** House springs — one feel across the whole app.
 *  BRAND.md 5 forbids bounce, so these are critically damped: the damping
 *  ratio zeta = damping / (2 * sqrt(stiffness * mass)) is 1 or just above.
 *  A zeta below 1 overshoots, and a desk should not spring at someone at 2am. */
export const SPRING = { type: "spring", stiffness: 256, damping: 32, mass: 1 } as const;
export const CRISP = { type: "spring", stiffness: 420, damping: 37, mass: 0.8 } as const;
/** Cubic approximation of the house ease, for non-spring tweens. */
export const HOUSE = [0.16, 1, 0.3, 1] as const;

/** The CSS motion ladder, in seconds, for the motion/react layer.
 *  Mirrors --dur-fast / --dur-med / --dur-slow / --dur-glow / --dur-settle
 *  in src/styles/tokens.css so both layers move at the same speed. */
export const DUR = {
  fast: 0.12,
  med: 0.22,
  slow: 0.36,
  glow: 0.48,
  settle: 0.7,
} as const;

/** A tween, not a spring: springs overshoot, and BRAND.md 5 forbids bounce. */
export const SOFT = { type: "tween", duration: DUR.med, ease: HOUSE } as const;

/** The house close: the same curve, one rung faster than the open.
 *  A panel that took 220ms to arrive should be gone before the reader
 *  looks away, so exits ride the fast rung. */
export const EXIT = { duration: DUR.fast, ease: HOUSE } as const;

/** Distances for spring/tween keyframes */
export const RISE_1 = 4;
export const RISE_2 = 8;
export const RISE_3 = 14;
export const DRIFT_X = 12;

/** House entrance: fade, and a short rise. No scale — a scaling popover is
 *  a generated-UI tell, and the brand's entrances fade and lift. */
export const ENTER = {
  initial: { opacity: 0, y: RISE_2 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -RISE_1 },
} as const;

/** Standard popover travel for AnimatePresence-wrapped menus */
export const POPOVER = {
  initial: { opacity: 0, y: -RISE_1 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
} as const;

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

/** Bound desk pane — flush to the window, split by hairlines. */
export const deskPane = "h-full min-h-0 bg-transparent";
export const glassPane = deskPane;

/** The user's motion preference, mirrored onto the document root so CSS can
 *  read it. "minimal" and "none" are the user's own choices; the OS
 *  preference collapses to "none" (see useMotionMode). */
export function useMotionEffect(mode: "none" | "minimal" | "full") {
  useEffect(() => {
    document.documentElement.dataset.motion = mode;
  }, [mode]);
}

/** Wraps the app in motion's reduced-motion awareness.
 *  "full" keeps the house vocabulary and still honours the OS setting.
 *  "minimal" and "none" strip transforms and scale: motion's "always" mode
 *  leaves opacity alone, so a fade still reads, while nothing travels. */
export function MotionPrefs({ children }: { children: ReactNode }) {
  const mode = useMotionMode();
  useMotionEffect(mode);
  return (
    <MotionConfig
      reducedMotion={mode === "full" ? "user" : "always"}
      transition={mode === "none" ? { duration: 0 } : undefined}
    >
      {children}
    </MotionConfig>
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
        className="spotlight-glow pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-0 transition-opacity duration-glow group-hover:opacity-100"
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
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-[1.5px] border-transparent overflow-hidden [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(black,black)]"
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
          transition={{ duration: DUR.slow, ease: HOUSE }}
          className={`overflow-hidden ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── CountUp — numbers land with weight ─────────────────────── */

/** CountUp — numbers land with weight. The climb rides the settle rung:
 *  a score arriving is a long settle, not a fade. */
export function useCountUp(target: number, durationS = DUR.settle): number {
  const [value, setValue] = useState(0);
  const mode = useMotionMode();
  const lastRef = useRef(0);
  useEffect(() => {
    const from = lastRef.current;
    lastRef.current = target;
    if (mode === "none" || from === target) {
      setValue(target);
      return;
    }
    const controls = animate(from, target, {
      duration: durationS,
      ease: HOUSE,
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, durationS, mode]);
  return value;
}
