import { describe, expect, it } from "vitest";
import {
  blockIndexAt,
  estimatedPage,
  inlineMarkup,
  readerBlocks,
  stripInline,
  styledPieces,
  textRuns,
} from "./readerBlocks";

/** Every block's text must be the exact slice of the content it claims. */
function expectExact(content: string) {
  const blocks = readerBlocks(content);
  for (const b of blocks) expect(content.slice(b.at, b.at + b.text.length)).toBe(b.text);
  return blocks;
}

describe("readerBlocks", () => {
  it("splits Markdown into headings, paragraphs and lists without moving a character", () => {
    const content = [
      "# Cell biology",
      "",
      "The cell is the basic unit of life.",
      "It was first described in 1665.",
      "",
      "## Organelles",
      "",
      "- Nucleus: holds DNA",
      "- Mitochondria: make ATP",
      "  (the powerhouse)",
      "",
      "| Part | Role |",
      "| --- | --- |",
    ].join("\n");
    const blocks = expectExact(content);
    expect(blocks.map((b) => [b.kind, b.text.split("\n")[0]])).toEqual([
      ["heading", "Cell biology"],
      ["prose", "The cell is the basic unit of life."],
      ["heading", "Organelles"],
      ["lines", "- Nucleus: holds DNA"],
      ["lines", "| Part | Role |"],
    ]);
    expect(blocks[0].level).toBe(1);
    expect(blocks[2].level).toBe(2);
    expect(blocks[3].text).toContain("(the powerhouse)");
  });

  it("reflows hard-wrapped PDF pages into paragraphs and tracks page numbers", () => {
    const content = [
      "[page 1]",
      "Photosynthesis turns light into chemical energy that the plant",
      "stores in sugar molecules for later use by the cell.",
      "It happens in the chloroplast.",
      "Chlorophyll absorbs mostly red and blue light and reflects the",
      "green, which is why leaves look green to us.",
      "",
      "[page 2]",
      "The Calvin cycle fixes carbon.",
    ].join("\n");
    const blocks = expectExact(content);
    expect(blocks.map((b) => [b.kind, b.page])).toEqual([
      ["page", 1],
      ["prose", 1],
      ["prose", 1],
      ["page", 2],
      ["prose", 2],
    ]);
    // The short line that ends a sentence closes the first paragraph.
    expect(blocks[1].text.endsWith("It happens in the chloroplast.")).toBe(true);
    expect(blocks[2].text.startsWith("Chlorophyll")).toBe(true);
  });

  it("sets a short title line apart from the body text under it", () => {
    const content = [
      "Chapter 4. Cellular respiration",
      "Cells release the energy stored in glucose through a series of",
      "controlled reactions known as cellular respiration.",
    ].join("\n");
    const blocks = expectExact(content);
    expect(blocks.map((b) => b.text.split("\n")[0])).toEqual([
      "Chapter 4. Cellular respiration",
      "Cells release the energy stored in glucose through a series of",
    ]);
  });

  it("keeps a wrapped sentence together when the line ends mid-sentence", () => {
    const content = "The mitochondrion is the site of cellular\nrespiration, which makes ATP for the\ncell. It also stores calcium.";
    const blocks = expectExact(content);
    expect(blocks).toHaveLength(1);
  });

  it("keeps fenced code, blank lines included, as one block", () => {
    const content = "Before.\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\nAfter.";
    const blocks = expectExact(content);
    expect(blocks.map((b) => b.kind)).toEqual(["prose", "lines", "prose"]);
    expect(blocks[1].text).toContain("const b = 2;");
  });

  it("trims leading and trailing whitespace off prose but keeps offsets exact", () => {
    const content = "\n\n   Indented start.  \r\n\r\nNext paragraph.\r\n";
    const blocks = expectExact(content);
    expect(blocks.map((b) => b.text)).toEqual(["Indented start.", "Next paragraph."]);
  });

  it("breaks a very long unbroken page at a sentence end", () => {
    const line = "This line of the page is about as long as every other printed line.";
    const content = Array.from({ length: 60 }, () => line).join("\n");
    const blocks = expectExact(content);
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((b) => b.text.length < 2400)).toBe(true);
  });

  it("returns nothing for empty text", () => {
    expect(readerBlocks("")).toEqual([]);
    expect(readerBlocks("\n\n  \n")).toEqual([]);
  });
});

