import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The landing motion contract, enforced.
 *
 *  src/landing/landing-motion.css is progressive enhancement over a finished
 *  page. Three things keep it that way, and none of them can be checked by eye:
 *
 *  1. Scroll timelines sit behind @supports. Without it, a browser that has no
 *     animation-timeline would run the same keyframes on the document clock,
 *     and a heading would fade in on its own, once, at load.
 *
 *  2. Every animation is gated on a motion budget (BRAND.md 5). If a rule
 *     animates without reading data-motion, the Settings switch stops being
 *     real for that element, and "Minimal" and "None" quietly lie.
 *
 *  3. Keyframes touch only what is cheap to paint. Width, height, margin and
 *     their kin reflow the page on every frame; the landing is mostly type,
 *     so a single one of them is felt immediately on a phone.
 */

const CSS = readFileSync("src/landing/landing-motion.css", "utf8");
const LANDING_CSS = readFileSync("src/landing/landing.css", "utf8");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");

interface Rule {
  prelude: string;
  body: string;
  /** The conditional at-rules this rule sits inside, outermost first. */
  context: string[];
}

/** A small, tolerant CSS reader: enough to tell a rule from the at-rules around it. */
function parse(source: string, context: string[] = [], out: Rule[] = []): Rule[] {
  let from = 0;
  while (from < source.length) {
    const open = source.indexOf("{", from);
    if (open === -1) break;
    const prelude = source.slice(from, open).trim().replace(/\s+/g, " ");
    let depth = 1;
    let end = open + 1;
    while (end < source.length && depth > 0) {
      if (source[end] === "{") depth += 1;
      else if (source[end] === "}") depth -= 1;
      end += 1;
    }
    const body = source.slice(open + 1, end - 1);
    if (/^@(media|supports|starting-style)\b/.test(prelude)) parse(body, [...context, prelude], out);
    else out.push({ prelude, body, context });
    from = end;
  }
  return out;
}

const rules = parse(strip(CSS));
const keyframes = rules.filter((rule) => rule.prelude.startsWith("@keyframes"));
const styleRules = rules.filter((rule) => !rule.prelude.startsWith("@"));

/** Property names declared anywhere in a block, nested keyframe steps included. */
const propertiesIn = (body: string) =>
  [...body.matchAll(/(?:^|[;{\s])(--[\w-]+|[a-z][a-z-]*)\s*:/g)].map((match) => match[1]);

describe("landing motion stylesheet", () => {
  it("reads as the rules and keyframes it is meant to define", () => {
    // A parser that quietly finds nothing would make every check below pass.
    expect(keyframes.length).toBeGreaterThanOrEqual(8);
    expect(styleRules.length).toBeGreaterThanOrEqual(20);
  });

  it("keeps every scroll timeline behind an animation-timeline feature query", () => {
    const withTimeline = styleRules.filter((rule) => /animation-timeline\s*:/.test(rule.body));
    expect(withTimeline.length).toBeGreaterThan(0);
    const exposed = withTimeline
      .filter((rule) => !rule.context.some((query) => /^@supports\b.*animation-timeline/.test(query)))
      .map((rule) => rule.prelude);
    expect(exposed).toEqual([]);
  });

  it("gates every running animation on a motion budget", () => {
    // A rule is running if it names an animation other than "none". "none !important" (the print
    // rule) still counts as stopped. Values are read directly so a trailing space cannot hide one.
    const animationValues = (body: string) =>
      [...body.matchAll(/(?:^|[;\s])animation(?:-name)?\s*:\s*([^;]+)/g)].map((match) => match[1].trim());
    const running = styleRules.filter((rule) => animationValues(rule.body).some((value) => !/^none\b/.test(value)));
    expect(running.length).toBeGreaterThan(0);
    const ungated = running.filter((rule) => !rule.prelude.includes("[data-motion=")).map((rule) => rule.prelude);
    expect(ungated).toEqual([]);
  });

  it("animates only properties that are cheap to paint", () => {
    const ALLOWED = new Set([
      "opacity",
      "transform",
      "clip-path",
      "stroke-dashoffset",
      "background-color",
      "box-shadow",
    ]);
    const offenders = keyframes.flatMap((frame) =>
      propertiesIn(frame.body)
        .filter((property) => !property.startsWith("--") && !ALLOWED.has(property))
        .map((property) => `${frame.prelude}: ${property}`),
    );
    expect(offenders).toEqual([]);
  });

  it("registers --reveal so a row that is not being animated is fully drawn", () => {
    const registration = rules.find((rule) => rule.prelude === "@property --reveal");
    expect(registration?.body).toMatch(/syntax\s*:\s*"<number>"/);
    expect(registration?.body).toMatch(/initial-value\s*:\s*1\b/);
    // The ruled margins that read it must also fall back to "drawn" if the property is unregistered.
    expect(LANDING_CSS).toContain("scaleX(var(--reveal, 1))");
  });

  it("leaves nothing hidden at rest", () => {
    // Opacity 0 may appear inside a keyframe step. As a resting style it is allowed only for the two
    // things that are hidden by design: the closed mobile menu, and the glyph the toggle is not showing.
    const hiddenByDesign = /\.landing-nav-links\b|\.landing-nav-icon-(?:open|close)\b/;
    const offenders = styleRules
      .filter((rule) => /(?:^|[;\s])opacity\s*:\s*0\s*(?:;|$)/.test(rule.body))
      .filter((rule) => !hiddenByDesign.test(rule.prelude))
      .map((rule) => rule.prelude);
    expect(offenders).toEqual([]);
  });
});
