import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdleWatch } from "./useIdleWatch";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("visibilityState", "visible");
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useIdleWatch", () => {
  it("calls onIdle after the quiet interval", () => {
    const onIdle = vi.fn();
    const onActive = vi.fn();
    renderHook(() =>
      useIdleWatch({ enabled: true, idleMs: 4_000, onIdle, onActive }),
    );
    expect(onIdle).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("treats a keystroke as a return from idle", () => {
    const onIdle = vi.fn();
    const onActive = vi.fn();
    renderHook(() =>
      useIdleWatch({ enabled: true, idleMs: 4_000, onIdle, onActive }),
    );
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    expect(onActive).toHaveBeenCalledWith(true);
  });

  it("does not idle when disabled", () => {
    const onIdle = vi.fn();
    renderHook(() =>
      useIdleWatch({ enabled: false, idleMs: 1_000, onIdle, onActive: vi.fn() }),
    );
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });
});
