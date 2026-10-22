import { afterEach, describe, expect, it } from "vitest";
import { applyChrome, applyReading, resolveAppTheme } from "./theme";

describe("resolveAppTheme", () => {
  it("honors an explicit light or dark preference", () => {
    expect(resolveAppTheme("light", { prefersLight: false })).toBe("light");
    expect(resolveAppTheme("dark", { prefersLight: true })).toBe("dark");
  });

  it("follows prefers-color-scheme when set to system", () => {
    expect(resolveAppTheme("system", { prefersLight: true })).toBe("light");
    expect(resolveAppTheme("system", { prefersLight: false })).toBe("dark");
  });
});

describe("applyChrome", () => {
  afterEach(() => {
    delete document.documentElement.dataset.chrome;
  });

  it("sets and clears the pixel accent flag on html", () => {
    applyChrome(true);
    expect(document.documentElement.dataset.chrome).toBe("pixel");
    applyChrome(false);
    expect(document.documentElement.dataset.chrome).toBeUndefined();
  });
});

describe("applyReading", () => {
  afterEach(() => {
    applyReading(undefined);
  });

  it("sets and clears the reading size on html", () => {
    applyReading("large");
    expect(document.documentElement.dataset.reading).toBe("large");
    applyReading(undefined);
    expect(document.documentElement.dataset.reading).toBeUndefined();
  });

  it("sets line spacing beside the size and clears both together", () => {
    applyReading("compact", "airy");
    expect(document.documentElement.dataset.leading).toBe("airy");
    applyReading(undefined);
    expect(document.documentElement.dataset.leading).toBeUndefined();
  });
});
