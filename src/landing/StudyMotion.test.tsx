import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StudyMotion from "./StudyMotion";

let setIntersection: (visible: boolean) => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) {
      setIntersection = (visible) => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    observe() { setIntersection(true); }
    disconnect = disconnect;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("arranges the sample, pauses for manual choices, and replays from the beginning", () => {
  render(<StudyMotion motionMode="full" />);
  const gather = screen.getByRole("button", { name: "Gather" });
  const connect = screen.getByRole("button", { name: "Connect" });
  const recall = screen.getByRole("button", { name: "Recall" });
  expect(gather).toHaveAttribute("aria-pressed", "true");
  act(() => vi.advanceTimersByTime(4500));
  expect(connect).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Pause motion" }));
  act(() => vi.advanceTimersByTime(9000));
  expect(connect).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(recall);
  expect(recall).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Close the page. See what comes back.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Replay study sequence" }));
  expect(gather).toHaveAttribute("aria-pressed", "true");
  act(() => vi.advanceTimersByTime(4000));
  fireEvent.click(screen.getByRole("button", { name: "Replay study sequence" }));
  act(() => vi.advanceTimersByTime(500));
  expect(gather).toHaveAttribute("aria-pressed", "true");
  act(() => vi.advanceTimersByTime(4000));
  expect(connect).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(recall);
  act(() => vi.advanceTimersByTime(4500));
  expect(recall).toHaveAttribute("aria-pressed", "true");
});

it("suspends progression offscreen and in a hidden document, and cleans up", () => {
  const { unmount } = render(<StudyMotion motionMode="full" />);
  const gather = screen.getByRole("button", { name: "Gather" });
  act(() => setIntersection(false));
  act(() => vi.advanceTimersByTime(9000));
  expect(gather).toHaveAttribute("aria-pressed", "true");
  act(() => setIntersection(true));
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  act(() => vi.advanceTimersByTime(9000));
  expect(gather).toHaveAttribute("aria-pressed", "true");
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  act(() => vi.advanceTimersByTime(4500));
  expect(screen.getByRole("button", { name: "Connect" })).toHaveAttribute("aria-pressed", "true");
  unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["minimal", "none"] as const)("keeps %s motion static while letting visitors choose steps", (motionMode) => {
  render(<StudyMotion motionMode={motionMode} />);
  act(() => vi.advanceTimersByTime(9000));
  expect(screen.getByRole("button", { name: "Gather" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Play motion" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Recall" }));
  expect(screen.getByRole("button", { name: "Recall" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("figure")).toHaveAttribute("data-motion", "none");
});

it("honours the operating system motion setting even with full app motion", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  render(<StudyMotion motionMode="full" />);
  act(() => vi.advanceTimersByTime(9000));
  expect(screen.getByRole("button", { name: "Gather" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Play motion" })).toBeDisabled();
  expect(screen.getByRole("figure")).toHaveAttribute("data-motion", "none");
});

it("finishes entrance artwork when a visitor immediately chooses a step", () => {
  render(<StudyMotion motionMode="full" />);
  fireEvent.click(screen.getByRole("button", { name: "Recall" }));
  expect(screen.getByRole("figure")).toHaveAttribute("data-arrive", "false");
  expect(screen.getByRole("button", { name: "Recall" })).toHaveAttribute("aria-pressed", "true");
  act(() => vi.advanceTimersByTime(9000));
  expect(screen.getByRole("button", { name: "Recall" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Replay study sequence" }));
  expect(screen.getByRole("figure")).toHaveAttribute("data-arrive", "true");
});
