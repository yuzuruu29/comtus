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

describe("brand: motion", () => {
  /** Files whose motion is rewritten by a later task. Shrink only. */
  const MOTION_DEBT = ["src/landing/cantor-theme.css", "src/landing/scholar-deck.css"];

  it("uses no bounce or overshoot easing", () => {
    // cubic-bezier with y1 or y2 > 1 overshoots. BRAND.md 5 forbids it.
    const bounce = /cubic-bezier\(\s*[\d.]+\s*,\s*1\.[1-9]/;
    const offenders = sources()
      .filter((f) => !MOTION_DEBT.includes(f.path))
      .filter((f) => bounce.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("never transitions box size", () => {
    // Spec 6.6 names width/height/margin/padding: these reflow the document
    // every frame. The composer thumb still animates `left`, which only moves
    // an absolutely positioned element; Task 2.4 rebuilds it on transform.
    const boxSize = /transition:[^;]*\b(width|height|margin|padding)\b/;
    const offenders = sources()
      .filter((f) => f.path.endsWith(".css") && !MOTION_DEBT.includes(f.path))
      .filter((f) => boxSize.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
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
