import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMTUS_LAMP_POS_KEY,
  PixelLampCompanion,
  loadSavedLampPos,
  nudgeOutOfRects,
} from "./PixelLampCompanion";

afterEach(() => {
  cleanup();
  localStorage.removeItem(COMTUS_LAMP_POS_KEY);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PixelLampCompanion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("renders 16-bit Cozy Lamp companion with default idle animation", () => {
    render(<PixelLampCompanion speech="The light holds." />);

    const companion = screen.getByRole("region", {
      name: "16-bit Cozy Pixel Lamp Companion",
    });
    expect(companion).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("The light holds.");

    const sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "idle");
  });

  it("triggers poke hop, sound hook, and onPoke callback when tapped", () => {
    const onPoke = vi.fn();
    const onPlaySfx = vi.fn();
    render(<PixelLampCompanion onPoke={onPoke} onPlaySfx={onPlaySfx} />);

    const companion = screen.getByRole("region", {
      name: "16-bit Cozy Pixel Lamp Companion",
    });

    // Pointer tap (down + up without movement)
    fireEvent.pointerDown(companion, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(companion, { pointerId: 1, clientX: 100, clientY: 100 });

    expect(onPoke).toHaveBeenCalledTimes(1);
    // The lamp speaks in lamp voices only — a poke is a chime seam, not a wand/comb
    expect(onPlaySfx).toHaveBeenCalledWith("poke");
    expect(onPlaySfx).not.toHaveBeenCalledWith("wandSparkle");
    expect(onPlaySfx).not.toHaveBeenCalledWith("lampClick");

    // No spark burst: a poke is a small nod, nothing showers.
    expect(document.querySelector(".pixel-spark")).toBeNull();
    expect(document.querySelector(".spark-layer")).toBeNull();
    expect(companion.querySelectorAll(".pixel-spark-node").length).toBe(0);

    const sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "poke");
  });

  it("holds the quiet think mood while the desk is busy, and releases it", () => {
    const { rerender } = render(<PixelLampCompanion think={true} />);

    const companion = screen.getByRole("region", {
      name: "16-bit Cozy Pixel Lamp Companion",
    });
    let sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "think");

    rerender(<PixelLampCompanion think={false} />);
    sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "idle");
  });

  it("allows switching to think mood and triggers spark sound seam", () => {
    const onMoodChange = vi.fn();
    const onPlaySfx = vi.fn();
    render(
      <PixelLampCompanion
        onMoodChange={onMoodChange}
        onPlaySfx={onPlaySfx}
        showControls={true}
      />,
    );

    const thinkButton = screen.getByRole("button", { name: "Think Mode" });
    fireEvent.click(thinkButton);

    expect(onMoodChange).toHaveBeenCalledWith("think");
    expect(onPlaySfx).toHaveBeenCalledWith("sparkDance");

    const sprite = screen.getByRole("region").querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "think");
  });

  it("transitions to sleep after 4 minutes inactivity and wakes on interaction", () => {
    const onMoodChange = vi.fn();
    render(
      <PixelLampCompanion
        idleTimeoutMs={240_000}
        onMoodChange={onMoodChange}
      />,
    );

    const sprite = screen.getByRole("region").querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "idle");

    // Advance 4 minutes
    act(() => {
      vi.advanceTimersByTime(240_000);
    });

    expect(onMoodChange).toHaveBeenCalledWith("sleep");
    expect(sprite).toHaveAttribute("data-animation", "sleep");

    // User activity (keystroke) wakes the lamp
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Space" }));
    });

    expect(onMoodChange).toHaveBeenCalledWith("idle");
    expect(sprite).toHaveAttribute("data-animation", "idle");
  });

  it("persists dragged coordinates to localStorage under comtus:lamp_pos", () => {
    const onPoke = vi.fn();
    render(<PixelLampCompanion onPoke={onPoke} />);
    const companion = screen.getByRole("region");

    // Drag beyond threshold
    fireEvent.pointerDown(companion, { pointerId: 2, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(companion, { pointerId: 2, clientX: 350, clientY: 280 });
    fireEvent.pointerUp(companion, { pointerId: 2, clientX: 350, clientY: 280 });

    // Drag should not trigger poke
    expect(onPoke).not.toHaveBeenCalled();

    // Check localStorage persistence
    const saved = loadSavedLampPos(COMTUS_LAMP_POS_KEY);
    expect(saved).not.toBeNull();
    expect(saved?.left).toBeGreaterThan(0);
    expect(saved?.top).toBeGreaterThan(0);
  });

  it("returns to resting bottom-right corner on double-click", () => {
    localStorage.setItem(
      COMTUS_LAMP_POS_KEY,
      JSON.stringify({ left: 150, top: 120 }),
    );

    render(<PixelLampCompanion />);
    const companion = screen.getByRole("region");

    expect(loadSavedLampPos()).toEqual({ left: 150, top: 120 });

    fireEvent.doubleClick(companion);

    // Should clear saved pos in localStorage
    expect(loadSavedLampPos()).toBeNull();
  });
});

describe("nudgeOutOfRects — keep-out zones", () => {
  const box = { width: 100, height: 100 };
  const viewport = { width: 1200, height: 800 };

  it("nudges the lamp left of an intersecting dock rect", () => {
    const pos = { left: 1050, top: 650 };
    const dock = { left: 1000, top: 700, right: 1180, bottom: 780 };
    const next = nudgeOutOfRects(pos, box, [dock], viewport);
    expect(next.left + box.width).toBeLessThanOrEqual(dock.left);
  });

  it("leaves a non-intersecting position alone", () => {
    const pos = { left: 100, top: 100 };
    const dock = { left: 1000, top: 700, right: 1180, bottom: 780 };
    expect(nudgeOutOfRects(pos, box, [dock], viewport)).toEqual(pos);
  });

  it("still clamps inside the viewport after nudging", () => {
    const pos = { left: 1050, top: 650 };
    const composer = { left: -200, top: 600, right: 1400, bottom: 790 };
    const next = nudgeOutOfRects(pos, box, [composer], viewport);
    expect(next.top + box.height).toBeLessThanOrEqual(viewport.height - 12);
    expect(next.left).toBeGreaterThanOrEqual(12);
  });
});
