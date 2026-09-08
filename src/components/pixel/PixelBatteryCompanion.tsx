import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { PixelSprite } from "./PixelSprite";
import {
  COZY_PIXEL_BATTERY_ANIMATIONS,
  BATTERY_HEIGHT,
  BATTERY_WIDTH,
} from "./pixelBatteryFrames";
import { playSfx as playEngineSfx } from "../../lib/soundEngine";
import { bpAtLeast, useBreakpoint } from "../../lib/useBreakpoint";
import { ArrowsOut, Brain, Lightning, Moon, Sun } from "@phosphor-icons/react";
import "./compad-companion.css";

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

export interface CompanionControls {
  width: number;
  setWidth: (width: number) => void;
  resetPlacement: () => void;
  react: () => void;
}

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
  /** Keep-out elements whose geometry is observed as the workspace changes. */
  avoidSelector?: string;
  freePlacement?: boolean;
  resizable?: boolean;
  /** Desk-busy signal: holds the notebook in its "think" state while true */
  think?: boolean;
  /** Slight facing bias toward the pane the desk last touched */
  face?: "left" | "right" | null;
  /** Opens the companion panel when the sprite is activated. */
  onMenu?: () => void;
  /** Menu open state. */
  menuOpen?: boolean;
  /** Panel content stays within the viewport as the companion moves. */
  menu?: ReactNode | ((controls: CompanionControls) => ReactNode);
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
const SPRITE_ASPECT = BATTERY_HEIGHT / BATTERY_WIDTH;
const getViewport = () => ({ width: window.innerWidth, height: window.innerHeight });

function fitWidth(width: number, viewport = getViewport()): number {
  return Math.min(Math.max(60, width), 280, Math.max(1, viewport.width - 24),
    Math.max(1, (viewport.height - 24) / SPRITE_ASPECT));
}

function loadSavedWidth(key: string): number | null {
  try {
    const raw = localStorage.getItem(`${key}:width`);
    const width = raw === null ? NaN : Number(raw);
    return Number.isFinite(width) && width > 0 ? Math.min(280, Math.max(60, width)) : null;
  } catch {
    return null;
  }
}

function persistWidth(key: string, width: number): void {
  try {
    localStorage.setItem(`${key}:width`, String(width));
  } catch {
    // Storage can be unavailable in private windows.
  }
}

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
  const bounded = clampCoordinates(pos, dimensions, viewport, padding);
  if (!rects.some((rect) => rectsIntersect(bounded, dimensions, rect))) return bounded;

  const gap = 8;
  const lefts = [bounded.left, padding, viewport.width - dimensions.width - padding,
    ...rects.flatMap((rect) => [rect.left - dimensions.width - gap, rect.right + gap])];
  const tops = [bounded.top, padding, viewport.height - dimensions.height - padding,
    ...rects.flatMap((rect) => [rect.top - dimensions.height - gap, rect.bottom + gap])];
  let next = bounded;
  let distance = Infinity;
  for (const left of lefts) {
    for (const top of tops) {
      const candidate = clampCoordinates({ left, top }, dimensions, viewport, padding);
      if (rects.some((rect) => rectsIntersect(candidate, dimensions, rect))) continue;
      const delta = Math.hypot(candidate.left - bounded.left, candidate.top - bounded.top);
      if (delta < distance) {
        next = candidate;
        distance = delta;
      }
    }
  }
  return next;
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

