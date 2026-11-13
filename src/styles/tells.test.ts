import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The generated-UI tells, enforced.
 *
 *  Spec 5.3 and 5.4 list the patterns that make an interface read as templated:
 *  uppercase-tracked mono labels, arrows appended to labels, retired hype
 *  vocabulary. Each one below is a rule with a number, not a judgement call.
 *
 *  Two kinds of rule live here. The first three are hard zeros: nothing in the
 *  tree may violate them, so a new violation fails the build. The last two are
 *  ratchets with a ceiling: the count may only go down, and a separate test
 *  asks you to re-pin the number when you have moved it. Neither ratchet can
 *  fail because you fixed something.
 */

const ROOT = process.cwd();

function tsxFiles(): string[] {
  return readdirSync(join(ROOT, "src"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((rel) => `src/${rel.split("\\").join("/")}`);
}

function cssFiles(): string[] {
  return readdirSync(join(ROOT, "src"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".css"))
    .map((rel) => `src/${rel.split("\\").join("/")}`);
}

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/* ── Rule 1 · spec 5.3 (2): no all-caps tracked mono label ─────────────── */

describe("tell: the uppercase mono label", () => {
  it("ships no .label-mono class", () => {
    const offenders = [...tsxFiles(), ...cssFiles()].filter((rel) =>
      read(rel).includes("label-mono")
    );
    expect(offenders).toEqual([]);
  });
});

/* ── Rule 2 · spec 5.3 (5): no arrow appended to a button or link ───────── */

/** `→` is legal only as a quoted menu path ("Settings → Models"), which is a
 *  path through a UI the reader already has. Each entry says which. Shrink only. */
const ARROW_PATH_ALLOW: Record<string, string> = {
  "src/checkout/HostedCheckout.tsx": "quotes the Desktop menu path",
  "src/studio/DeviceTransfer.tsx": "quotes the Open menu item",
  "src/studio/ExportMenu.tsx": "quotes Anki's own File menu",
  "src/studio/generators/DeckImport.tsx": "quotes Anki's own File menu",
};

describe("tell: arrows on labels", () => {
  it("ships no ↗ or ↳ glyph, in markup or in CSS content", () => {
    // Both were the "arrow tacked onto the end of a button" device. Neither
    // has a meaning a row cannot carry with its own weight and a brass rule.
    const offenders = [...tsxFiles(), ...cssFiles()].filter((rel) =>
      /[↗↳]/.test(read(rel))
    );
    expect(offenders).toEqual([]);
  });

  it("uses → only inside an allow-listed menu path", () => {
    const offenders = tsxFiles().filter(
      (rel) => !(rel in ARROW_PATH_ALLOW) && read(rel).includes("→")
    );
    expect(offenders).toEqual([]);
  });

  it("lists no arrow allowance for a file that no longer needs one", () => {
    const stale = Object.keys(ARROW_PATH_ALLOW).filter((rel) => {
      try {
        return !read(rel).includes("→");
      } catch {
        return true; // file deleted - drop the entry
      }
    });
    expect(stale).toEqual([]);
  });
});

/* ── Rule 3 · spec 5.4 (voice): no retired hype vocabulary ─────────────── */

/** The words spec 5.4 keeps out of product and marketing copy. */
const HYPE = /\b(cognitive|power[- ]?ups?|unleash|revolutionary|supercharge)\b/i;

/** Copy that legitimately names a third party or a legal document. Shrink only. */
const HYPE_ALLOW: Record<string, string> = {
  "src/landing/StaticPages.tsx": "Acceptable Use terms; 'Google AI Studio' is a vendor name",
};

describe("tell: retired hype vocabulary", () => {
  it("keeps cognitive / power-up / unleash out of product copy", () => {
    const offenders = tsxFiles()
      .filter((rel) => !(rel in HYPE_ALLOW))
      .filter((rel) => HYPE.test(read(rel)));
    expect(offenders).toEqual([]);
  });
});

/* ── Ratchets: real debt, a ceiling that only goes down ────────────────── */

/** Every uppercase mono badge and kicker is now a sentence-case label in the
 *  UI face. The one remaining match is a comment in Composer.tsx explaining
 *  why that line is prose. Do not add another. */
const UPPERCASE_CEILING = 1;

/** 37 uses of the middle-dot joiner. Most are a genuine third fact in a list
 *  where a second line or a pill would read better. Target 0. The quiz and
 *  exam item headers now set item, topic and kind as separate spans. */
const MIDDOT_CEILING = 37;

function count(rel: string, needle: string): number {
  return read(rel).split(needle).length - 1;
}

describe("ratchet: tells that still have a debt", () => {
  it(`uses no more than ${UPPERCASE_CEILING} uppercase labels`, () => {
    const total = tsxFiles().reduce((n, rel) => n + count(rel, "uppercase"), 0);
    expect(total).toBeLessThanOrEqual(UPPERCASE_CEILING);
  });

  it(`uses no more than ${MIDDOT_CEILING} middle-dot joiners`, () => {
    const total = tsxFiles().reduce((n, rel) => n + count(rel, " · "), 0);
    expect(total).toBeLessThanOrEqual(MIDDOT_CEILING);
  });

  it("has current ratchet numbers", () => {
    // Fails only to say "you moved the number, re-pin it". This is good news,
    // which is why it is a separate test from the ceilings above.
    const uppercase = tsxFiles().reduce((n, rel) => n + count(rel, "uppercase"), 0);
    const middot = tsxFiles().reduce((n, rel) => n + count(rel, " · "), 0);
    expect(uppercase, `uppercase is now ${uppercase} - lower UPPERCASE_CEILING`).toBe(
      UPPERCASE_CEILING
    );
    expect(middot, `middle dot is now ${middot} - lower MIDDOT_CEILING`).toBe(MIDDOT_CEILING);
  });
});