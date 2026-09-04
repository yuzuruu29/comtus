import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom ships no matchMedia, so anything rendering layout code throws on
// mount. Default every query to "does not match": the desktop branch. Tests
// that care about a breakpoint install their own stub before this runs.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});
