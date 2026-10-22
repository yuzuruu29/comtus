import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Semantic tokens are defined once, in tokens.css. Anywhere else is drift:
 *  before this guard, --moon was #8c7e6d in index.css, var(--px-moon) in two
 *  skins, and a blue that no longer existed in BRAND.md. */
const TOKENS = [
  "--ground",
  "--surface",
  "--raised",
  "--ink",
  "--muted",
  "--hairline",
  "--hairline-strong",
  "--brass",
  "--brass-deep",
  "--brass-pale",
  "--leather",
  "--moon",
  "--sage",
  "--rust",
  "--candle",
];

const TOKENS_CSS = "src/styles/tokens.css";

/** Files still allowed to redefine a semantic token. Task 1.2 retired the
 *  --px-* layer, so this is empty and must stay that way. Shrink only. */
const REDEFINE_DEBT: string[] = [];

/** Files still carrying raw hex, each with the task that removes them.
 *  This list may shrink. It may never grow. */
const HEX_DEBT: Record<string, string> = {
  "src/index.css": "5 theme-independent literals in @theme: a permanently dark panel, plus the two reading tones the landing needs regardless of theme",
};

function cssFiles(): string[] {
  const root = process.cwd();
  return readdirSync(join(root, "src"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".css"))
    .map((rel) => `src/${rel.split("\\").join("/")}`);
}

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

describe("design tokens", () => {
  it("defines every semantic token only in tokens.css", () => {
    const offenders: string[] = [];
    for (const rel of cssFiles()) {
      if (rel === TOKENS_CSS || REDEFINE_DEBT.includes(rel)) continue;
      const src = read(rel);
      const redefined = TOKENS.filter((t) => new RegExp(`^\\s*${t}:`, "m").test(src));
      if (redefined.length) offenders.push(`${rel}: ${redefined.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps hex literals out of component CSS", () => {
    const offenders = cssFiles()
      .filter((rel) => rel !== TOKENS_CSS && !(rel in HEX_DEBT))
      .filter((rel) => /#[0-9a-f]{3,8}\b/i.test(stripComments(read(rel))));
    expect(offenders).toEqual([]);
  });

  it("has no legacy pixel theme hooks", () => {
    // The pixel look is an accent chrome (html[data-chrome="pixel"]), never a
    // palette override keyed off data-pixel / data-landing-pixel.
    const offenders = cssFiles().filter((rel) => /data-pixel|data-landing-pixel/.test(read(rel)));
    expect(offenders).toEqual([]);
  });

  it("lists no debt for a file that is already clean", () => {
    // Keeps the allow-list honest: an entry that no longer has hex must go.
    const stale = Object.keys(HEX_DEBT).filter((rel) => {
      try {
        return !/#[0-9a-f]{3,8}\b/i.test(stripComments(read(rel)));
      } catch {
        return true; // file deleted — drop the entry
      }
    });
    expect(stale).toEqual([]);
  });
});
