import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONT_PRESETS, fontPresetById } from "./fontPresets";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../styles/font-presets.css"),
  "utf8",
);

function blockForPreset(id: string): string {
  const marker = `html[data-font-preset="${id}"]`;
  const start = css.indexOf(marker);
  if (start === -1) return "";

  const nextMarkerIndex = css.indexOf(`html[data-font-preset="`, start + marker.length);
  const end = nextMarkerIndex === -1 ? css.length : nextMarkerIndex;
  let block = css.slice(start, end);

  const commentRegex = /\/\*[\s\S]*?\*\//g;
  while (commentRegex.test(block)) {
    block = block.replace(commentRegex, "");
  }
  return block;
}

describe("font presets", () => {
  it("offers exactly the four curated systems, Instrument first", () => {
    expect(FONT_PRESETS.map((p) => p.id)).toEqual([
      "instrument",
      "pixel-signal",
      "scholar",
      "console",
    ]);
  });

  it("uses a single primary family across display, body, and mono in every preset", () => {
    for (const preset of FONT_PRESETS) {
      const block = blockForPreset(preset.id);
      const displayPrimary = block.match(/--font-display:\s*"([^"]+)"/)?.[1] ?? "";
      const bodyPrimary = block.match(/--font-body:\s*"([^"]+)"/)?.[1] ?? "";
      const monoPrimary = block.match(/--font-mono:\s*"([^"]+)"/)?.[1] ?? "";

      expect(displayPrimary, `${preset.id} display primary`).not.toBe("");
      expect(bodyPrimary, `${preset.id} body primary`).not.toBe("");
      expect(monoPrimary, `${preset.id} mono primary`).not.toBe("");

      const presetFamilies = new Set([displayPrimary, bodyPrimary, monoPrimary]);
      expect(presetFamilies.size, `${preset.id} family count`).toBeLessThanOrEqual(2);
    }
  });

  it("maps every preset to display, body, and mono tokens in CSS", () => {
    for (const preset of FONT_PRESETS) {
      const block = blockForPreset(preset.id);
      expect(block, preset.id).toMatch(/--font-display:/);
      expect(block, preset.id).toMatch(/--font-body:/);
      expect(block, preset.id).toMatch(/--font-mono:/);
    }
  });

  it("restricts Pixelify to the Pixel Signal preset", () => {
    for (const preset of FONT_PRESETS) {
      const block = blockForPreset(preset.id).replace(/\/\*[\s\S]*?\*\//g, "");
      if (preset.id !== "pixel-signal") {
        expect(block, preset.id).not.toMatch(/Pixelify Sans/);
      }
    }
  });

  it("falls back to the Instrument preset for unknown ids", () => {
    expect(fontPresetById("nope").id).toBe("instrument");
    expect(fontPresetById(undefined).id).toBe("instrument");
  });
});
