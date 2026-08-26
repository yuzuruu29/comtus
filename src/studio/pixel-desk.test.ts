import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "pixel-desk.css"), "utf8");

describe("pixel desk skin", () => {
  it("sets Pixelify on display, body, and mono tokens", () => {
    expect(css).toMatch(/--font-display:\s*"Pixelify Sans Variable"/);
    expect(css).toMatch(/--font-body:\s*"Pixelify Sans Variable"/);
    expect(css).toMatch(/--font-mono:\s*"Pixelify Sans Variable"/);
  });

  it("does not pin chat or notes back to Inter", () => {
    expect(css).not.toMatch(/stay Inter/i);
    expect(css).not.toMatch(/Chat \/ notes/);
  });

  it("steps motion and honors reduced motion", () => {
    expect(css).toMatch(/--ease-house:\s*steps\(/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).not.toMatch(/cubic-bezier\(0\.34,\s*1\.56/);
  });
});
