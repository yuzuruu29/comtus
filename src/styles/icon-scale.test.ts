import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ICON } from "../ui/iconScale";

/** The icon scale has two homes: the CSS tokens that document it and the
 *  TS module the Phosphor `size` prop reads. A CSS variable cannot reach a
 *  JS prop, so the numbers are written twice and this guard is what stops
 *  them from drifting. */
const CSS_NAME: Record<keyof typeof ICON, string> = {
  xs: "--icon-xs",
  sm: "--icon-sm",
  md: "--icon-md",
  lg: "--icon-lg",
  xl: "--icon-xl",
  xxl: "--icon-2xl",
  xxxl: "--icon-3xl",
};

const css = readFileSync("src/styles/tokens.css", "utf8");

describe("icon scale", () => {
  it("declares every rung in tokens.css", () => {
    const missing = Object.values(CSS_NAME).filter(
      (name) => !new RegExp(`${name}:\\s*\\d+px`).test(css),
    );
    expect(missing).toEqual([]);
  });

  it("mirrors tokens.css exactly", () => {
    for (const [key, cssName] of Object.entries(CSS_NAME) as [
      keyof typeof ICON,
      string,
    ][]) {
      const found = new RegExp(`${cssName}:\\s*(\\d+)px`).exec(css);
      expect(found, `${cssName} is not declared`).not.toBeNull();
      expect(ICON[key], `${cssName} drifted from iconScale.ts`).toBe(
        Number(found![1]),
      );
    }
  });

  it("keeps every rung at or above the 12px floor", () => {
    for (const [key, value] of Object.entries(ICON)) {
      expect(value, `${key} is below the icon floor`).toBeGreaterThanOrEqual(12);
    }
  });
});
