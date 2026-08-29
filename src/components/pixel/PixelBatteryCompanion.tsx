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
import { Moon, Sun, BrainCircuit, Zap } from "lucide-react";
import { PixelSprite } from "./PixelSprite";
import {
  COZY_PIXEL_BATTERY_ANIMATIONS,
  BATTERY_HEIGHT,
  BATTERY_WIDTH,
} from "./pixelBatteryFrames";
import { playSfx as playEngineSfx } from "../../lib/soundEngine";

export type BatteryAnimationMood = "idle" | "think" | "poke" | "sleep" | "cheer" | "celebrate";
export type LampAnimationMood = BatteryAnimationMood;

export interface BatteryPosition {
  left: number;
  top: number;
}
export type LampPosition = BatteryPosition;

/** Axis-aligned rectangle in viewport coordinates, for keep-out zones. */
export interface BatteryAvoidRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export type LampAvoidRect = BatteryAvoidRect;

export interface PixelBatteryCompanionProps {
  /** Initial mood state */
  initialMood?: BatteryAnimationMood;
  /** Controlled mood state */
  mood?: BatteryAnimationMood;
  /** Callback fired on mood transition */
  onMoodChange?: (mood: BatteryAnimationMood) => void;
  /** Interactive poke callback */
  onPoke?: () => void;
  /** Sound trigger callback */
  onPlaySfx?: (sfxName: string) => void;
  /** Idle duration before transitioning to sleep. Defaults to 4 minutes (240,000 ms) */
  idleTimeoutMs?: number;
  /** LocalStorage key for persisting coordinates. Defaults to 'comtus:battery_pos' */
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
  avoidRects?: () => Array<BatteryAvoidRect | null>;
  /** Desk-busy signal: holds the battery in its "think" state while true */
  think?: boolean;
  /** Slight facing bias toward the pane the desk last touched */
  face?: "left" | "right" | null;
  /** Additional CSS class names */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
}
export type PixelLampCompanionProps = PixelBatteryCompanionProps;

export const COMTUS_BATTERY_POS_KEY = "comtus:battery_pos";
export const COMTUS_LAMP_POS_KEY = COMTUS_BATTERY_POS_KEY;
export const FOUR_MINUTES_MS = 4 * 60 * 1000;
const DRAG_THRESHOLD_PX = 6;

/** Clamps position inside viewport bounds */
export function clampCoordinates(
  pos: BatteryPosition,
  dimensions: { width: number; height: number },
  viewport: { width: number; height: number },
  padding = 12
): BatteryPosition {
  const maxLeft = Math.max(padding, viewport.width - dimensions.width - padding);
  const maxTop = Math.max(padding, viewport.height - dimensions.height - padding);
  return {
    left: Math.min(maxLeft, Math.max(padding, pos.left)),
    top: Math.min(maxTop, Math.max(padding, pos.top)),
  };
}

function rectsIntersect(
  pos: BatteryPosition,
  dimensions: { width: number; height: number },
  rect: BatteryAvoidRect
): boolean {
  return (
    pos.left < rect.right &&
    pos.left + dimensions.width > rect.left &&
    pos.top < rect.bottom &&
    pos.top + dimensions.height > rect.top
  );
}

