import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Arbitrary pixel type sizes bypass the ladder in spec 5.2, and are how the
 *  studio ended up with dozens of near-identical sizes. This is a ratchet: it
 *  is green at today's count and may only ever go down. Task 2.5 sets it to 0
 *  outside src/landing, which Task 4.1 rebuilds. */
const CEILING = 533;

/** How far below CEILING the count may drift before the ratchet is stale. */
const SLACK = 25;

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
    expect(count, `CEILING is stale — lower it to ${count}`).toBeGreaterThan(CEILING - SLACK);
  });
});
