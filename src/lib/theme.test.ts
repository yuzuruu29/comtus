import { afterEach, describe, expect, it } from "vitest";
import { applyFontPreset, applyPixelDesk, resolveAppTheme } from "./theme";

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

describe("applyPixelDesk", () => {
  afterEach(() => {
    delete document.documentElement.dataset.pixel;
  });

  it("sets and clears the studio pixel flag on html", () => {
    applyPixelDesk(true);
    expect(document.documentElement.dataset.pixel).toBe("on");
    applyPixelDesk(false);
    expect(document.documentElement.dataset.pixel).toBeUndefined();
  });
});

describe("applyFontPreset", () => {
  afterEach(() => {
    applyFontPreset(undefined);
  });

  it("sets and clears the typography preset on html", () => {
    applyFontPreset("pixel-signal");
    expect(document.documentElement.dataset.fontPreset).toBe("pixel-signal");
    applyFontPreset(undefined);
    expect(document.documentElement.dataset.fontPreset).toBeUndefined();
  });
});
