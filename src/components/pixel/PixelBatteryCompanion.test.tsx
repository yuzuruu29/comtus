import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMTUS_BATTERY_POS_KEY,
  PixelBatteryCompanion,
  clampCoordinates,
  computeBottomRightRestingPos,
  loadSavedBatteryPos,
  nudgeOutOfRects,
  persistBatteryPos,
  type BatteryAvoidRect,
  type CompanionControls,
} from "./PixelBatteryCompanion";
import { BATTERY_HEIGHT, BATTERY_PALETTE, BATTERY_WIDTH, COZY_PIXEL_BATTERY_ANIMATIONS } from "./pixelBatteryFrames";

function pointerDown(target: Element, event: PointerEventInit) {
  fireEvent.pointerDown(target, { isPrimary: true, ...event });
}

/** Drives useBreakpoint's three matchMedia listeners to a single named rung,
    since isMobile now comes from the sm/md/lg/xl ladder, not window.innerWidth. */
function mockBreakpointMedia(bp: "sm" | "lg") {
  const md = bp !== "sm";
  const lg = bp === "lg";
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(min-width: 640px)" ? md : query === "(min-width: 900px)" ? lg : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  cleanup();
  localStorage.removeItem(COMTUS_BATTERY_POS_KEY);
  localStorage.removeItem(`${COMTUS_BATTERY_POS_KEY}:width`);
  localStorage.removeItem("comtus:lamp_pos");
  localStorage.removeItem("comtus-lamp-pos");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // Tests that call mockBreakpointMedia override window.matchMedia; put back
  // the desktop-shaped default so later tests in this file keep working.
  mockBreakpointMedia("lg");
});

