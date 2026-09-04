import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** BRAND.md 5 forbids CRT overlays: scanlines, screen glass, bezels.
 *  This scans the tree instead of a fixed file list so the guard survives
 *  ConsoleShell being deleted later. */
const CRT = /scanline|\bcrt\b|crt-/i;

/** Every source file under src, excluding tests. */
function sources(): { path: string; text: string }[] {
  const root = process.cwd();
  return readdirSync(join(root, "src"), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(css|ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((rel) => `src/${rel.split("\\").join("/")}`)
    .map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));
}

describe("brand: no CRT chrome", () => {
  it("ships no scanline or CRT bezel anywhere in src", () => {
    expect(sources().filter((f) => CRT.test(f.text)).map((f) => f.path)).toEqual([]);
  });
});

describe("brand: one icon library", () => {
  it("imports icons only from @phosphor-icons/react", () => {
    const offenders = sources()
      .filter((f) => /from\s*["']lucide-react["']/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
