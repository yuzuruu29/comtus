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

  it("configures smooth house motion and honors reduced motion", () => {
    expect(css).toMatch(/--ease-house:\s*cubic-bezier/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).not.toMatch(/cubic-bezier\(0\.34,\s*1\.56/);
  });

  it("defines the 16 master palette tokens and studio chrome mappings", () => {
    expect(css).toMatch(/--px-void:\s*#080B12/);
    expect(css).toMatch(/--px-ground:\s*#0F1420/);
    expect(css).toMatch(/--px-surface:\s*#171F32/);
    expect(css).toMatch(/--px-raised:\s*#222C44/);
    expect(css).toMatch(/--px-border:\s*#33405F/);
    expect(css).toMatch(/--px-brass:\s*#E3B04B/);
    expect(css).toMatch(/--px-brass-light:\s*#F7D486/);
    expect(css).toMatch(/--px-parchment:\s*#E8DEC8/);
    expect(css).toMatch(/--px-ink:\s*#F5F0E6/);
    expect(css).toMatch(/--px-muted:\s*#9099B0/);
    expect(css).toMatch(/--px-moon:\s*#6C98C2/);
    expect(css).toMatch(/--px-sage:\s*#78B084/);
    expect(css).toMatch(/--px-rust:\s*#C85848/);
    expect(css).toMatch(/--px-candle:\s*#FF9E43/);
  });

  it("applies dithered card textures and warm brass bevel borders", () => {
    expect(css).toMatch(/repeating-linear-gradient/);
    expect(css).toMatch(/border-top:\s*2px solid/);
    expect(css).toMatch(/btn-ink-press/);
    expect(css).toMatch(/\.think-rule/);
    expect(css).toMatch(/\.kind-tile/);
  });
});
