import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Sparkles, Moon, Sun, BrainCircuit, RotateCcw } from "lucide-react";
import { PixelSprite } from "./PixelSprite";
import {
  COZY_PIXEL_LAMP_ANIMATIONS,
  LAMP_HEIGHT,
  LAMP_WIDTH,
} from "./pixelLampFrames";
import { playSfx as playEngineSfx } from "../../lib/soundEngine";

export type LampAnimationMood = "idle" | "think" | "poke" | "sleep";

export interface LampPosition {
  left: number;
  top: number;
}

/** Axis-aligned rectangle in viewport coordinates, for keep-out zones. */
export interface LampAvoidRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PixelLampCompanionProps {
  /** Initial mood state */
  initialMood?: LampAnimationMood;
  /** Controlled mood state */
  mood?: LampAnimationMood;
  /** Callback fired on mood transition */
  onMoodChange?: (mood: LampAnimationMood) => void;
  /** Interactive poke callback */
  onPoke?: () => void;
  /** Sound trigger hook seam ready for Phase 4 audio orchestration */
  onPlaySfx?: (sfxName: string) => void;
  /** Idle duration before transitioning to sleep. Defaults to 4 minutes (240,000 ms) */
  idleTimeoutMs?: number;
  /** LocalStorage key for persisting coordinates. Defaults to 'comtus:lamp_pos' */
  storageKey?: string;
  /** Display size in pixels */
  size?: number;
  /** Scale factor for the 36x38 sprite grid */
  scale?: number;
  /** Custom speech bubble / status text */
  speech?: string | null;
  /** Enable interactive floating action controls / mood switcher */
  showControls?: boolean;
  /** Fixed initial resting offset from bottom-right */
  restingOffset?: { right: number; bottom: number };
  /** Keep-out zones (dock, composer) measured fresh on every placement */
  avoidRects?: () => Array<LampAvoidRect | null>;
  /** Desk-busy signal: holds the lamp in its quiet "think" state while true */
  think?: boolean;
  /** Slight facing bias toward the pane the desk last touched — a glance, not a head-turn */
  face?: "left" | "right" | null;
  /** Additional CSS class names */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
}

export const COMTUS_LAMP_POS_KEY = "comtus:lamp_pos";
export const FOUR_MINUTES_MS = 4 * 60 * 1000;
const DRAG_THRESHOLD_PX = 6;

/** Clamps position inside viewport bounds */
export function clampCoordinates(
  pos: LampPosition,
  dimensions: { width: number; height: number },
  viewport: { width: number; height: number },
  padding = 12,
): LampPosition {
  const maxLeft = Math.max(padding, viewport.width - dimensions.width - padding);
  const maxTop = Math.max(padding, viewport.height - dimensions.height - padding);
  return {
    left: Math.min(maxLeft, Math.max(padding, pos.left)),
    top: Math.min(maxTop, Math.max(padding, pos.top)),
  };
}

function rectsIntersect(
  pos: LampPosition,
  dimensions: { width: number; height: number },
  rect: LampAvoidRect,
): boolean {
  return (
    pos.left < rect.right &&
    pos.left + dimensions.width > rect.left &&
    pos.top < rect.bottom &&
    pos.top + dimensions.height > rect.top
  );
}

/**
 * Pushes the lamp out of keep-out zones (dock, composer) so it never
 * covers a tool. Tries the left side first — the desk reads left-to-right —
 * then the right, above, and below. Pure, so tests can drive it.
 */
export function nudgeOutOfRects(
  pos: LampPosition,
  dimensions: { width: number; height: number },
  rects: LampAvoidRect[],
  viewport: { width: number; height: number },
  padding = 12,
): LampPosition {
  let next = { ...pos };
  for (const rect of rects) {
    if (!rectsIntersect(next, dimensions, rect)) continue;
    const gap = 8;
    const candidates: LampPosition[] = [
      { left: rect.left - dimensions.width - gap, top: next.top },
      { left: rect.right + gap, top: next.top },
      { left: next.left, top: rect.top - dimensions.height - gap },
      { left: next.left, top: rect.bottom + gap },
    ];
    const clear = candidates.find((c) => !rects.some((r) => rectsIntersect(c, dimensions, r)));
    next = clear ?? next;
  }
  return clampCoordinates(next, dimensions, viewport, padding);
}

