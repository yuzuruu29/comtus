import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Tailwind's stock palette bypasses the BRAND master palette (BRAND.md 3).
 *  Use the semantic tokens instead: brass / brass-deep / brass-pale / moon /
 *  moondeep / sage / rust / candle / ink / muted / hairline / surface. */
const STOCK =
  /\b(?:bg|text|border|from|to|via|ring|shadow|accent|decoration|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

/** Raw hex outside tokens.css. Spec 8 allows it only in SVG sprite artwork,
 *  where a colour IS the asset, and in the self-contained export document,
 *  which is opened away from this app and so cannot read our CSS variables.
 *  This list may shrink. It may never grow. */
const HEX_DEBT: Record<string, string> = {
  "src/components/brand/ComtusLogo.tsx": "SVG wordmark artwork",
  "src/components/icons/StudyGlyph.tsx": "SVG glyph artwork",
  "src/components/pixel/pixelBatteryFrames.tsx": "pixel sprite frames",
  "src/components/pixel/PixelSprite.tsx": "pixel sprite renderer",
  "src/lib/assessmentExport.tsx": "standalone export document, opened outside the app",
};

/** A hex literal, not a `#` that happens to sit inside a word. `#state`
 *  names a field, so a hex only counts when it is introduced by start-of-line,
 *  whitespace, or a delimiter that can precede a colour in code. */
const HEX_CONTEXT = /(?:^|[\s(:,;"'\[{=])(#[0-9a-f]{3,8})\b/gi;

function hexIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(HEX_CONTEXT)) found.push(match[1]);
  return [...new Set(found)];
}

function tsxFiles(): string[] {
  const root = process.cwd();
  return readdirSync(join(root, "src"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((rel) => `src/${rel.split("\\").join("/")}`);
}

describe("brand palette", () => {
  it("uses BRAND tokens instead of Tailwind's stock palette", () => {
    const offenders: string[] = [];
    for (const rel of tsxFiles()) {
      const hits = readFileSync(join(process.cwd(), rel), "utf8").match(STOCK);
      if (hits) offenders.push(`${rel}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps hex literals out of TSX, except SVG sprite and export artwork", () => {
    const offenders: string[] = [];
    for (const rel of tsxFiles()) {
      if (rel in HEX_DEBT) continue;
      const hits = hexIn(readFileSync(join(process.cwd(), rel), "utf8"));
      if (hits.length) offenders.push(`${rel}: ${hits.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("lists no hex debt for a file that is already clean", () => {
    const stale = Object.keys(HEX_DEBT).filter((rel) => {
      try {
        return hexIn(readFileSync(join(process.cwd(), rel), "utf8")).length === 0;
      } catch {
        return true; // file deleted - drop the entry
      }
    });
    expect(stale).toEqual([]);
  });
});
