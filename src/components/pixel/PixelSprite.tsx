import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export interface PixelCoordinate {
  x: number;
  y: number;
  color: string;
  width?: number;
  height?: number;
}

/** Pixel run format: [x, y, width, color] or [x, y, width, height, color] */
export type PixelRun =
  | readonly [x: number, y: number, width: number, color: string]
  | readonly [x: number, y: number, width: number, height: number, color: string];

export interface PixelFrame {
  /** Structured pixel points */
  pixels?: readonly PixelCoordinate[];
  /** Continuous horizontal / box pixel runs */
  runs?: readonly PixelRun[];
  /** Optional SVG / React elements to compose directly in the frame */
  elements?: ReactNode;
  /** Canvas drawing callback */
  draw?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  /** Frame-specific horizontal offset (for hops / bobbing) */
  offsetX?: number;
  /** Frame-specific vertical offset (for hops / bobbing) */
  offsetY?: number;
  /** Custom duration override for this specific frame in ms */
  durationMs?: number;
  /** Descriptive label for screen readers or debug */
  name?: string;
}

export interface PixelAnimation {
  /** Sequence of frames for this animation */
  frames: readonly PixelFrame[];
  /** Frames per second (e.g. 4, 6, 8, 12). Defaults to 6 */
  fps?: number;
  /** Per-frame duration in ms (alternative to fps) */
  frameDurationMs?: number;
  /** Loop configuration: true (infinite), false (once), or number of repetitions */
  loop?: boolean | number;
  /** Name of the animation state to transition to after completion */
  nextAnimation?: string;
}

export interface PixelSpriteProps {
  /** Map of animation names to animation configurations */
  animations: Record<string, PixelAnimation>;
  /** Current animation state key. Defaults to the first key in animations */
  animation?: string;
  /** Native sprite frame width in pixels */
  frameWidth: number;
  /** Native sprite frame height in pixels */
  frameHeight: number;
  /** Multiplier scale (e.g. 1, 2, 3, 4). Sizing can also be passed via width/height/size */
  scale?: number;
  /** Display width in px or CSS string */
  width?: number | string;
  /** Display height in px or CSS string */
  height?: number | string;
  /** Shorthand uniform size in px */
  size?: number;
  /** Rendering engine: 'svg' (crisp vector rectangles) or 'canvas' (bitmap buffer). Defaults to 'svg' */
  renderMode?: "svg" | "canvas";
  /** Default fallback FPS if not specified on the active animation */
  fps?: number;
  /** Default fallback loop if not specified on the active animation */
  loop?: boolean | number;
  /** Pause animation updates */
  paused?: boolean;
  /** Controlled active frame index */
  currentFrameIndex?: number;
  /** Frame index to display statically when reduced motion is preferred. Defaults to 0 */
  reducedMotionFrameIndex?: number;
  /** Explicit override for prefers-reduced-motion (useful in test suites or user toggles) */
  prefersReducedMotionOverride?: boolean;
  /** Callback on every frame advance */
  onFrameChange?: (frameIndex: number, animation: string) => void;
  /** Callback when a non-looping animation reaches its final frame */
  onAnimationEnd?: (animation: string) => void;
  /** Accessible text for the sprite */
  alt?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** Hide from screen readers */
  ariaHidden?: boolean;
  /** ARIA role */
  role?: string;
  /** Additional CSS classes */
  className?: string;
  /** Custom CSS styles */
  style?: CSSProperties;
  /** Overlay or background children */
  children?: ReactNode;
}

/** Hook to detect system prefers-reduced-motion preference */
export function usePrefersReducedMotion(override?: boolean): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof override === "boolean") return override;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof override === "boolean") {
      setPrefersReduced(override);
      return;
    }
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    setPrefersReduced(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    } else if (typeof (mediaQuery as unknown as { addListener?: (cb: (ev: MediaQueryListEvent) => void) => void }).addListener === "function") {
      (mediaQuery as unknown as { addListener: (cb: (ev: MediaQueryListEvent) => void) => void }).addListener(onChange);
      return () => {
        (mediaQuery as unknown as { removeListener: (cb: (ev: MediaQueryListEvent) => void) => void }).removeListener(onChange);
      };
    }
  }, [override]);

  return prefersReduced;
}

