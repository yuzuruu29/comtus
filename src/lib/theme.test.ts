import { describe, expect, it } from "vitest";
import { resolveAppTheme } from "./theme";

describe("resolveAppTheme", () => {
  it("forces dark on the landing route", () => {
    expect(resolveAppTheme("light", { landing: true, prefersLight: true })).toBe("dark");
    expect(resolveAppTheme("system", { landing: true, prefersLight: true })).toBe("dark");
  });

  it("honors an explicit light or dark preference off the landing", () => {
    expect(resolveAppTheme("light", { landing: false, prefersLight: false })).toBe("light");
    expect(resolveAppTheme("dark", { landing: false, prefersLight: true })).toBe("dark");
  });

  it("follows prefers-color-scheme when set to system", () => {
    expect(resolveAppTheme("system", { landing: false, prefersLight: true })).toBe("light");
    expect(resolveAppTheme("system", { landing: false, prefersLight: false })).toBe("dark");
  });
});