/** Computes default bottom-right resting position */
export function computeBottomRightRestingPos(
  dimensions: { width: number; height: number },
  viewport: { width: number; height: number },
  offset = { right: 28, bottom: 28 },
): LampPosition {
  return {
    left: Math.max(12, viewport.width - dimensions.width - offset.right),
    top: Math.max(12, viewport.height - dimensions.height - offset.bottom),
  };
}

/** Safely reads saved coordinates from localStorage */
export function loadSavedLampPos(key: string = COMTUS_LAMP_POS_KEY): LampPosition | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.left === "number" && typeof parsed.top === "number") {
      if (Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
        return { left: parsed.left, top: parsed.top };
      }
    }
  } catch {
    /* Ignore quota / parse error */
  }
  return null;
}

/** Safely persists coordinates to localStorage */
export function persistLampPos(pos: LampPosition | null, key: string = COMTUS_LAMP_POS_KEY): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    if (!pos) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(pos));
    }
  } catch {
    /* Ignore quota / private window restrictions */
  }
}

/**
 * PixelLampCompanion
 *
 * Hand-crafted 16-bit Cozy Pixel Lamp desk companion.
 * Features:
 * - 16-bit Cozy Pixel Lamp sprite (warm brass dome shade, glowing filament core, soft dithered cone of light)
 * - State machine: idle (stepped breathe / filament flicker), think (quiet
 *   spark-in-shade), poke (small nod + brass chime, no sparks), sleep (dimmed + zZz)
 * - Draggable placement with mouse/touch drag and localStorage persistence (`comtus:lamp_pos`)
 * - Double-click to return to resting bottom-right position
 * - Keep-out zones (`avoidRects`) keep it off the dock and the composer
 * - Inactivity detector that lulls the lamp to sleep after 4 minutes
 * - Lamp voices only, via the shared sound engine (lampChime / inkPress)
 */