describe("blockIndexAt", () => {
  it("finds the block holding an offset, or the one before a gap", () => {
    const content = "First paragraph.\n\nSecond paragraph.";
    const blocks = readerBlocks(content);
    expect(blockIndexAt(blocks, 0)).toBe(0);
    expect(blockIndexAt(blocks, 16)).toBe(0); // the blank line between
    expect(blockIndexAt(blocks, content.indexOf("Second"))).toBe(1);
    expect(blockIndexAt(blocks, 9999)).toBe(1);
  });
});

describe("estimatedPage", () => {
  it("spreads pages evenly when there are no markers", () => {
    expect(estimatedPage(0, 1000, 4)).toBe(1);
    expect(estimatedPage(999, 1000, 4)).toBe(4);
    expect(estimatedPage(10, 1000)).toBeUndefined();
  });
});

describe("textRuns", () => {
  it("cuts a block into plain and highlighted runs", () => {
    const runs = textRuns(100, "The quick brown fox", [
      { id: "a", start: 104, end: 109 },
      { id: "b", start: 116, end: 130 },
    ]);
    expect(runs).toEqual([
      { at: 100, text: "The " },
      { at: 104, text: "quick", mark: "a" },
      { at: 109, text: " brown " },
      { at: 116, text: "fox", mark: "b" },
    ]);
  });

  it("ignores highlights outside the block and clips ones that cross it", () => {
    const runs = textRuns(10, "abcdef", [
      { id: "before", start: 0, end: 5 },
      { id: "cross", start: 8, end: 12 },
      { id: "after", start: 40, end: 50 },
    ]);
    expect(runs).toEqual([
      { at: 10, text: "ab", mark: "cross" },
      { at: 12, text: "cdef" },
    ]);
  });
});

describe("inline Markdown", () => {
  const styled = (text: string) =>
    styledPieces(0, { at: 0, text }, inlineMarkup(text))
      .filter((p) => !p.styles.includes("hide"))
      .map((p) => [p.text, p.styles.join("+")]);

  it("styles bold, italics, code and links and hides their markers", () => {
    expect(styled("A **bold** move, *really*, see `x = 1` and [the docs](https://a.b/c).")).toEqual([
      ["A ", ""],
      ["bold", "strong"],
      [" move, ", ""],
      ["really", "em"],
      [", see ", ""],
      ["x = 1", "code"],
      [" and ", ""],
      ["the docs", "link"],
      [".", ""],
    ]);
  });

  it("nests bold inside a link and leaves arithmetic and snake_case alone", () => {
    expect(styled("[**Key** idea](u)")).toEqual([
      ["Key", "link+strong"],
      [" idea", "link"],
    ]);
    expect(inlineMarkup("2 * 3 * 4 and snake_case_name and a*b*c")).toEqual([]);
    expect(inlineMarkup("`**not bold**`").map((s) => s.style)).toEqual(["hide", "code", "hide"]);
  });

  it("keeps offsets exact: pieces join back into the original text", () => {
    const text = "Plants use the **chloroplast** ([ref](http://x)).";
    const pieces = styledPieces(100, { at: 110, text: text.slice(10) }, inlineMarkup(text));
    expect(pieces.map((p) => p.text).join("")).toBe(text.slice(10));
    for (const p of pieces) expect(text.slice(p.at - 100, p.at - 100 + p.text.length)).toBe(p.text);
  });

  it("strips markers for quotes", () => {
    expect(stripInline("The **chloroplast** holds [chlorophyll](http://x) and `ATP`.")).toBe(
      "The chloroplast holds chlorophyll and ATP.",
    );
  });
});
