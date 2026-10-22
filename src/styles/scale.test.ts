import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Arbitrary pixel type sizes bypass the ladder in spec 5.2, and are how the
 *  studio ended up with dozens of near-identical sizes. This is a ratchet: it
 *  is green at today's count and may only ever go down. Target is 0 outside
 *  src/landing; each time you remove one, lower CEILING to match. */
const CEILING = 398;

const ARBITRARY = /text-\[[0-9.]+px\]/g;

function tsxFiles(): string[] {
  const root = process.cwd();
  return readdirSync(join(root, "src"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((rel) => `src/${rel.split("\\").join("/")}`)
    .filter((rel) => !rel.startsWith("src/landing/"));
}

describe("type scale", () => {
  it(`uses no more than ${CEILING} arbitrary pixel sizes outside src/landing`, () => {
    const root = process.cwd();
    let count = 0;
    for (const rel of tsxFiles()) {
      count += (readFileSync(join(root, rel), "utf8").match(ARBITRARY) ?? []).length;
    }
    expect(count).toBeLessThanOrEqual(CEILING);
  });

  it("has a current CEILING", () => {
    // Only ever fails to say "you moved the number, re-pin it". That is good
    // news, so it is a separate test from the ceiling above rather than a
    // second assertion inside it, where it reads as a regression.
    const root = process.cwd();
    let count = 0;
    for (const rel of tsxFiles()) {
      count += (readFileSync(join(root, rel), "utf8").match(ARBITRARY) ?? []).length;
    }
    expect(
      count,
      `the count is now ${count} - lower CEILING to match`
    ).toBe(CEILING);
  });
});