export function PixelLampCompanion({
  initialMood = "idle",
  mood: controlledMood,
  onMoodChange,
  onPoke,
  onPlaySfx,
  idleTimeoutMs = FOUR_MINUTES_MS,
  storageKey = COMTUS_LAMP_POS_KEY,
  size = 112,
  scale = 3,
  speech,
  showControls = true,
  restingOffset = { right: 28, bottom: 28 },
  avoidRects,
  think,
  face,
  className = "",
  style = {},
}: PixelLampCompanionProps) {
  const containerId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Internal active mood state
  const [internalMood, setInternalMood] = useState<LampAnimationMood>(initialMood);
  const activeMood = controlledMood ?? internalMood;

  // Effective companion dimensions
  const companionWidth = size;
  const companionHeight = Math.round((size * LAMP_HEIGHT) / LAMP_WIDTH);

  // Keep-out zones are read through a ref so drag handlers stay fresh
  // without re-binding pointer listeners.
  const avoidRectsRef = useRef(avoidRects);
  avoidRectsRef.current = avoidRects;

  const collectAvoidRects = useCallback((): LampAvoidRect[] => {
    const rects = avoidRectsRef.current?.() ?? [];
    return rects.filter((r): r is LampAvoidRect => r !== null);
  }, []);

  // Sound trigger — the lamp speaks only in lamp voices (brass chime,
  // ink press) through the sound engine. Think and wake are silent.
  const triggerSfx = useCallback(
    (sfxName: string) => {
      onPlaySfx?.(sfxName);
      try {
        if (sfxName === "lampClick" || sfxName === "poke") {
          playEngineSfx("lampChime");
        } else if (sfxName === "sleep") {
          playEngineSfx("inkPress");
        }
      } catch {
        /* audio fallback */
      }
    },
    [onPlaySfx],
  );

  const changeMood = useCallback(
    (nextMood: LampAnimationMood, sfxName?: string) => {
      if (controlledMood === undefined) {
        setInternalMood(nextMood);
      }
      onMoodChange?.(nextMood);
      if (sfxName) {
        triggerSfx(sfxName);
      }
    },
    [controlledMood, onMoodChange, triggerSfx],
  );

  // Position state (null = resting bottom-right)
  const [position, setPosition] = useState<LampPosition | null>(() => loadSavedLampPos(storageKey));
  const [isDragging, setIsDragging] = useState(false);

  // Drag ref tracker
  const dragTracker = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    hasMoved: boolean;
  } | null>(null);

  // Get current effective coordinates
  const getEffectivePosition = useCallback((): LampPosition => {
    if (position) return position;
    if (typeof window === "undefined") return { left: 400, top: 400 };
    const resting = computeBottomRightRestingPos(
      { width: companionWidth, height: companionHeight },
      { width: window.innerWidth, height: window.innerHeight },
      restingOffset,
    );
    return nudgeOutOfRects(
      resting,
      { width: companionWidth, height: companionHeight },
      collectAvoidRects(),
      { width: window.innerWidth, height: window.innerHeight },
    );
  }, [position, companionWidth, companionHeight, restingOffset, collectAvoidRects]);

  // Double-click reset to resting bottom-right
  const handleResetPosition = useCallback(() => {
    setPosition(null);
    persistLampPos(null, storageKey);
    triggerSfx("lampClick");
  }, [storageKey, triggerSfx]);

  // Poke handler
  const handlePoke = useCallback(() => {
    // Wake up if sleeping; otherwise a small nod with a brass chime.
    if (activeMood === "sleep") {
      changeMood("idle", "wake");
    } else {
      changeMood("poke", "poke");
    }
    onPoke?.();
  }, [activeMood, changeMood, onPoke]);

  // -------------------------------------------------------------------------
  // Pointer Drag Handlers (supports both mouse and touch)
  // -------------------------------------------------------------------------
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Don't drag when interacting with nested button controls
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }

    const effectivePos = getEffectivePosition();
    dragTracker.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: effectivePos.left,
      origTop: effectivePos.top,
      hasMoved: false,
    };

    try {
      if (typeof (e.currentTarget as HTMLElement).setPointerCapture === "function") {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    } catch {
      /* ignore environment without pointer capture */
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const tracker = dragTracker.current;
    if (!tracker || tracker.pointerId !== e.pointerId) return;

    const dx = e.clientX - tracker.startX;
    const dy = e.clientY - tracker.startY;

    if (!tracker.hasMoved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      tracker.hasMoved = true;
      setIsDragging(true);
    }

    if (tracker.hasMoved) {
      const rawLeft = tracker.origLeft + dx;
      const rawTop = tracker.origTop + dy;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const dims = { width: companionWidth, height: companionHeight };
      const clamped = nudgeOutOfRects(
        clampCoordinates({ left: rawLeft, top: rawTop }, dims, viewport),
        dims,
        collectAvoidRects(),
        viewport,
      );
      setPosition(clamped);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const tracker = dragTracker.current;
    if (!tracker || tracker.pointerId !== e.pointerId) return;

    if (tracker.hasMoved) {
      // Finished dragging: persist new position
      const effectivePos = getEffectivePosition();
      persistLampPos(effectivePos, storageKey);
    } else {
      // Clean tap / click without drag: trigger poke
      handlePoke();
    }

    try {
      if (typeof (e.currentTarget as HTMLElement).releasePointerCapture === "function") {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }

    dragTracker.current = null;
    setIsDragging(false);
  };

  const handlePointerCancel = () => {
    dragTracker.current = null;
    setIsDragging(false);
  };

  // -------------------------------------------------------------------------
  // Desk-busy "think" hold — the lamp leans in quietly while a stream runs.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (think === undefined) return;
    if (think && activeMood === "idle") {
      changeMood("think");
    } else if (!think && activeMood === "think") {
      changeMood("idle");
    }
  }, [think, activeMood, changeMood]);

  // -------------------------------------------------------------------------
  // Inactivity Sleep Watcher (4 minutes idle -> sleep)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (idleTimeoutMs <= 0) return;

    let idleTimer: number | undefined;

    const resetIdleWatch = () => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      if (document.visibilityState !== "visible") return;

      idleTimer = window.setTimeout(() => {
        if (activeMood !== "sleep") {
          changeMood("sleep", "sleep");
        }
      }, idleTimeoutMs);
    };

    const handleUserActivity = () => {
      if (activeMood === "sleep") {
        changeMood("idle", "wake");
      }
      resetIdleWatch();
    };

    const activityEvents = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

    resetIdleWatch();
    for (const ev of activityEvents) {
      window.addEventListener(ev, handleUserActivity, { passive: true });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetIdleWatch();
      } else if (idleTimer !== undefined) {
        window.clearTimeout(idleTimer);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      for (const ev of activityEvents) {
        window.removeEventListener(ev, handleUserActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [idleTimeoutMs, activeMood, changeMood]);

  // Keyboard navigation for accessibility
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePoke();
    }
  };

  // Compute final styles for floating container
  const currentPos = getEffectivePosition();
  const faceLean = face === "left" ? "rotate(-4deg)" : face === "right" ? "rotate(4deg)" : undefined;
  const containerPositionStyle: CSSProperties = {
    position: "fixed",
    left: `${currentPos.left}px`,
    top: `${currentPos.top}px`,
    width: `${companionWidth}px`,
    height: `${companionHeight}px`,
    zIndex: 999,
    touchAction: "none",
    userSelect: "none",
    cursor: isDragging ? "grabbing" : "grab",
    transform: isDragging ? undefined : faceLean,
    transition: isDragging ? "none" : "box-shadow 0.2s ease, transform 0.35s ease",
    ...style,
  };

  return (
    <div
      ref={rootRef}
      id={containerId}
      tabIndex={0}
      role="region"
      aria-label="16-bit Cozy Pixel Lamp Companion"
      className={`cozy-pixel-lamp-companion group ${className}`}
      style={containerPositionStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={handleResetPosition}
      onKeyDown={handleKeyDown}
    >
      {/* Speech / Caption Balloon */}
      {speech && (
        <div
          role="status"
          aria-live="polite"
          className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-stone-900/90 text-amber-200 border border-amber-500/30 rounded-md text-[11px] font-mono whitespace-nowrap shadow-lg backdrop-blur-xs pointer-events-none transition-opacity animate-in fade-in"
        >
          {speech}
        </div>
      )}

      {/* 16-Bit Pixel Sprite Engine */}
      <PixelSprite
        animations={COZY_PIXEL_LAMP_ANIMATIONS}
        animation={activeMood}
        frameWidth={LAMP_WIDTH}
        frameHeight={LAMP_HEIGHT}
        width={companionWidth}
        height={companionHeight}
        scale={scale}
        alt={`Cozy Pixel Lamp in ${activeMood} state`}
        onAnimationEnd={(anim) => {
          if (anim === "poke") {
            changeMood("idle");
          }
        }}
      />

      {/* Floating Interactive Controls (visible on hover / focus) */}
      {showControls && (
        <div
          className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity bg-stone-900/90 border border-amber-500/20 rounded-full px-2 py-0.5 shadow-md backdrop-blur-xs text-stone-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Poke / Joyful Hop Button */}
          <button
            type="button"
            title="Poke Cozy Lamp (Joyful Hop & Sparks)"
            aria-label="Poke Cozy Lamp"
            onClick={handlePoke}
            className="p-1 hover:text-amber-300 transition-colors cursor-pointer rounded focus:outline-hidden focus:ring-1 focus:ring-amber-400"
          >
            <Sparkles size={12} className={activeMood === "poke" ? "text-amber-400 animate-spin" : ""} />
          </button>

          {/* Think Mode Button */}
          <button
            type="button"
            title="Think Mode (Chimney Spark Dance)"
            aria-label="Think Mode"
            onClick={() => changeMood(activeMood === "think" ? "idle" : "think", "sparkDance")}
            className="p-1 hover:text-amber-300 transition-colors cursor-pointer rounded focus:outline-hidden focus:ring-1 focus:ring-amber-400"
          >
            <BrainCircuit size={12} className={activeMood === "think" ? "text-amber-400" : ""} />
          </button>

          {/* Sleep / Wake Toggle Button */}
          <button
            type="button"
            title={activeMood === "sleep" ? "Wake Lamp" : "Rest / Sleep Lamp"}
            aria-label={activeMood === "sleep" ? "Wake Lamp" : "Rest / Sleep Lamp"}
            onClick={() => changeMood(activeMood === "sleep" ? "idle" : "sleep", activeMood === "sleep" ? "wake" : "sleep")}
            className="p-1 hover:text-amber-300 transition-colors cursor-pointer rounded focus:outline-hidden focus:ring-1 focus:ring-amber-400"
          >
            {activeMood === "sleep" ? (
              <Sun size={12} className="text-amber-400" />
            ) : (
              <Moon size={12} className="text-blue-300" />
            )}
          </button>

          {/* Reset Position Button */}
          {position !== null && (
            <button
              type="button"
              title="Reset to Corner (Double-click)"
              aria-label="Reset Lamp to resting corner"
              onClick={handleResetPosition}
              className="p-1 hover:text-amber-300 transition-colors cursor-pointer rounded focus:outline-hidden focus:ring-1 focus:ring-amber-400"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default PixelLampCompanion;
