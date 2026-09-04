import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** BRAND.md 5 forbids CRT overlays: scanlines, screen glass, bezels.
 *  This scans the tree instead of a fixed file list so the guard survives
 *  ConsoleShell being deleted later. */
const CRT = /scanline|\bcrt\b|crt-/i;

describe("brand: no CRT chrome", () => {
  it("ships no scanline or CRT bezel anywhere in src", () => {
    const root = process.cwd();
    const files = readdirSync(join(root, "src"), {
      recursive: true,
      encoding: "utf8",
    }).filter((f) => /\.(css|ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));

    const offenders = files
      .map((rel) => `src/${rel.split("\\").join("/")}`)
      .filter((norm) => CRT.test(readFileSync(join(root, norm), "utf8")));

    expect(offenders).toEqual([]);
  });
});
