import { useEffect, useRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { bpAtLeast, useBreakpoint } from "./useBreakpoint";

const Q = { md: "(min-width: 640px)", lg: "(min-width: 900px)", xl: "(min-width: 1200px)" } as const;
type Key = keyof typeof Q;

/** Controllable matchMedia stub: three independent MediaQueryLists (one per
    ladder rung) whose `matches` and `change` listeners the test can drive. */
function installMatchMedia(initial: Record<Key, boolean>) {
  const state = { ...initial };
  const listeners: Record<string, Set<(e: MediaQueryListEvent) => void>> = {
    [Q.md]: new Set(),
    [Q.lg]: new Set(),
    [Q.xl]: new Set(),
  };
  const keyOf = (query: string): Key => (query === Q.md ? "md" : query === Q.lg ? "lg" : "xl");

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        get matches() {
          return state[keyOf(query)];
        },
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_type: string, cb: EventListener) => {
          listeners[query].add(cb as (e: MediaQueryListEvent) => void);
        },
        removeEventListener: (_type: string, cb: EventListener) => {
          listeners[query].delete(cb as (e: MediaQueryListEvent) => void);
        },
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });

  return {
    set(key: Key, matches: boolean) {
      state[key] = matches;
      listeners[Q[key]].forEach((cb) => cb({ matches } as MediaQueryListEvent));
    },
  };
}

afterEach(() => {
  Reflect.deleteProperty(window, "matchMedia");
});

/** Wraps useBreakpoint with a mount counter: a real remount re-runs the
    empty-deps effect, a re-render does not. */
function useProbe() {
  const mounts = useRef(0);
  useEffect(() => {
    mounts.current += 1;
  }, []);
  return { bp: useBreakpoint(), mounts };
}

describe("useBreakpoint", () => {
  it("re-renders from xl to sm on a matchMedia change event, without remounting", () => {
    const media = installMatchMedia({ md: true, lg: true, xl: true });
    const { result } = renderHook(() => useProbe());

    expect(result.current.bp).toBe("xl");
    expect(result.current.mounts.current).toBe(1);

    act(() => {
      media.set("xl", false);
      media.set("lg", false);
      media.set("md", false);
    });

    expect(result.current.bp).toBe("sm");
    expect(result.current.mounts.current).toBe(1);
  });

  it("resolves md and lg tiers from the matching rung", () => {
    const media = installMatchMedia({ md: true, lg: false, xl: false });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("md");

    act(() => media.set("lg", true));
    expect(result.current).toBe("lg");
  });
});

describe("bpAtLeast", () => {
  it("orders sm < md < lg < xl", () => {
    expect(bpAtLeast("lg", "md")).toBe(true);
    expect(bpAtLeast("md", "lg")).toBe(false);
    expect(bpAtLeast("sm", "sm")).toBe(true);
    expect(bpAtLeast("xl", "sm")).toBe(true);
  });
});