describe("PixelBatteryCompanion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("renders the notebook companion with default idle animation", () => {
    render(<PixelBatteryCompanion speech="Ready for a new chapter." />);

    const companion = screen.getByLabelText("Compad companion");
    expect(companion).toBeInTheDocument();
    expect(screen.getByText("Ready for a new chapter.")).toBeInTheDocument();

    const sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "idle");
  });

  it("keeps every notebook mood inside the sprite frame with pages, binding and a ribbon", () => {
    expect(Object.keys(COZY_PIXEL_BATTERY_ANIMATIONS).sort()).toEqual(["celebrate", "cheer", "idle", "poke", "sleep", "think"]);
    expect(Object.keys(BATTERY_PALETTE).join(" ")).not.toMatch(/TERMINAL|SCREEN|CYAN/);
    for (const animation of Object.values(COZY_PIXEL_BATTERY_ANIMATIONS)) {
      for (const frame of animation.frames) {
        expect(frame.name).toContain("notebook-");
        expect(frame.durationMs).toBeGreaterThan(0);
        const colors = new Set<string>();
        for (const run of frame.runs ?? []) {
          const [x, y, width] = run;
          const height = run.length === 5 ? run[3] : 1;
          colors.add(run.length === 5 ? run[4] : run[3]);
          expect([x, y, width, height].every(Number.isInteger)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(width).toBeGreaterThan(0);
          expect(height).toBeGreaterThan(0);
          expect(x + width).toBeLessThanOrEqual(BATTERY_WIDTH);
          expect(y + height).toBeLessThanOrEqual(BATTERY_HEIGHT);
          expect(x > 0 || y > 0).toBe(true);
        }
        expect([...colors]).toEqual(expect.arrayContaining([BATTERY_PALETTE.PAGE, BATTERY_PALETTE.SPINE, BATTERY_PALETTE.RIBBON]));
      }
    }
  });

  it("triggers poke hop and onPoke callback when tapped", () => {
    const onPoke = vi.fn();
    const onPlaySfx = vi.fn();
    render(<PixelBatteryCompanion onPoke={onPoke} onPlaySfx={onPlaySfx} />);

    const companion = screen.getByLabelText("Compad companion");

    pointerDown(companion, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(companion, { pointerId: 1, clientX: 100, clientY: 100 });

    expect(onPoke).toHaveBeenCalledTimes(1);
    expect(onPlaySfx).toHaveBeenCalledWith("companionClick");

    const sprite = companion.querySelector(".pixel-sprite-container");
    expect(sprite).toHaveAttribute("data-animation", "poke");
  });

  it("holds the think mood while the desk is busy, and releases it", () => {
    const { rerender } = render(<PixelBatteryCompanion think={true} />);

    const companion = screen.getByLabelText("Compad companion");
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

  it.each([
    {
      name: "desktop sidebars and composer",
      dimensions: { width: 162, height: 171 },
      viewport: { width: 1440, height: 900 },
      rects: [
        { left: 0, top: 0, right: 1440, bottom: 56 },
        { left: 0, top: 56, right: 320, bottom: 900 },
        { left: 1110, top: 56, right: 1440, bottom: 900 },
        { left: 320, top: 752, right: 1110, bottom: 886 },
      ],
    },
    {
      name: "390px mobile tabs and composer",
      dimensions: { width: 81, height: 85.5 },
      viewport: { width: 390, height: 844 },
      rects: [
        { left: 0, top: 0, right: 390, bottom: 56 },
        { left: 0, top: 660, right: 390, bottom: 776 },
        { left: 0, top: 776, right: 390, bottom: 844 },
      ],
    },
  ])("stays inside the viewport and clear of $name", ({ dimensions, viewport, rects }) => {
    const nudged = nudgeOutOfRects(
      computeBottomRightRestingPos(dimensions, viewport), dimensions, rects, viewport,
    );
    expect(nudged.left).toBeGreaterThanOrEqual(12);
    expect(nudged.top).toBeGreaterThanOrEqual(12);
    expect(nudged.left + dimensions.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(nudged.top + dimensions.height).toBeLessThanOrEqual(viewport.height - 12);
    expect(rects.every((rect) => nudged.left + dimensions.width <= rect.left || nudged.left >= rect.right
      || nudged.top + dimensions.height <= rect.top || nudged.top >= rect.bottom)).toBe(true);
  });

  it("repositions when a workspace pane mounts after the companion", async () => {
    let rects: BatteryAvoidRect[] = [];
    const avoidRects = () => rects;
    render(<PixelBatteryCompanion avoidRects={avoidRects} />);
    const companion = screen.getByLabelText("Compad companion").parentElement!;
    const sidebar = document.createElement("aside");
    const sidebarLeft = window.innerWidth - 240;

    await act(async () => {
      rects = [{ left: sidebarLeft, top: 0, right: window.innerWidth, bottom: window.innerHeight }];
      document.body.append(sidebar);
    });

    expect(parseFloat(companion.style.left) + parseFloat(companion.style.width)).toBeLessThan(sidebarLeft);
    sidebar.remove();
  });

  it("observes newly mounted keep-outs and clears a growing composer without a window resize", async () => {
    let onResize: ResizeObserverCallback = () => {};
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { onResize = callback; }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    });
    const { unmount } = render(<PixelBatteryCompanion avoidSelector=".test-composer" />);
    const companion = screen.getByLabelText("Compad companion").parentElement!;
    const composer = document.createElement("div");
    composer.className = "test-composer";
    let composerTop = window.innerHeight - 12;
    vi.spyOn(composer, "getBoundingClientRect").mockImplementation(() =>
      new DOMRect(0, composerTop, window.innerWidth, window.innerHeight - composerTop));

    await act(async () => { document.body.append(composer); });
    expect(observe).toHaveBeenCalledWith(composer);
    composerTop = parseFloat(companion.style.top) - 32;
    act(() => { onResize([], {} as ResizeObserver); });
    expect(parseFloat(companion.style.top) + parseFloat(companion.style.height)).toBeLessThan(composerTop);

    await act(async () => { composer.append(document.createElement("textarea")); });
    expect(observe).toHaveBeenCalledTimes(1);
    await act(async () => { composer.remove(); });
    expect(unobserve).toHaveBeenCalledWith(composer);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("persists coordinates to localStorage", () => {
    persistBatteryPos({ left: 150, top: 200 });
    const saved = loadSavedBatteryPos(COMTUS_BATTERY_POS_KEY);
    expect(saved).toEqual({ left: 150, top: 200 });
  });

  it("keeps free placement through dragging, layout changes, and remounts", async () => {
    const avoidRects = () => [{ left: 0, top: 0, right: 320, bottom: 768 }];
    persistBatteryPos({ left: 20, top: 100 });
    const { unmount, rerender } = render(<PixelBatteryCompanion freePlacement avoidRects={avoidRects} />);
    const button = screen.getByRole("button", { name: "Compad companion" });
    const frame = button.parentElement!;
    expect(frame).toHaveStyle({ left: "20px", top: "100px" });

    pointerDown(button, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 80, clientY: 120 });
    fireEvent.pointerUp(window, { pointerId: 1 });
    fireEvent.keyDown(button, { key: "ArrowLeft", shiftKey: true });
    expect(loadSavedBatteryPos()).toEqual({ left: 50, top: 190 });

    const pane = document.createElement("aside");
    await act(async () => { document.body.append(pane); });
    rerender(<PixelBatteryCompanion freePlacement avoidRects={() => [{ left: 0, top: 0, right: 500, bottom: 768 }]} />);
    fireEvent(document, new Event("transitionend"));
    expect(frame).toHaveStyle({ left: "50px", top: "190px" });
    pane.remove();
    unmount();
    render(<PixelBatteryCompanion freePlacement avoidRects={avoidRects} />);
    expect(screen.getByRole("button", { name: "Compad companion" }).parentElement)
      .toHaveStyle({ left: "50px", top: "190px" });
  });

  it("resizes diagonally, restores saved width, and fits a smaller viewport", () => {
    let controls!: CompanionControls;
    const menu = (next: CompanionControls) => { controls = next; return <div>Size controls</div>; };
    const { unmount } = render(<PixelBatteryCompanion freePlacement resizable menuOpen menu={menu} />);
    const handle = screen.getByRole("button", { name: "Resize Compad" });
    pointerDown(handle, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 136, clientY: 138 });
    fireEvent.pointerUp(window, { pointerId: 2 });
    expect(controls.width).toBe(198);
    expect(localStorage.getItem(`${COMTUS_BATTERY_POS_KEY}:width`)).toBe("198");
    pointerDown(handle, { pointerId: 7, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 172, clientY: 176 });
    expect(controls.width).toBe(270);
    fireEvent.pointerCancel(window, { pointerId: 7 });
    expect(controls.width).toBe(198);
    expect(localStorage.getItem(`${COMTUS_BATTERY_POS_KEY}:width`)).toBe("198");
    unmount();

    render(<PixelBatteryCompanion freePlacement resizable menuOpen menu={menu} />);
    expect(controls.width).toBe(198);
    act(() => { controls.setWidth(Infinity); });
    expect(controls.width).toBe(198);
    act(() => { controls.setWidth(500); });
    expect(controls.width).toBe(280);
    act(() => { controls.setWidth(10); });
    expect(controls.width).toBe(60);
    act(() => { controls.setWidth(200); controls.resetPlacement(); });
    expect(controls.width).toBe(200);

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 240 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 180 });
    fireEvent(window, new Event("resize"));
    const frame = screen.getByRole("button", { name: "Compad companion" }).parentElement!;
    expect(controls.width).toBeCloseTo(156 * 36 / 38);
    expect(parseFloat(frame.style.left) + parseFloat(frame.style.width)).toBeLessThanOrEqual(228);
    expect(parseFloat(frame.style.top) + parseFloat(frame.style.height)).toBeLessThanOrEqual(168);
  });

  it("opens once for activation but never for a drag, long press, or cancelled pointer", () => {
    const onMenu = vi.fn();
    const onPoke = vi.fn();
    const { unmount } = render(<PixelBatteryCompanion freePlacement onMenu={onMenu} onPoke={onPoke} />);
    const button = screen.getByRole("button", { name: "Open Compad" });
    const release = vi.fn();
    button.releasePointerCapture = release;
    pointerDown(button, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(window, { pointerId: 1 });
    fireEvent.click(button, { detail: 1 });
    expect(onMenu).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    expect(onMenu).toHaveBeenCalledTimes(3);

    pointerDown(button, { pointerId: 2, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(window, { pointerId: 99 });
    expect(onMenu).toHaveBeenCalledTimes(3);
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(window, { pointerId: 2 });
    fireEvent.click(button, { detail: 1 });
    expect(onMenu).toHaveBeenCalledTimes(3);

    pointerDown(button, { pointerId: 3, clientX: 30, clientY: 30 });
    fireEvent.pointerCancel(window, { pointerId: 3 });
    fireEvent.click(button, { detail: 1 });
    pointerDown(button, { pointerId: 4, clientX: 30, clientY: 30 });
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.pointerUp(window, { pointerId: 4 });
    fireEvent.click(button, { detail: 1 });
    expect(onMenu).toHaveBeenCalledTimes(3);
    expect(onPoke).toHaveBeenCalledTimes(3);

    pointerDown(button, { pointerId: 5, clientX: 30, clientY: 30 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 240 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 220 });
    fireEvent(window, new Event("resize"));
    fireEvent.pointerCancel(window, { pointerId: 5 });
    const frame = button.parentElement!;
    expect(parseFloat(frame.style.left) + parseFloat(frame.style.width)).toBeLessThanOrEqual(228);
    expect(parseFloat(frame.style.top) + parseFloat(frame.style.height)).toBeLessThanOrEqual(208);

    pointerDown(button, { pointerId: 6, clientX: 30, clientY: 30 });
    unmount();
    fireEvent.pointerUp(window, { pointerId: 6 });
    expect(release).toHaveBeenLastCalledWith(6);
    expect(onMenu).toHaveBeenCalledTimes(3);
  });

  it("cancels inside the viewport when the responsive sprite grows mid-gesture", () => {
    persistBatteryPos({ left: 900, top: 100 });
    const { rerender } = render(<PixelBatteryCompanion freePlacement scale={2.25} />);
    const button = screen.getByRole("button", { name: "Compad companion" });
    pointerDown(button, { pointerId: 8, clientX: 30, clientY: 30 });
    rerender(<PixelBatteryCompanion freePlacement scale={4.5} />);
    fireEvent.pointerCancel(window, { pointerId: 8 });
    const frame = button.parentElement!;
    expect(frame.style.width).toBe("162px");
    expect(parseFloat(frame.style.left) + 162).toBeLessThanOrEqual(1012);
  });

  it.each([{ left: 12, top: 12 }, { left: 900, top: 12 }, { left: 12, top: 700 }, { left: 900, top: 700 }])(
    "keeps the panel visible near $left/$top and isolates its input keys", (saved) => {
      persistBatteryPos(saved);
      const onPoke = vi.fn();
      render(<PixelBatteryCompanion freePlacement menuOpen onPoke={onPoke}
        menu={<div role="dialog"><input aria-label="Message Compad" /></div>} />);
      const sprite = screen.getByRole("button", { name: "Compad companion" });
      const frame = sprite.parentElement!;
      const previous = { left: frame.style.left, top: frame.style.top };
      const input = screen.getByRole("textbox", { name: "Message Compad" });
      for (const key of ["ArrowLeft", "ArrowRight", "Enter", " "]) fireEvent.keyDown(input, { key });
      expect(frame).toHaveStyle(previous);
      expect(onPoke).not.toHaveBeenCalled();
      expect(sprite.contains(input)).toBe(false);
      const panel = screen.getByRole("dialog").parentElement!;
      expect(parseFloat(panel.style.left)).toBeGreaterThanOrEqual(12);
      expect(parseFloat(panel.style.left) + 360).toBeLessThanOrEqual(1012);
      expect(parseFloat(panel.style.top)).toBeGreaterThanOrEqual(12);
      expect(parseFloat(panel.style.top) + 440).toBeLessThanOrEqual(756);
    },
  );

  it("adapts scale for mobile viewports vs desktop", () => {
    mockBreakpointMedia("sm");
    const { unmount } = render(<PixelBatteryCompanion />);
    let companion = screen.getByLabelText("Compad companion").parentElement!;
    expect(companion.style.width).toBe(`${36 * 2.25}px`);
    unmount();

    mockBreakpointMedia("lg");
    render(<PixelBatteryCompanion />);
    companion = screen.getByLabelText("Compad companion").parentElement!;
    expect(companion.style.width).toBe(`${36 * 4.5}px`);
  });

  it("supports touch pointer drag without throwing", () => {
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    render(<PixelBatteryCompanion />);
    const companion = screen.getByLabelText("Compad companion");
    companion.setPointerCapture = setPointerCapture;
    companion.releasePointerCapture = releasePointerCapture;

    pointerDown(companion, { pointerId: 2, pointerType: "touch", clientX: 50, clientY: 50, button: -1 });
    expect(setPointerCapture).toHaveBeenCalledWith(2);

    fireEvent.pointerMove(window, { pointerId: 2, clientX: 75, clientY: 85 });
    fireEvent.pointerUp(window, { pointerId: 2 });
    expect(releasePointerCapture).toHaveBeenCalledWith(2);
  });
});
