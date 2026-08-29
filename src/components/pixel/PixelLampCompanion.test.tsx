import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMTUS_LAMP_POS_KEY,
  PixelLampCompanion,
  loadSavedLampPos,
  nudgeOutOfRects,
  persistLampPos,
} from "./PixelLampCompanion";

afterEach(() => {
  cleanup();
  localStorage.removeItem(COMTUS_LAMP_POS_KEY);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PixelLampCompanion (forwarder to PixelBatteryCompanion)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("renders 16-bit Blue Battery companion via legacy alias", () => {
    render(<PixelLampCompanion speech="100% Charged." />);

    const companion = screen.getByLabelText("16-bit Blue Battery Companion");
    expect(companion).toBeInTheDocument();
    expect(screen.getByText("100% Charged.")).toBeInTheDocument();

    const sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "idle");
  });

  it("triggers poke hop, sound hook, and onPoke callback when tapped", () => {
    const onPoke = vi.fn();
    const onPlaySfx = vi.fn();
    render(<PixelLampCompanion onPoke={onPoke} onPlaySfx={onPlaySfx} />);

    const companion = screen.getByLabelText("16-bit Blue Battery Companion");

    fireEvent.pointerDown(companion, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(companion, { pointerId: 1, clientX: 100, clientY: 100 });

    expect(onPoke).toHaveBeenCalledTimes(1);
    expect(onPlaySfx).toHaveBeenCalledWith("companionClick");

    const sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "poke");
  });

  it("holds the quiet think mood while the desk is busy, and releases it", () => {
    const { rerender } = render(<PixelLampCompanion think={true} />);

    const companion = screen.getByLabelText("16-bit Blue Battery Companion");
    let sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "think");

    rerender(<PixelLampCompanion think={false} />);
    sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "idle");
  });

  it("persists dragged coordinates to localStorage", () => {
    persistLampPos({ left: 150, top: 120 });
    const saved = loadSavedLampPos(COMTUS_LAMP_POS_KEY);
    expect(saved).toEqual({ left: 150, top: 120 });
  });
});

describe("nudgeOutOfRects — keep-out zones", () => {
  const box = { width: 100, height: 100 };
  const viewport = { width: 1200, height: 800 };

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
