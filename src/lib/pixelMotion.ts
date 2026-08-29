/**
 * Cozy Pixel Motion Library
 * 
 * 16-bit stepped timing curves, 3-tier reduced-motion coordinator,
 * and deterministic pixel particle effect utilities for Comtus.
 */

export type MotionState = "none" | "minimal" | "full";
export type UserMotionPref = "none" | "minimal" | "full" | "system";

/**
 * Generates a CSS stepped timing function string.
 * @param steps Number of discrete steps (minimum 1).
 * @param jumpTerm Stepped jump position identifier.
 */
export function stepEase(
  steps: number,
  jumpTerm: "jump-start" | "jump-end" | "jump-none" | "jump-both" | "start" | "end" = "jump-end"
): string {
  const safeSteps = Math.max(1, Math.round(steps));
  return `steps(${safeSteps}, ${jumpTerm})`;
}

/**
 * Deterministically evaluates a stepped timing function at normalized time t in [0, 1].
 */
export function stepEaseEvaluate(
  t: number,
  steps: number,
  jumpTerm: "jump-start" | "jump-end" | "jump-none" | "jump-both" | "start" | "end" = "jump-end"
): number {
  const clampedT = Math.max(0, Math.min(1, t));
  const n = Math.max(1, Math.round(steps));

  if (clampedT === 0 && (jumpTerm === "jump-end" || jumpTerm === "end" || jumpTerm === "jump-none")) {
    return 0;
  }
  if (clampedT === 1) {
    return 1;
  }

  switch (jumpTerm) {
    case "jump-start":
    case "start":
      return Math.min(1, Math.ceil(clampedT * n) / n);
    case "jump-both": {
      // n + 1 intervals
      return Math.min(1, Math.floor(clampedT * (n + 1)) / n);
    }
    case "jump-none": {
      if (n === 1) return 0;
      return Math.min(1, Math.floor(clampedT * (n - 1)) / (n - 1));
    }
    case "jump-end":
    case "end":
    default:
      return Math.min(1, Math.floor(clampedT * n) / n);
  }
}

export interface SteppedSpringOptions {
  stiffness?: number;
  damping?: number;
  mass?: number;
  steps?: number;
  durationMs?: number;
}

export interface SteppedSpringResult {
  /** Evaluate the stepped spring value at normalized time t [0, 1] */
  evaluate: (t: number) => number;
  /** Generate discrete keyframe samples from t=0 to t=1 */
  keyframes: (samples?: number) => number[];
  /** Recommended CSS stepped animation timing string */
  cssTiming: string;
}

/**
 * Creates a stepped harmonic spring motion curve discretized into n plateaus.
 */
export function springStepped(options: SteppedSpringOptions = {}): SteppedSpringResult {
  const {
    stiffness = 350,
    damping = 32,
    mass = 1,
    steps = 6,
  } = options;

  const safeSteps = Math.max(1, Math.round(steps));
  const safeMass = Math.max(0.001, mass);
  const omega0 = Math.sqrt(stiffness / safeMass);
  const zeta = damping / (2 * Math.sqrt(stiffness * safeMass));

  const evaluateContinuous = (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    // Time scaling: t * 5 settles within [0, 1]
    const tau = t * 5;

    if (zeta < 1) {
      // Underdamped
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const envelope = Math.exp(-zeta * omega0 * tau * 0.4);
      const oscillation = Math.cos(omegaD * tau * 0.4) + ((zeta * omega0) / omegaD) * Math.sin(omegaD * tau * 0.4);
      return 1 - envelope * oscillation;
    } else {
      // Critically damped or overdamped
      const envelope = Math.exp(-omega0 * tau * 0.4);
      return 1 - envelope * (1 + omega0 * tau * 0.4);
    }
  };

  const evaluate = (t: number): number => {
    const raw = evaluateContinuous(t);
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return Math.round(raw * safeSteps) / safeSteps;
  };

  const keyframes = (samples = 12): number[] => {
    const safeCount = Math.max(2, samples);
    const result: number[] = [];
    for (let i = 0; i < safeCount; i++) {
      const t = i / (safeCount - 1);
      result.push(evaluate(t));
    }
    return result;
  };

  return {
    evaluate,
    keyframes,
    cssTiming: stepEase(safeSteps, "jump-end"),
  };
}

/**
 * Checks whether the current environment requests reduced motion.
 * Safe for SSR and headless test runners.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Resolves the effective 3-tier motion state from user preference and OS accessibility setting.
 */
export function resolveMotionState(userPref?: UserMotionPref): MotionState {
  const isReduced = prefersReducedMotion();

  if (userPref === "none") {
    return "none";
  }
  if (userPref === "minimal") {
    return isReduced ? "none" : "minimal";
  }
  if (userPref === "full") {
    return isReduced ? "none" : "full";
  }

  // System or undefined
  return isReduced ? "none" : "full";
}

