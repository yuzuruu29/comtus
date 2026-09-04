import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** WCAG AA for every colour pair the product actually renders (spec 4).
 *  The first draft of the palette failed this: --brass-deep on --brass scored
 *  1.63:1 in Daylight and 1.38:1 in Lamplight, so the primary button was
 *  illegible in both themes. */
const css = readFileSync("src/styles/tokens.css", "utf8");

const block = (sel: string): string => {
  const start = css.indexOf(sel);
  if (start < 0) throw new Error(`tokens.css has no ${sel} block`);
  return css.slice(start);
};

const hex = (blk: string, name: string): string => {
  const m = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(blk);
  if (!m) throw new Error(`no hex for ${name}`);
  return m[1];
};

const lum = (h: string): number => {
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

const ratio = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe.each([
  ["Daylight", ":root"],
  ["Lamplight", 'html[data-theme="dark"]'],
])("%s contrast", (_label, sel) => {
  const b = block(sel);

  it("every text token reads on every ground it sits on", () => {
    for (const fg of ["--ink", "--muted", "--moon", "--sage", "--rust"]) {
      for (const bg of ["--ground", "--surface", "--raised"]) {
        expect(ratio(hex(b, fg), hex(b, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("filled controls carry legible text", () => {
    // Spec 4 rule 6: text on a brass fill is --ground, never --brass-deep.
    for (const fill of ["--brass", "--brass-deep"]) {
      expect(ratio(hex(b, "--ground"), hex(b, fill)), `--ground on ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
    // Rule 8: --candle is fill-only and carries --leather text.
    expect(
      ratio(hex(b, "--leather"), hex(b, "--candle")),
      "--leather on --candle",
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("brass reads as a text and icon colour", () => {
    for (const bg of ["--ground", "--surface"]) {
      expect(ratio(hex(b, "--brass"), hex(b, bg)), `--brass on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
