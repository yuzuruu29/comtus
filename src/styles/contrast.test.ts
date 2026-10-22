import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("brass-pale is illegible as Daylight text, which is why it is decorative only", () => {
    // Records the reason for the lint below rather than a rendered pair:
    // --brass-pale scores 1.57-1.90:1 on Daylight grounds. It only ever
    // looked acceptable because the product was built dark-first, where it
    // reads 10-12:1. If a palette change ever makes it legible here, this
    // test fails and the lint below can be reconsidered — not before.
    if (_label !== "Daylight") return;
    for (const bg of ["--ground", "--surface", "--raised"]) {
      expect(ratio(hex(b, "--brass-pale"), hex(b, bg)), `--brass-pale on ${bg}`).toBeLessThan(4.5);
    }
  });
});

/** tokens.css calls --brass-pale "decorative glow only" and BRAND.md 3 says
 *  to use --brass for readable accent text. That stayed prose while 121
 *  `text-brasspale` usages across 29 theme-aware files shipped accent text
 *  at 1.57:1 in Daylight. The landing is exempt: index.css pins it to
 *  Lamplight literals, where brass-pale reads 12.68:1. */
describe("brass-pale is never a text colour on theme-aware surfaces", () => {
  const THEME_AWARE = ["src/studio", "src/desk", "src/checkout", "src/components", "src/ui"];

  const sourceFiles = (dir: string): string[] => {
    const root = join(process.cwd(), dir);
    return readdirSync(root, { recursive: true, encoding: "utf8" })
      .map((rel) => `${dir}/${rel.split("\\").join("/")}`)
      .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
  };

  it("uses text-brass, never text-brasspale", () => {
    const offenders = THEME_AWARE.flatMap(sourceFiles).filter((rel) =>
      /text-brass-?pale/.test(readFileSync(join(process.cwd(), rel), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  /** --muted is already the dimmest token that clears AA (5.86:1 Daylight,
   *  5.98:1 Lamplight). Any alpha below it drops out: /80 lands at 3.79:1,
   *  /60 at 2.54:1, /40 at 1.80:1 — and every site using them was 9-11px
   *  label text, where even the large-text allowance does not apply. */
  it("never dims --muted below its own contrast floor", () => {
    const offenders: string[] = [];
    for (const rel of THEME_AWARE.flatMap(sourceFiles)) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      const hits = src.match(/text-muted\/\d+/g);
      if (hits) offenders.push(`${rel}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });
});
