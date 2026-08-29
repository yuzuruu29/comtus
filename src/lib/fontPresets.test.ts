import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONT_PRESETS, fontPresetById } from "./fontPresets";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../styles/font-presets.css"),
  "utf8",
);

describe("font presets", () => {
  it("offers exactly the four curated systems, Instrument first", () => {
    expect(FONT_PRESETS.map((p) => p.id)).toEqual([
      "instrument",
      "pixel-signal",
      "scholar",
      "console",
    ]);
  });

  it("maps every preset to display, body, and mono tokens in CSS", () => {
    for (const preset of FONT_PRESETS) {
      const block = css.split(`html[data-font-preset="${preset.id}"]`)[1] ?? "";
      expect(block, preset.id).toMatch(/--font-display:/);
      expect(block, preset.id).toMatch(/--font-body:/);
      expect(block, preset.id).toMatch(/--font-mono:/);
    }
  });

  it("restricts Pixelify to display accents in the Pixel Signal preset", () => {
    const block = css.split(`html[data-font-preset="pixel-signal"]`)[1] ?? "";
    expect(block).toMatch(/--font-display:\s*"Pixelify Sans Variable"/);
    expect(block).toMatch(/--font-body:\s*"Inter Variable"/);
    expect(block).toMatch(/--font-mono:\s*"JetBrains Mono"/);
  });

  it("falls back to the Instrument preset for unknown ids", () => {
    expect(fontPresetById("nope").id).toBe("instrument");
    expect(fontPresetById(undefined).id).toBe("instrument");
  });
});
