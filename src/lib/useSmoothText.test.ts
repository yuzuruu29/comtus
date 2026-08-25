import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSmoothText } from "./useSmoothText";

/** Manual requestAnimationFrame harness: tests fire frames explicitly. */
function makeRaf() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    raf: (cb: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    caf: (id: number) => {
      pending.delete(id);
    },
    fire: (now: number) => {
      for (const cb of [...pending.values()]) {
        pending.clear();
        cb(now);
      }
    },
  };
}

const FRAME = 1000 / 60;

describe("useSmoothText", () => {
  let clock: ReturnType<typeof makeRaf>;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mount = (target: string, enabled: boolean) => {
    clock = makeRaf();
    vi.stubGlobal("requestAnimationFrame", clock.raf);
    vi.stubGlobal("cancelAnimationFrame", clock.caf);
    return renderHook(({ t, e }: { t: string; e: boolean }) => useSmoothText(t, e), {
      initialProps: { t: target, e: enabled },
    });
  };

  it("passes the target through untouched while disabled", () => {
    const { result } = mount("hello world", false);
    expect(result.current.text).toBe("hello world");
    expect(result.current.caughtUp).toBe(true);
  });

  it("reveals progressively and finishes caught up", () => {
    const target = "a".repeat(40);
    const { result } = mount(target, true);
    expect(result.current.text).toBe("");

    let now = 0;
    let frames = 0;
    while (!result.current.caughtUp && frames < 200) {
      now += FRAME;
      act(() => clock.fire(now));
      frames++;
      expect(target.startsWith(result.current.text)).toBe(true);
    }

    expect(result.current.text).toBe(target);
    expect(result.current.caughtUp).toBe(true);
  });

  it("catches up fast streams much quicker than the floor pace", () => {
    const { result } = mount("b".repeat(4000), true);

    act(() => clock.fire(FRAME));
    // Floor pace alone (~26 cps) would give <2 chars; backlog scaling gives hundreds.
    expect(result.current.text.length).toBeGreaterThan(100);
  });

  it("flush jumps straight to the full text", () => {
    const target = "c".repeat(500);
    const { result } = mount(target, true);
    act(() => clock.fire(FRAME));
    expect(result.current.text.length).toBeLessThan(target.length);

    act(() => result.current.flush());
    expect(result.current.text).toBe(target);
    expect(result.current.caughtUp).toBe(true);
  });

  it("resets between sends instead of animating from stale text", () => {
    const { result, rerender } = mount("first", true);
    let now = 0;
    while (!result.current.caughtUp) {
      now += FRAME;
      act(() => clock.fire(now));
    }
    expect(result.current.text).toBe("first");

    // Stream ends (disabled), then a new send starts from empty.
    act(() => rerender({ t: "", e: false }));
    expect(result.current.text).toBe("");
    act(() => rerender({ t: "second answer", e: true }));
    expect(result.current.text).toBe("");
    act(() => clock.fire((now += FRAME)));
    expect(result.current.text.length).toBeGreaterThan(0);
    expect(result.current.text.length).toBeLessThan("second answer".length);
  });

  it("never leaves a split surrogate pair behind", () => {
    const target = "😀".repeat(8);
    const { result } = mount(target, true);
    let now = 0;
    while (!result.current.caughtUp && now < FRAME * 400) {
      now += FRAME;
      act(() => clock.fire(now));
      const text = result.current.text;
      expect(text.slice(-1)).not.toMatch(/[\uD800-\uDBFF]/);
    }
    expect(result.current.text).toBe(target);
  });
});
