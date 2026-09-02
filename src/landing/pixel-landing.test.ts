import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "pixel-landing.css"), "utf8");
const cantor = readFileSync(join(here, "cantor-theme.css"), "utf8");

describe("landing pixel skin typography", () => {
  it("uses Pixelify Sans as the default font system for the landing page", () => {
    expect(css).toMatch(/--font-display:\s*"Pixelify Sans Variable"/);
    expect(css).toMatch(/--font-body:\s*"Pixelify Sans Variable"/);
  });

  it("does not blanket element selectors onto a font family", () => {
    // An element-level rule here outranks authored class font-families
    // (.c8-card-status, .label-mono) and silently flattens the type system.
    expect(css).not.toMatch(
      /html\[data-landing-pixel="on"\] (?:p|li|span|a|button),\n[^{]*\{[^}]*font-family/,
    );
  });

  it("does not force a font-size floor over authored paragraph sizes", () => {
    expect(css).not.toMatch(/font-size:\s*max\(\d+px,\s*1em\)/);
  });

  it("gives landing headings the display face and body copy the body face", () => {
    expect(cantor).toMatch(/\.cantor-wrapper\s*\{[^}]*font-family:\s*var\(--font-body\)/);
    expect(cantor).toMatch(/\.c8-hero-h1\s*\{[^}]*font-family:\s*var\(--font-display\)/);
    expect(cantor).toMatch(/\.c8-section-h2\s*\{[^}]*font-family:\s*var\(--font-display\)/);
  });

  it("sources the landing scale from the shared tokens", () => {
    expect(cantor).toMatch(/font-size:\s*var\(--text-landing-hero\)/);
    expect(cantor).toMatch(/font-size:\s*var\(--text-landing-section\)/);
  });
});
