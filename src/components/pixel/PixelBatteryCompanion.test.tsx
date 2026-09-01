import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMTUS_BATTERY_POS_KEY,
  PixelBatteryCompanion,
  clampCoordinates,
  loadSavedBatteryPos,
  nudgeOutOfRects,
  persistBatteryPos,
} from "./PixelBatteryCompanion";

afterEach(() => {
  cleanup();
  localStorage.removeItem(COMTUS_BATTERY_POS_KEY);
  localStorage.removeItem("comtus:lamp_pos");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PixelBatteryCompanion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("renders 16-bit Blue Battery companion with default idle animation", () => {
    render(<PixelBatteryCompanion speech="100% Charged." />);

    const companion = screen.getByLabelText("16-bit Blue Battery Companion");
    expect(companion).toBeInTheDocument();
    expect(screen.getByText("100% Charged.")).toBeInTheDocument();

    const sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "idle");
  });

  it("triggers poke hop and onPoke callback when tapped", () => {
    const onPoke = vi.fn();
    const onPlaySfx = vi.fn();
    render(<PixelBatteryCompanion onPoke={onPoke} onPlaySfx={onPlaySfx} />);

    const companion = screen.getByLabelText("16-bit Blue Battery Companion");

    fireEvent.pointerDown(companion, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(companion, { pointerId: 1, clientX: 100, clientY: 100 });

    expect(onPoke).toHaveBeenCalledTimes(1);
    expect(onPlaySfx).toHaveBeenCalledWith("companionClick");

    const sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "poke");
  });

  it("holds the think mood while the desk is busy, and releases it", () => {
    const { rerender } = render(<PixelBatteryCompanion think={true} />);

    const companion = screen.getByLabelText("16-bit Blue Battery Companion");
    let sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "think");

    rerender(<PixelBatteryCompanion think={false} />);
    sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "idle");
  });

  it("clamps coordinates within viewport padding bounds", () => {
    const clamped = clampCoordinates(
      { left: -20, top: 1000 },
      { width: 108, height: 114 },
      { width: 800, height: 600 }
    );
    expect(clamped.left).toBe(12);
    expect(clamped.top).toBe(600 - 114 - 12);
  });

  it("nudges out of keep-out rects safely", () => {
    const rect = { left: 600, top: 400, right: 750, bottom: 550 };
    const pos = { left: 650, top: 450 };
    const nudged = nudgeOutOfRects(
      pos,
      { width: 108, height: 114 },
      [rect],
      { width: 1000, height: 800 }
    );
    expect(nudged.left < rect.left || nudged.left > rect.right || nudged.top < rect.top || nudged.top > rect.bottom).toBe(true);
  });

  it("persists coordinates to localStorage", () => {
    persistBatteryPos({ left: 150, top: 200 });
    const saved = loadSavedBatteryPos(COMTUS_BATTERY_POS_KEY);
    expect(saved).toEqual({ left: 150, top: 200 });
  });

  it("adapts scale for mobile viewports vs desktop", () => {
    window.innerWidth = 375;
    const { unmount } = render(<PixelBatteryCompanion />);
    let companion = screen.getByLabelText("16-bit Blue Battery Companion");
    expect(companion.style.width).toBe(`${36 * 2.75}px`);
    unmount();

    window.innerWidth = 1024;
    render(<PixelBatteryCompanion />);
    companion = screen.getByLabelText("16-bit Blue Battery Companion");
    expect(companion.style.width).toBe(`${36 * 5}px`);
  });

  it("supports touch pointer drag without throwing", () => {
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    render(<PixelBatteryCompanion />);
    const companion = screen.getByLabelText("16-bit Blue Battery Companion");
    companion.setPointerCapture = setPointerCapture;
    companion.releasePointerCapture = releasePointerCapture;

    fireEvent.pointerDown(companion, { pointerId: 2, pointerType: "touch", clientX: 50, clientY: 50, button: -1 });
    expect(setPointerCapture).toHaveBeenCalledWith(2);

    fireEvent.pointerMove(window, { pointerId: 2, clientX: 75, clientY: 85 });
    fireEvent.pointerUp(window, { pointerId: 2 });
    expect(releasePointerCapture).toHaveBeenCalledWith(2);
  });
});