export interface MotionConfigRules {
  allowParticles: boolean;
  allowContinuousGlow: boolean;
  durationMultiplier: number;
  springDamping: number;
}

/**
 * Returns configuration flags for a given motion state tier.
 */
export function getMotionConfig(state: MotionState): MotionConfigRules {
  switch (state) {
    case "none":
      return {
        allowParticles: false,
        allowContinuousGlow: false,
        durationMultiplier: 0,
        springDamping: 100,
      };
    case "minimal":
      return {
        allowParticles: false,
        allowContinuousGlow: false,
        durationMultiplier: 0.5,
        springDamping: 45,
      };
    case "full":
    default:
      return {
        allowParticles: true,
        allowContinuousGlow: true,
        durationMultiplier: 1,
        springDamping: 32,
      };
  }
}

export interface PixelSparkOptions {
  count?: number;
  container?: HTMLElement;
  speed?: number;
  spread?: number;
  size?: number;
  lifetime?: number;
  color?: string;
  className?: string;
}

export interface PixelSparkParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  element?: HTMLElement;
}

export interface PixelSparkResult {
  particles: PixelSparkParticle[];
  cleanup: () => void;
}

let sparkIdCounter = 0;

/**
 * Spawns crisp, integer-quantized pixel sparks bursting outward from (x, y).
 */
export function spawnPixelSparks(
  x: number,
  y: number,
  color = "#E3B04B",
  options: PixelSparkOptions = {}
): PixelSparkResult {
  const motionState = resolveMotionState();
  if (motionState === "none") {
    return { particles: [], cleanup: () => {} };
  }

  const {
    count = 6,
    speed = 28,
    spread = Math.PI * 2,
    size = 3,
    lifetime = 450,
    className = "pixel-spark-node",
  } = options;

  const targetContainer = options.container ?? (typeof document !== "undefined" ? document.body : undefined);
  const particles: PixelSparkParticle[] = [];
  const elements: HTMLElement[] = [];
  const safeCount = Math.max(1, count);

  for (let i = 0; i < safeCount; i++) {
    sparkIdCounter += 1;
    const angle = (i / safeCount) * spread + (Math.random() - 0.5) * 0.5;
    const velocity = (speed * 0.6) + Math.random() * (speed * 0.8);
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 6; // Slight upward bias

    const particle: PixelSparkParticle = {
      id: sparkIdCounter,
      x: Math.round(x),
      y: Math.round(y),
      vx,
      vy,
      size,
      color,
    };

    if (targetContainer && typeof document !== "undefined") {
      const el = document.createElement("span");
      el.className = className;
      el.setAttribute("aria-hidden", "true");
      el.style.position = "absolute";
      el.style.left = `${particle.x}px`;
      el.style.top = `${particle.y}px`;
      el.style.width = `${particle.size}px`;
      el.style.height = `${particle.size}px`;
      el.style.backgroundColor = particle.color;
      el.style.pointerEvents = "none";
      el.style.zIndex = "9999";
      el.style.transform = "translate(-50%, -50%)";
      el.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.5)`;
      
      targetContainer.appendChild(el);
      particle.element = el;
      elements.push(el);
    }

    particles.push(particle);
  }

  let animationFrameId: number | null = null;
  let isCleanedUp = false;
  const startTime = Date.now();

  const tick = () => {
    if (isCleanedUp) return;
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / lifetime);

    if (progress >= 1) {
      cleanup();
      return;
    }

    particles.forEach((p) => {
      if (!p.element) return;
      // Integer stepped physics position
      const currentX = Math.round(x + p.vx * progress * (lifetime / 100));
      const currentY = Math.round(y + p.vy * progress * (lifetime / 100) + 0.5 * 30 * Math.pow(progress, 2));
      const opacity = Math.max(0, 1 - progress);

      p.element.style.left = `${currentX}px`;
      p.element.style.top = `${currentY}px`;
      p.element.style.opacity = `${opacity}`;
    });

    if (typeof requestAnimationFrame === "function") {
      animationFrameId = requestAnimationFrame(tick);
    }
  };

  if (elements.length > 0 && typeof requestAnimationFrame === "function") {
    animationFrameId = requestAnimationFrame(tick);
  }

  const timeoutId = typeof setTimeout === "function" ? setTimeout(() => {
    cleanup();
  }, lifetime + 50) : null;

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    if (animationFrameId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animationFrameId);
    }
    if (timeoutId !== null && typeof clearTimeout === "function") {
      clearTimeout(timeoutId);
    }
    elements.forEach((el) => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  };

  return { particles, cleanup };
}
