import { useEffect, useRef, useState, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useSettings } from "../lib/settings";

/** Hook to query the user's active motion mode with system fallback. */
export function useMotionMode(): "none" | "minimal" | "full" {
  const mode = useSettings((s) => s.motionMode) ?? "full";
  const reduce = useReducedMotion();
  if (reduce) return "none";
  return mode;
}

/* ── Motion primitives for the studio ────────────────────────
   The 21st.dev-style vocabulary: spring physics everywhere,
   AnimatePresence for enter/exit, mouse-tracked spotlights,
   magnetic buttons, celebration particle emitters, and
   orbiting border beams.
   Everything here respects prefers-reduced-motion. */

/** House springs — one feel across the whole app. */
export const SPRING = { type: "spring", stiffness: 350, damping: 32 } as const;
export const SOFT = { type: "spring", stiffness: 220, damping: 26 } as const;
export const CRISP = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 } as const;
/** Cubic approximation of the house ease, for non-spring tweens. */
export const HOUSE = [0.16, 1, 0.3, 1] as const;

/** Distances for spring/tween keyframes */
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

/** Standard popover travel for AnimatePresence-wrapped menus */
export const POPOVER = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.985 },
} as const;

/** Bound desk pane — flush to the window, split by hairlines. */
export const deskPane = "h-full min-h-0 bg-ground";
export const glassPane = deskPane;

/** Wraps the studio in motion's reduced-motion awareness */
export function MotionPrefs({ children }: { children: ReactNode }) {
  const mode = useMotionMode();
  return (
    <MotionConfig reducedMotion={mode === "none" ? "always" : "user"}>{children}</MotionConfig>
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

/* ── CountUp — numbers land with weight ─────────────────────── */

export function useCountUp(target: number, durationMs = 900): number {
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
      duration: durationMs / 1000,
      ease: HOUSE,
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, durationMs, mode]);
  return value;
}

/* ── Celebration Confetti & Spark Particle Emitter ─────────── */

export function triggerConfettiCannon(originX = 0.5, originY = 0.6) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "pointer-events-none fixed inset-0 z-[999]";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const colors = ["#FFD166", "#E3B04B", "#F7E0A3", "#5CE1E6", "#4EED88", "#FFF8DC"];
  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
    h: number;
    color: string;
    rotation: number;
    vRot: number;
    alpha: number;
  }> = [];

  const count = 48;
  const startX = originX * window.innerWidth;
  const startY = originY * window.innerHeight;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * (180 + (Math.random() * 180 - 90))) / 180;
    const speed = 7 + Math.random() * 12;
    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 14,
      alpha: 1,
    });
  }

  const start = performance.now();

  const draw = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let active = false;
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rotation += p.vRot;
      p.alpha = Math.max(0, 1 - elapsed / 1800);

      if (p.alpha > 0.01) {
        active = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    });

    if (active && elapsed < 2000) {
      requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(draw);
}

/* ── Magnetic Interactive Button (3D spring physics) ───────── */

export function MagneticButton({
  children,
  className = "",
  onClick,
  ...rest
}: HTMLMotionProps<"button">) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    setOffset({ x: x * 0.25, y: y * 0.25 });
  };

  const onMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={btnRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative cursor-pointer transition-colors ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
