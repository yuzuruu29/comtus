import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Tailwind's stock palette bypasses the BRAND master palette (BRAND.md 3).
 *  Use the semantic tokens instead: brass / brassdeep / brasspale / moon /
 *  moondeep / sage / rust / candle / ink / muted / hairline / surface. */
const STOCK =
  /\b(?:bg|text|border|from|to|via|ring|shadow|accent|decoration|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

/** Exempt, with reasons. Not a dumping ground. */
const ALLOW = new Set([
  // User-facing focus-beacon colour picker: seven named user choices
  // ("Amber Glow", "Deep Review", ...), deliberate variety rather than chrome.
  "src/studio/companion/StudyFocusDock.tsx",
  // Not reachable from main.tsx; kept for reference only.
  "src/landing/ComtusShowcase.tsx",
]);

describe("brand palette", () => {
  it("uses BRAND tokens instead of Tailwind's stock palette", () => {
    const root = process.cwd();
    const files = readdirSync(join(root, "src"), {
      recursive: true,
      encoding: "utf8",
    }).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"));

    const offenders: string[] = [];
    for (const rel of files) {
      const norm = `src/${rel.split("\\").join("/")}`;
      if (ALLOW.has(norm)) continue;
      const hits = readFileSync(join(root, norm), "utf8").match(STOCK);
      if (hits) offenders.push(`${norm}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });
});
