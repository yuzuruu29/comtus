import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useFocusVision } from "./useFocusVision";

describe("useFocusVision", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with idle status and inactive state", () => {
    const { result } = renderHook(() => useFocusVision(false));
    expect(result.current.isActive).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(result.current.awaySeconds).toBe(0);
  });

  it("toggles focus cam state", () => {
    const { result } = renderHook(() => useFocusVision(false));

    act(() => {
      result.current.toggleFocusCam();
    });
    expect(result.current.isActive).toBe(true);

    act(() => {
      result.current.toggleFocusCam();
    });
    expect(result.current.isActive).toBe(false);
    expect(result.current.status).toBe("idle");
  });
});
