import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_READING, READING_OPTIONS, READING_SIZES, isReadingSize } from "./fontPresets";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../styles/font-presets.css"),
  "utf8",
);

const sizeFor = (id: string): string =>
  new RegExp(`html\\[data-reading="${id}"\\]\\s*\\{[^}]*--text-read:\\s*([^;]+);`)
    .exec(css)?.[1]
    .trim() ?? "";

describe("reading size", () => {
  it("offers exactly three sizes, smallest first", () => {
    expect([...READING_SIZES]).toEqual(["compact", "comfortable", "large"]);
    expect(READING_OPTIONS.map((o) => o.id)).toEqual([...READING_SIZES]);
  });

  it("defaults to the middle size", () => {
    expect(DEFAULT_READING).toBe("comfortable");
  });

  it("maps every size to --text-read in CSS, and the labels do not lie", () => {
    for (const option of READING_OPTIONS) {
      expect(sizeFor(option.id), `${option.id} in CSS`).toBe(option.size);
    }
  });

  it("gets monotonically larger", () => {
    const rems = READING_OPTIONS.map((o) => parseFloat(o.size));
    expect(rems).toEqual([...rems].sort((a, b) => a - b));
    expect(new Set(rems).size).toBe(rems.length);
  });

  it("rejects anything that is not a reading size", () => {
    expect(isReadingSize("comfortable")).toBe(true);
    // The four font systems this replaced must not survive a migration.
    expect(isReadingSize("instrument")).toBe(false);
    expect(isReadingSize("pixel-signal")).toBe(false);
    expect(isReadingSize(undefined)).toBe(false);
  });
});