export function PixelBatteryCompanion({
  initialMood = "idle",
  mood: controlledMood,
  onMoodChange,
  onPoke,
  onPlaySfx,
  idleTimeoutMs = FOUR_MINUTES_MS,
  storageKey = COMTUS_BATTERY_POS_KEY,
  scale: propScale,
  speech,
  showControls = false,
  restingOffset: propRestingOffset,
  avoidRects,
  avoidSelector,
  freePlacement = false,
  resizable = false,
  think = false,
  face = null,
  onMenu,
  menuOpen = false,
  menu,
  className = "",
  style,
}: PixelBatteryCompanionProps) {
  const [internalMood, setInternalMood] = useState<BatteryAnimationMood>(initialMood);
  const currentMood = controlledMood ?? internalMood;

  const bp = useBreakpoint();
  const isMobile = !bpAtLeast(bp, "lg");

  const defaultScale = propScale ?? (isMobile ? 2.25 : 4.5);
  const defaultScaleRef = useRef(defaultScale);
  const [viewport, setViewport] = useState(getViewport);
  const [preferredWidth, setPreferredWidth] = useState(() => loadSavedWidth(storageKey));
  const spriteW = fitWidth(preferredWidth ?? BATTERY_WIDTH * defaultScale, viewport);
  const spriteH = spriteW * SPRITE_ASPECT;
  const scale = spriteW / BATTERY_WIDTH;
  const restingOffset = useMemo(
    () => propRestingOffset ?? (isMobile ? { right: 14, bottom: 84 } : { right: 28, bottom: 28 }),
    [propRestingOffset, isMobile],
  );

  const [position, setPosition] = useState<BatteryPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<BatteryPosition | null>(null);
  const placementKeyRef = useRef<string | null>(null);
  const manuallyPlacedRef = useRef(false);
  const pointerRef = useRef<{
    id: number;
    mode: "move" | "resize";
    x: number;
    y: number;
    start: BatteryPosition;
    startWidth: number;
    preferredWidth: number | null;
    wasPlaced: boolean;
    width: number;
    moved: boolean;
    startedAt: number;
  } | null>(null);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const suppressClickUntilRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);
  const pokeTimerRef = useRef<number | null>(null);
  const speechId = useId();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuSize, setMenuSize] = useState({ width: 360, height: 440 });

  const getAvoidRects = useCallback(() => [
    ...(avoidRects?.() ?? []),
    ...Array.from(avoidSelector ? document.querySelectorAll<HTMLElement>(avoidSelector) : [],
      (element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0),
  ].filter((rect): rect is BatteryAvoidRect => Boolean(rect)), [avoidRects, avoidSelector]);

  const moveTo = useCallback((next: BatteryPosition) => {
    positionRef.current = next;
    setPosition((previous) => previous?.left === next.left && previous.top === next.top ? previous : next);
  }, []);

  useLayoutEffect(() => {
    defaultScaleRef.current = defaultScale;
  }, [defaultScale]);

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

  useEffect(() => {
    setPreferredWidth(loadSavedWidth(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (pointerRef.current) return;
    const dims = { width: spriteW, height: spriteH };
    let next = positionRef.current;
    if (placementKeyRef.current !== storageKey) {
      placementKeyRef.current = storageKey;
      next = loadSavedBatteryPos(storageKey);
      manuallyPlacedRef.current = Boolean(next);
    }
    next ??= computeBottomRightRestingPos(dims, viewport, restingOffset);
    moveTo(freePlacement && manuallyPlacedRef.current
      ? clampCoordinates(next, dims, viewport)
      : nudgeOutOfRects(next, dims, getAvoidRects(), viewport));
  }, [restingOffset, spriteH, spriteW, storageKey, getAvoidRects, freePlacement, viewport, moveTo]);

  useEffect(() => {
    const handleViewportResize = () => setViewport(getViewport());
    window.addEventListener("resize", handleViewportResize, { passive: true });
    return () => window.removeEventListener("resize", handleViewportResize);
  }, []);

  useEffect(() => {
    const handleLayoutChange = () => {
      const previous = positionRef.current;
      if (!previous || pointerRef.current || (freePlacement && manuallyPlacedRef.current)) return;
      moveTo(nudgeOutOfRects(previous, { width: spriteW, height: spriteH }, getAvoidRects(), getViewport()));
    };

    const resizeObserver = avoidSelector && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(handleLayoutChange)
      : null;
    const observed = new Set<Element>();
    const bindKeepOuts = () => {
      if (!resizeObserver || !avoidSelector) return;
      const elements = new Set(document.querySelectorAll(avoidSelector));
      for (const element of observed) {
        if (!elements.has(element)) {
          resizeObserver.unobserve(element);
          observed.delete(element);
        }
      }
      for (const element of elements) {
        if (!observed.has(element)) {
          resizeObserver.observe(element);
          observed.add(element);
        }
      }
    };
    bindKeepOuts();
    const observer = (avoidRects || avoidSelector) && typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
        bindKeepOuts();
        handleLayoutChange();
      })
      : null;
    observer?.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("transitionend", handleLayoutChange);
    return () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener("transitionend", handleLayoutChange);
    };
  }, [spriteW, spriteH, avoidRects, avoidSelector, getAvoidRects, freePlacement, moveTo]);

  useLayoutEffect(() => {
    if (!menuOpen || !menuRef.current) return;
    const element = menuRef.current;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setMenuSize((previous) => previous.width === rect.width && previous.height === rect.height
        ? previous : { width: rect.width, height: rect.height });
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [menuOpen, menu]);

  useEffect(() => () => {
    pointerRef.current = null;
    pointerCleanupRef.current?.();
    if (pokeTimerRef.current) window.clearTimeout(pokeTimerRef.current);
  }, []);

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

  const resetPlacement = useCallback(() => {
    const vp = getViewport();
    const dims = { width: spriteW, height: spriteH };
    const resting = nudgeOutOfRects(computeBottomRightRestingPos(dims, vp, restingOffset), dims, getAvoidRects(), vp);
    manuallyPlacedRef.current = true;
    moveTo(resting);
    persistBatteryPos(resting, storageKey);
    onPlaySfx?.("companionClick");
    playEngineSfx("lampChime");
  }, [spriteW, spriteH, restingOffset, getAvoidRects, moveTo, storageKey, onPlaySfx]);

  const setWidth = useCallback((width: number) => {
    if (!Number.isFinite(width)) return;
    const nextWidth = fitWidth(width);
    const vp = getViewport();
    const dims = { width: nextWidth, height: nextWidth * SPRITE_ASPECT };
    const current = positionRef.current ?? computeBottomRightRestingPos(dims, vp, restingOffset);
    const next = freePlacement ? clampCoordinates(current, dims, vp)
      : nudgeOutOfRects(current, dims, getAvoidRects(), vp);
    manuallyPlacedRef.current = true;
    setPreferredWidth(nextWidth);
    persistWidth(storageKey, nextWidth);
    moveTo(next);
    persistBatteryPos(next, storageKey);
  }, [freePlacement, getAvoidRects, moveTo, restingOffset, storageKey]);

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

  const activate = () => {
    triggerPoke();
    onMenu?.();
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>, mode: "move" | "resize") => {
    if (pointerRef.current || e.isPrimary === false || (e.pointerType === "mouse" && e.button !== 0)) return;
    const target = e.currentTarget;
    e.preventDefault();
    e.stopPropagation();
    target.focus({ preventScroll: true });
    pointerRef.current = {
      id: e.pointerId, mode, x: e.clientX, y: e.clientY,
      start: positionRef.current ?? { left: 12, top: 12 },
      startWidth: spriteW, width: spriteW, preferredWidth,
      wasPlaced: manuallyPlacedRef.current, moved: false, startedAt: performance.now(),
    };
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      // Window listeners also support browsers without pointer capture.
    }

    const onMove = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer || event.pointerId !== pointer.id) return;
      event.preventDefault();
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.moved ||= Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;
      if (!pointer.moved) return;
      manuallyPlacedRef.current = true;
      const vp = getViewport();
      if (mode === "resize") {
        pointer.width = fitWidth(pointer.startWidth + (dx + dy / SPRITE_ASPECT) / 2, vp);
        setPreferredWidth(pointer.width);
        setIsResizing(true);
      } else {
        setIsDragging(true);
      }
      moveTo(clampCoordinates(mode === "move"
        ? { left: pointer.start.left + dx, top: pointer.start.top + dy } : pointer.start,
      { width: pointer.width, height: pointer.width * SPRITE_ASPECT }, vp));
    };

    const cleanupPointer = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      target.removeEventListener("lostpointercapture", onCancel);
      try {
        target.releasePointerCapture?.(e.pointerId);
      } catch {
        // Capture may already have been released by the browser.
      }
    };

    const finishPointer = (event: PointerEvent, cancelled: boolean) => {
      const pointer = pointerRef.current;
      if (!pointer || event.pointerId !== pointer.id) return;
      pointerRef.current = null;
      pointerCleanupRef.current = null;
      cleanupPointer();
      setIsDragging(false);
      setIsResizing(false);
      suppressClickUntilRef.current = performance.now() + 500;
      if (cancelled) {
        manuallyPlacedRef.current = pointer.wasPlaced;
        setPreferredWidth(pointer.preferredWidth);
        const restoredWidth = fitWidth(pointer.preferredWidth ?? BATTERY_WIDTH * defaultScaleRef.current);
        moveTo(clampCoordinates(pointer.start,
          { width: restoredWidth, height: restoredWidth * SPRITE_ASPECT }, getViewport()));
      } else if (pointer.moved) {
        const dims = { width: pointer.width, height: pointer.width * SPRITE_ASPECT };
        const current = positionRef.current ?? pointer.start;
        const next = freePlacement ? clampCoordinates(current, dims, getViewport())
          : nudgeOutOfRects(current, dims, getAvoidRects(), getViewport());
        moveTo(next);
        persistBatteryPos(next, storageKey);
        if (mode === "resize") persistWidth(storageKey, pointer.width);
      } else if (mode === "move" && performance.now() - pointer.startedAt < 500) {
        activate();
      }
    };
    const onUp = (event: PointerEvent) => finishPointer(event, false);
    const onCancel = (event: PointerEvent) => finishPointer(event, true);
    pointerCleanupRef.current = cleanupPointer;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    target.addEventListener("lostpointercapture", onCancel);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) activate();
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && positionRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? 20 : 6;
      let nextLeft = positionRef.current.left;
      let nextTop = positionRef.current.top;

      if (e.key === "ArrowUp") nextTop -= step;
      if (e.key === "ArrowDown") nextTop += step;
      if (e.key === "ArrowLeft") nextLeft -= step;
      if (e.key === "ArrowRight") nextLeft += step;

      const vp = getViewport();
      const dims = { width: spriteW, height: spriteH };
      const next = { left: nextLeft, top: nextTop };
      const clamped = freePlacement ? clampCoordinates(next, dims, vp)
        : nudgeOutOfRects(next, dims, getAvoidRects(), vp);
      manuallyPlacedRef.current = true;
      moveTo(clamped);
      persistBatteryPos(clamped, storageKey);
    }
  };

  const facingTransform = face === "left" ? "scaleX(-1)" : "scaleX(1)";
  const panelWidth = Math.min(menuSize.width, Math.max(0, viewport.width - 24));
  const panelHeight = Math.min(menuSize.height, Math.max(0, viewport.height - 24));
  const panelLeft = Math.max(12, Math.min(viewport.width - panelWidth - 12,
    (position?.left ?? 12) + spriteW / 2 - panelWidth / 2));
  const above = (position?.top ?? 12) - panelHeight - 10;
  const panelTop = Math.max(12, Math.min(viewport.height - panelHeight - 12,
    above >= 12 ? above : (position?.top ?? 12) + spriteH + 10));

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
      }}
      className={`cozy-pixel-battery-companion pointer-events-auto fixed z-[60] select-none ${className}`}
      style={{
        left: position ? `${position.left}px` : undefined,
        top: position ? `${position.top}px` : undefined,
        width: `${spriteW}px`,
        height: `${spriteH}px`,
        visibility: position ? "visible" : "hidden",
        pointerEvents: "auto",
        ...style,
      }}
    >
      {menuOpen && menu && (
        <div
          ref={menuRef}
          id={menuId}
          className="compad-menu-anchor"
          style={{ left: panelLeft, top: panelTop }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {typeof menu === "function" ? menu({ width: spriteW, setWidth, resetPlacement, react: triggerPoke }) : menu}
        </div>
      )}

      {/* Speech bubble */}
      {speech && (
        <div
          id={speechId}
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-brass/30 bg-ground/95 px-2.5 py-1 text-center font-mono text-[11px] font-semibold text-brasspale shadow-lg backdrop-blur-md anim-fade"
        >
          {speech}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-brass/30 bg-ground" />
        </div>
      )}

      {/* Floating Mood Controls */}
      {showControls && (isHovered || isFocused) && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-brass/40 bg-ground/90 p-1 shadow-md backdrop-blur-sm"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="toolbar"
          aria-label="Companion mood controls"
        >
          <button
            type="button"
            title="Idle Mood"
            onClick={() => handleMoodTransition("idle")}
            className={`rounded-full p-1 transition-colors ${
              currentMood === "idle" ? "bg-brass text-night font-bold" : "text-muted hover:text-ink"
            }`}
          >
            <Sun size={12} />
          </button>
          <button
            type="button"
            title="Think Mood"
            onClick={() => handleMoodTransition("think")}
            className={`rounded-full p-1 transition-colors ${
              currentMood === "think" ? "bg-brass text-night font-bold" : "text-muted hover:text-ink"
            }`}
          >
            <Brain size={12} />
          </button>
          <button
            type="button"
            title="Sleep Mood"
            onClick={() => handleMoodTransition("sleep")}
            className={`rounded-full p-1 transition-colors ${
              currentMood === "sleep" ? "bg-brass text-night font-bold" : "text-muted hover:text-ink"
            }`}
          >
            <Moon size={12} />
          </button>
          <button
            type="button"
            title="Poke Companion"
            onClick={triggerPoke}
            className="rounded-full p-1 text-brasspale hover:bg-brass/20"
          >
            <Lightning size={12} />
          </button>
        </div>
      )}

      <button
        type="button"
        className="compad-sprite-button"
        aria-label={onMenu ? "Open Compad" : "Compad companion"}
        aria-describedby={speech ? speechId : undefined}
        aria-expanded={onMenu ? menuOpen : undefined}
        aria-controls={onMenu && menuOpen ? menuId : undefined}
        data-dragging={isDragging}
        onPointerDown={(event) => handlePointerDown(event, "move")}
        onKeyDown={handleKeyDown}
        onClick={(event) => {
          event.stopPropagation();
          if (event.detail === 0 || performance.now() > suppressClickUntilRef.current) activate();
        }}
      >
        <span className="block h-full w-full pointer-events-none" style={{ transform: facingTransform }}>
          <PixelSprite
            animations={COZY_PIXEL_BATTERY_ANIMATIONS}
            animation={currentMood}
            frameWidth={BATTERY_WIDTH}
            frameHeight={BATTERY_HEIGHT}
            scale={scale}
            ariaHidden
            className="drop-shadow-sm"
          />
        </span>
      </button>
      {resizable && (
        <button
          type="button"
          className="compad-resize-handle"
          data-resizing={isResizing}
          aria-label="Resize Compad"
          title="Drag to resize, or use arrow keys"
          onPointerDown={(event) => handlePointerDown(event, "resize")}
          onClick={(event) => {
            if (event.detail === 0) onMenu?.();
          }}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
            setWidth(spriteW + direction * (event.shiftKey ? 20 : 6));
          }}
        >
          <ArrowsOut size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// Backward-compatible aliases
export const loadSavedLampPos = loadSavedBatteryPos;
export const persistLampPos = persistBatteryPos;
export const PixelLampCompanion = PixelBatteryCompanion;
export default PixelBatteryCompanion;
