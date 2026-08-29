import { cleanup, render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PixelSprite, type PixelAnimation } from "./PixelSprite";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const sampleAnimations: Record<string, PixelAnimation> = {
  idle: {
    frames: [
      {
        name: "idle-0",
        runs: [[0, 0, 4, 1, "#FF0000"]],
        pixels: [{ x: 1, y: 1, color: "#00FF00" }],
        durationMs: 100,
      },
      {
        name: "idle-1",
        runs: [[0, 0, 4, 1, "#0000FF"]],
        pixels: [{ x: 2, y: 2, color: "#FFFF00" }],
        durationMs: 100,
      },
    ],
    fps: 10,
    loop: true,
  },
  hop: {
    frames: [
      {
        name: "hop-0",
        offsetY: 0,
        runs: [[0, 0, 2, 1, "#FFFFFF"]],
        durationMs: 50,
      },
      {
        name: "hop-1",
        offsetY: -4,
        runs: [[0, 0, 2, 1, "#FFFFFF"]],
        durationMs: 50,
      },
    ],
    fps: 20,
    loop: false,
  },
};

describe("PixelSprite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders with proper SVG dimensions and crisp edges", () => {
    render(
      <PixelSprite
        animations={sampleAnimations}
        animation="idle"
        frameWidth={16}
        frameHeight={16}
        scale={2}
        alt="Test sprite"
      />,
    );

    const container = screen.getByRole("img", { name: "Test sprite" });
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute("data-animation", "idle");
    expect(container).toHaveAttribute("data-frame", "0");

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
    expect(svg).toHaveStyle({ shapeRendering: "crispEdges" });
  });

  it("advances frames over time in loop mode", () => {
    const onFrameChange = vi.fn();
    render(
      <PixelSprite
        animations={sampleAnimations}
        animation="idle"
        frameWidth={16}
        frameHeight={16}
        onFrameChange={onFrameChange}
      />,
    );

    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute("data-frame", "0");

    // Advance first frame duration
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute("data-frame", "1");
    expect(onFrameChange).toHaveBeenCalledWith(1, "idle");

    // Advance to loop back
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute("data-frame", "0");
    expect(onFrameChange).toHaveBeenCalledWith(0, "idle");
  });

  it("triggers onAnimationEnd when non-looping animation reaches the end", () => {
    const onAnimationEnd = vi.fn();
    render(
      <PixelSprite
        animations={sampleAnimations}
        animation="hop"
        frameWidth={16}
        frameHeight={16}
        onAnimationEnd={onAnimationEnd}
      />,
    );

    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute("data-animation", "hop");
    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute("data-frame", "0");

    // Advance to frame 1
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute("data-frame", "1");

    // Advance past end
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(onAnimationEnd).toHaveBeenCalledWith("hop");
  });

  it("freezes on static resting frame 0 when prefers-reduced-motion is active", () => {
    const onFrameChange = vi.fn();
    render(
      <PixelSprite
        animations={sampleAnimations}
        animation="idle"
        frameWidth={16}
        frameHeight={16}
        prefersReducedMotionOverride={true}
        onFrameChange={onFrameChange}
      />,
    );

    const sprite = screen.getByRole("img", { hidden: true });
    expect(sprite).toHaveAttribute("data-reduced-motion", "true");
    expect(sprite).toHaveAttribute("data-frame", "0");

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should remain on frame 0
    expect(sprite).toHaveAttribute("data-frame", "0");
    expect(onFrameChange).not.toHaveBeenCalled();
  });

  it("renders custom frame elements and coordinates accurately", () => {
    const customAnimations: Record<string, PixelAnimation> = {
      glow: {
        frames: [
          {
            name: "glow-0",
            elements: <circle data-testid="glow-circle" cx="8" cy="8" r="4" fill="yellow" />,
          },
        ],
      },
    };

    render(
      <PixelSprite
        animations={customAnimations}
        animation="glow"
        frameWidth={16}
        frameHeight={16}
      />,
    );

    expect(screen.getByTestId("glow-circle")).toBeInTheDocument();
  });
});