/** Pushes the companion out of keep-out zones (dock, composer) */
export function nudgeOutOfRects(
  pos: BatteryPosition,
  dimensions: { width: number; height: number },
  rects: BatteryAvoidRect[],
  viewport: { width: number; height: number },
  padding = 12
): BatteryPosition {
  let next = { ...pos };
  for (const rect of rects) {
    if (!rectsIntersect(next, dimensions, rect)) continue;
    const gap = 8;
    const candidates: BatteryPosition[] = [
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
  offset = { right: 28, bottom: 28 }
): BatteryPosition {
  return {
    left: Math.max(12, viewport.width - dimensions.width - offset.right),
    top: Math.max(12, viewport.height - dimensions.height - offset.bottom),
  };
}

/** Safely reads saved coordinates from localStorage */
export function loadSavedBatteryPos(key: string = COMTUS_BATTERY_POS_KEY): BatteryPosition | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key) || localStorage.getItem("comtus:lamp_pos") || localStorage.getItem("comtus-lamp-pos");
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
export function persistBatteryPos(pos: BatteryPosition | null, key: string = COMTUS_BATTERY_POS_KEY): void {
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
 * PixelBatteryCompanion
 *
 * 16-Bit Blue Battery desk companion for Comtus.
 * Features:
 * - 16-bit Cantor8 Royal Sapphire Blue Battery sprite with glowing cyan LED screen
 * - State machine: idle (happy bounce/blink), think (charging loop), poke (surprised jolt), sleep (low power + zZz)
 * - Draggable placement with mouse/touch drag and localStorage persistence
 * - Double-click to return to resting bottom-right position
 * - Keep-out zone avoidance keeps it clear of tools and composers
 */
export function PixelBatteryCompanion({
  initialMood = "idle",
  mood: controlledMood,
  onMoodChange,
  onPoke,
  onPlaySfx,
  idleTimeoutMs = FOUR_MINUTES_MS,
  storageKey = COMTUS_BATTERY_POS_KEY,
  size = 190,
  scale = 5,
  speech,
  showControls = false,
  restingOffset = { right: 28, bottom: 28 },
  avoidRects,
  think = false,
  face = null,
  className = "",
  style,
}: PixelBatteryCompanionProps) {
  const [internalMood, setInternalMood] = useState<BatteryAnimationMood>(initialMood);
  const currentMood = controlledMood ?? internalMood;

  const [position, setPosition] = useState<BatteryPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; startLeft: number; startTop: number; moved: boolean } | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const pokeTimerRef = useRef<number | null>(null);
  const speechId = useId();

  const spriteW = BATTERY_WIDTH * scale;
  const spriteH = BATTERY_HEIGHT * scale;

  const handleMoodTransition = useCallback(
    (nextMood: BatteryAnimationMood) => {
      if (controlledMood === undefined) {
        setInternalMood(nextMood);
      }
      onMoodChange?.(nextMood);
    },
    [controlledMood, onMoodChange]
  );

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    if (currentMood === "sleep") {
      handleMoodTransition("idle");
    }
    idleTimerRef.current = window.setTimeout(() => {
      handleMoodTransition("sleep");
    }, idleTimeoutMs);
  }, [currentMood, handleMoodTransition, idleTimeoutMs]);

  // Initial Placement
  useEffect(() => {
    const saved = loadSavedBatteryPos(storageKey);
    const vp = { width: window.innerWidth, height: window.innerHeight };
    const dims = { width: spriteW, height: spriteH };

    if (saved) {
      let initial = clampCoordinates(saved, dims, vp);
      if (avoidRects) {
        const raw = avoidRects().filter((r): r is BatteryAvoidRect => Boolean(r));
        initial = nudgeOutOfRects(initial, dims, raw, vp);
      }
      setPosition(initial);
    } else {
      let resting = computeBottomRightRestingPos(dims, vp, restingOffset);
      if (avoidRects) {
        const raw = avoidRects().filter((r): r is BatteryAvoidRect => Boolean(r));
        resting = nudgeOutOfRects(resting, dims, raw, vp);
      }
      setPosition(resting);
    }
  }, [restingOffset, scale, size, spriteH, spriteW, storageKey, avoidRects]);

  // Window Resize Clamping
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const vp = { width: window.innerWidth, height: window.innerHeight };
        const dims = { width: spriteW, height: spriteH };
        let clamped = clampCoordinates(prev, dims, vp);
        if (avoidRects) {
          const raw = avoidRects().filter((r): r is BatteryAvoidRect => Boolean(r));
          clamped = nudgeOutOfRects(clamped, dims, raw, vp);
        }
        return clamped;
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, [spriteW, spriteH, avoidRects]);

  // Idle Timer Activity Listeners
  useEffect(() => {
    resetIdleTimer();
    const handleActivity = () => {
      resetIdleTimer();
    };

    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });

    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [resetIdleTimer]);

  // Handle busy / think signal
  useEffect(() => {
    if (think) {
      handleMoodTransition("think");
    } else if (currentMood === "think") {
      handleMoodTransition("idle");
    }
  }, [think, currentMood, handleMoodTransition]);

  // Double-Click to Reset Placement
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const vp = { width: window.innerWidth, height: window.innerHeight };
    const dims = { width: spriteW, height: spriteH };
    let resting = computeBottomRightRestingPos(dims, vp, restingOffset);
    if (avoidRects) {
      const raw = avoidRects().filter((r): r is BatteryAvoidRect => Boolean(r));
      resting = nudgeOutOfRects(resting, dims, raw, vp);
    }
    setPosition(resting);
    persistBatteryPos(resting, storageKey);
    onPlaySfx?.("companionClick");
    playEngineSfx("lampChime");
  };

  // Poke Trigger Handler
  const triggerPoke = useCallback(() => {
    if (pokeTimerRef.current) {
      window.clearTimeout(pokeTimerRef.current);
    }

    handleMoodTransition("poke");
    onPoke?.();
    onPlaySfx?.("companionClick");
    playEngineSfx("lampChime");

    pokeTimerRef.current = window.setTimeout(() => {
      handleMoodTransition("idle");
    }, 700);
  }, [handleMoodTransition, onPoke, onPlaySfx]);

  // Pointer Drag Handlers — window-level listeners for rock-solid tracking
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    e.currentTarget.setPointerCapture(e.pointerId);

    const startPos = position || { left: 0, top: 0 };
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startLeft: startPos.left,
      startTop: startPos.top,
      moved: false,
    };
    setIsDragging(true);

    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      if (!dragStartRef.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        dragStartRef.current.moved = true;
      }
      if (dragStartRef.current.moved) {
        const vp = { width: window.innerWidth, height: window.innerHeight };
        const dims = { width: spriteW, height: spriteH };
        const clamped = clampCoordinates(
          { left: dragStartRef.current.startLeft + dx, top: dragStartRef.current.startTop + dy },
          dims,
          vp
        );
        setPosition(clamped);
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const wasMoved = dragStartRef.current?.moved;
      dragStartRef.current = null;
      setIsDragging(false);
      if (wasMoved) {
        setPosition((p) => {
          if (p) persistBatteryPos(p, storageKey);
          return p;
        });
      } else {
        triggerPoke();
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerPoke();
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && position) {
      e.preventDefault();
      const step = e.shiftKey ? 20 : 6;
      let nextLeft = position.left;
      let nextTop = position.top;

      if (e.key === "ArrowUp") nextTop -= step;
      if (e.key === "ArrowDown") nextTop += step;
      if (e.key === "ArrowLeft") nextLeft -= step;
      if (e.key === "ArrowRight") nextLeft += step;

      const vp = { width: window.innerWidth, height: window.innerHeight };
      const dims = { width: spriteW, height: spriteH };
      const clamped = clampCoordinates({ left: nextLeft, top: nextTop }, dims, vp);
      setPosition(clamped);
      persistBatteryPos(clamped, storageKey);
    }
  };

  const facingTransform = face === "left" ? "scaleX(-1)" : "scaleX(1)";

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label="16-bit Blue Battery Companion"
      aria-describedby={speech ? speechId : undefined}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={`cozy-pixel-battery-companion fixed z-[60] select-none outline-none touch-none transition-[box-shadow] duration-200 ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      } ${className}`}
      style={{
        left: position ? `${position.left}px` : undefined,
        top: position ? `${position.top}px` : undefined,
        width: `${spriteW}px`,
        height: `${spriteH}px`,
        visibility: position ? "visible" : "hidden",
        ...style,
      }}
    >
      {/* Speech bubble */}
      {speech && (
        <div
          id={speechId}
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[#044AB3]/30 bg-[#05132B]/95 px-2.5 py-1 text-center font-mono text-[11px] font-semibold text-[#6FE3FF] shadow-lg backdrop-blur-md anim-fade"
        >
          {speech}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#044AB3]/30 bg-[#05132B]" />
        </div>
      )}

      {/* Floating Mood Controls */}
      {showControls && (isHovered || isFocused) && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-[#044AB3]/40 bg-[#0B132B]/90 p-1 shadow-md backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Idle Mood"
            onClick={() => handleMoodTransition("idle")}
            className={`rounded-full p-1 transition-colors ${
              currentMood === "idle" ? "bg-[#044AB3] text-white" : "text-[#9099B0] hover:text-white"
            }`}
          >
            <Sun size={12} />
          </button>
          <button
            type="button"
            title="Think Mood"
            onClick={() => handleMoodTransition("think")}
            className={`rounded-full p-1 transition-colors ${
              currentMood === "think" ? "bg-[#044AB3] text-white" : "text-[#9099B0] hover:text-white"
            }`}
          >
            <BrainCircuit size={12} />
          </button>
          <button
            type="button"
            title="Sleep Mood"
            onClick={() => handleMoodTransition("sleep")}
            className={`rounded-full p-1 transition-colors ${
              currentMood === "sleep" ? "bg-[#044AB3] text-white" : "text-[#9099B0] hover:text-white"
            }`}
          >
            <Moon size={12} />
          </button>
          <button
            type="button"
            title="Poke Companion"
            onClick={triggerPoke}
            className="rounded-full p-1 text-[#FDE047] hover:bg-yellow-400/20"
          >
            <Zap size={12} />
          </button>
        </div>
      )}

      {/* Battery Sprite Visual Frame */}
      <div
        className="relative h-full w-full pointer-events-none transition-transform duration-200"
        style={{ transform: facingTransform }}
      >
        <PixelSprite
          animations={COZY_PIXEL_BATTERY_ANIMATIONS}
          animation={currentMood}
          frameWidth={BATTERY_WIDTH}
          frameHeight={BATTERY_HEIGHT}
          scale={scale}
          width={BATTERY_WIDTH}
          height={BATTERY_HEIGHT}
          className="drop-shadow-[0_4px_12px_rgba(4,74,179,0.35)]"
        />
      </div>
    </div>
  );
}

// Backward-compatible aliases
export const loadSavedLampPos = loadSavedBatteryPos;
export const persistLampPos = persistBatteryPos;
export const PixelLampCompanion = PixelBatteryCompanion;
export default PixelBatteryCompanion;