/**
 * PixelSprite
 *
 * Lightweight, zero-dependency 16-bit stepped sprite renderer.
 * Supports vector SVG pixel-grid rendering and Canvas bitmap rendering with
 * crisp pixel scaling, configurable FPS/durations, state switching, and
 * WCAG-compliant prefers-reduced-motion static fallback.
 */
export function PixelSprite({
  animations,
  animation,
  frameWidth,
  frameHeight,
  scale = 1,
  width,
  height,
  size,
  renderMode = "svg",
  fps = 6,
  loop = true,
  paused = false,
  currentFrameIndex: controlledFrameIndex,
  reducedMotionFrameIndex = 0,
  prefersReducedMotionOverride,
  onFrameChange,
  onAnimationEnd,
  alt,
  ariaLabel,
  ariaHidden,
  role,
  className = "",
  style = {},
  children,
}: PixelSpriteProps) {
  const prefersReducedMotion = usePrefersReducedMotion(prefersReducedMotionOverride);

  // Active animation definition
  const animationKeys = useMemo(() => Object.keys(animations), [animations]);
  const activeAnimationKey = animation && animations[animation] ? animation : animationKeys[0] || "idle";
  const activeAnimation = animations[activeAnimationKey] || { frames: [] };

  const frames = activeAnimation.frames;
  const frameCount = frames.length;

  const [frameIndex, setFrameIndex] = useState(0);
  const loopCountRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset frame index on animation switch
  useEffect(() => {
    setFrameIndex(0);
    loopCountRef.current = 0;
  }, [activeAnimationKey]);

  // Determine current frame duration
  const activeFps = activeAnimation.fps ?? fps;
  const defaultDuration = activeAnimation.frameDurationMs ?? (activeFps > 0 ? 1000 / activeFps : 166.67);

  // Animation ticker loop
  useEffect(() => {
    if (prefersReducedMotion || paused || frameCount <= 1 || controlledFrameIndex !== undefined) {
      return;
    }

    let isSubscribed = true;

    const currentFrame = frames[frameIndex];
    const duration = currentFrame?.durationMs ?? defaultDuration;

    const activeLoop = activeAnimation.loop ?? loop;

    const timerId = window.setTimeout(() => {
      if (!isSubscribed) return;

      setFrameIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        if (nextIndex < frameCount) {
          onFrameChange?.(nextIndex, activeAnimationKey);
          return nextIndex;
        }

        // Loop handling
        if (activeLoop === true) {
          loopCountRef.current += 1;
          onFrameChange?.(0, activeAnimationKey);
          return 0;
        } else if (typeof activeLoop === "number" && loopCountRef.current + 1 < activeLoop) {
          loopCountRef.current += 1;
          onFrameChange?.(0, activeAnimationKey);
          return 0;
        } else {
          // Animation finished
          onAnimationEnd?.(activeAnimationKey);
          return prevIndex;
        }
      });
    }, duration);

    return () => {
      isSubscribed = false;
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [
    prefersReducedMotion,
    paused,
    frameCount,
    controlledFrameIndex,
    frameIndex,
    frames,
    defaultDuration,
    activeAnimation.loop,
    loop,
    activeAnimationKey,
    onFrameChange,
    onAnimationEnd,
  ]);

  // Effective displayed frame
  const effectiveFrameIndex = prefersReducedMotion
    ? Math.min(Math.max(0, reducedMotionFrameIndex), Math.max(0, frameCount - 1))
    : controlledFrameIndex !== undefined
      ? Math.min(Math.max(0, controlledFrameIndex), Math.max(0, frameCount - 1))
      : Math.min(Math.max(0, frameIndex), Math.max(0, frameCount - 1));

  const currentFrame = useMemo(
    () => frames[effectiveFrameIndex] ?? frames[0],
    [frames, effectiveFrameIndex],
  );
  const offsetX = currentFrame?.offsetX ?? 0;
  const offsetY = currentFrame?.offsetY ?? 0;

  // Compute final dimensions
  const computedWidth = size ?? width ?? frameWidth * scale;
  const computedHeight = size ?? height ?? frameHeight * scale;

  // Canvas drawing effect
  const drawOnCanvas = useCallback(() => {
    if (renderMode !== "canvas" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, frameWidth, frameHeight);

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Custom draw function if provided
    if (currentFrame?.draw) {
      currentFrame.draw(ctx, frameWidth, frameHeight);
    }

    if (currentFrame?.runs) {
      for (const run of currentFrame.runs) {
        const [rx, ry, rw, rhOrColor, possibleColor] = run as [number, number, number, number | string, string | undefined];
        const rh = typeof rhOrColor === "number" ? rhOrColor : 1;
        const color = typeof rhOrColor === "string" ? rhOrColor : possibleColor ?? "#000000";
        ctx.fillStyle = color;
        ctx.fillRect(rx, ry, rw, rh);
      }
    }

    // Draw pixels
    if (currentFrame?.pixels) {
      for (const p of currentFrame.pixels) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width ?? 1, p.height ?? 1);
      }
    }

    ctx.restore();
  }, [renderMode, frameWidth, frameHeight, offsetX, offsetY, currentFrame]);

  useEffect(() => {
    drawOnCanvas();
  }, [drawOnCanvas]);

  const accessibilityProps = ariaHidden
    ? { "aria-hidden": true }
    : {
        role: role ?? "img",
        "aria-label": ariaLabel ?? alt ?? "Pixel sprite",
      };

  const containerStyle: CSSProperties = {
    width: computedWidth,
    height: computedHeight,
    position: "relative",
    display: "inline-block",
    imageRendering: "pixelated",
    ...style,
  };

  return (
    <div
      className={`pixel-sprite-container select-none ${className}`}
      style={containerStyle}
      data-animation={activeAnimationKey}
      data-frame={effectiveFrameIndex}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      {...accessibilityProps}
    >
      {renderMode === "canvas" ? (
        <canvas
          ref={canvasRef}
          width={frameWidth}
          height={frameHeight}
          className="w-full h-full block"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <svg
          viewBox={`0 0 ${frameWidth} ${frameHeight}`}
          width="100%"
          height="100%"
          className="pixel-sprite-svg block w-full h-full"
          style={{ shapeRendering: "crispEdges" }}
        >
          <g
            className="pixel-sprite-frame-root"
            transform={offsetX !== 0 || offsetY !== 0 ? `translate(${offsetX}, ${offsetY})` : undefined}
          >
            {/* Render pixel runs */}
            {currentFrame.runs?.map((run, idx) => {
              const [rx, ry, rw, rhOrColor, possibleColor] = run as [number, number, number, number | string, string | undefined];
              const rh = typeof rhOrColor === "number" ? rhOrColor : 1;
              const color = typeof rhOrColor === "string" ? rhOrColor : possibleColor ?? "#000000";
              return (
                <rect
                  key={`run-${idx}-${rx}-${ry}`}
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill={color}
                />
              );
            })}

            {/* Render individual pixel coordinates */}
            {currentFrame.pixels?.map((p, idx) => (
              <rect
                key={`px-${idx}-${p.x}-${p.y}`}
                x={p.x}
                y={p.y}
                width={p.width ?? 1}
                height={p.height ?? 1}
                fill={p.color}
              />
            ))}

            {/* Render any additional frame elements (SVG nodes, light cones, spark particles) */}
            {currentFrame.elements}
          </g>
        </svg>
      )}

      {children}
    </div>
  );
}

export default PixelSprite;
