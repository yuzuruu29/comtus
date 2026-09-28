import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, deleteNotebook, deleteSource } from "./db";
import {
  addHighlight,
  highlightCounts,
  highlightsMarkdown,
  listSourceHighlights,
  passagePrompt,
  planHighlight,
  removeHighlight,
  setHighlightNote,
  tidyRange,
} from "./highlights";
import type { Highlight, Source } from "./types";

const content = "Mitochondria make ATP through cellular respiration. Ribosomes build proteins.";

const source: Source = {
  id: "s1",
  notebookId: "nb1",
  title: "Cells",
  kind: "paste",
  content,
  chars: content.length,
  tokens: 20,
  addedAt: 1,
};

const hl = (id: string, start: number, end: number, note = ""): Highlight => ({
  id,
  notebookId: "nb1",
  sourceId: "s1",
  start,
  end,
  quote: content.slice(start, end),
  note,
  createdAt: 1,
  updatedAt: 1,
});

describe("tidyRange", () => {
  it("trims whitespace and completes words cut in half", () => {
    const start = content.indexOf("tochondria");
    const r = tidyRange(content, start, start + 14); // "tochondria mak"
    expect(r && content.slice(r.start, r.end)).toBe("Mitochondria make");
  });

  it("leaves a clean selection alone and rejects an empty one", () => {
    const start = content.indexOf("ATP");
    expect(tidyRange(content, start, start + 3)).toEqual({ start, end: start + 3 });
    expect(tidyRange(content, 12, 13)).toBeNull(); // a single space
  });

  it("doesn't grow selections in scripts without spaces", () => {
    const text = "細胞は生命の基本単位です。";
    expect(tidyRange(text, 2, 5)).toEqual({ start: 2, end: 5 });
  });

  it("accepts a backwards range", () => {
    expect(tidyRange(content, 17, 13)).toEqual({ start: 13, end: 17 });
  });
});

describe("planHighlight", () => {
  it("merges every highlight the new range touches and keeps their notes", () => {
    const existing = [hl("a", 0, 12, "first"), hl("b", 18, 21, "second"), hl("c", 60, 70)];
    const plan = planHighlight(existing, 10, 20);
    expect(plan.start).toBe(0);
    expect(plan.end).toBe(21);
    expect(plan.absorbed.map((h) => h.id)).toEqual(["a", "b"]);
    expect(plan.note).toBe("first\n\nsecond");
  });

  it("is a plain new range when nothing overlaps", () => {
    const plan = planHighlight([hl("a", 0, 5)], 20, 30);
    expect(plan).toEqual({ start: 20, end: 30, note: "", absorbed: [] });
  });
});

describe("highlight storage", () => {
  beforeEach(async () => {
    await db.highlights.clear();
    await db.sources.clear();
    await db.notebooks.clear();
    await db.notebooks.put({ id: "nb1", name: "Bio", createdAt: 1, updatedAt: 1 });
    await db.sources.put(source);
  });

  it("adds, merges, notes and removes highlights", async () => {
    const first = await addHighlight(source, 0, 12, 100);
    expect(first?.quote).toBe("Mitochondria");
    await setHighlightNote(first!.id, "  the powerhouse  ", 200);

    // Overlapping the first keeps its id and its note.
    const merged = await addHighlight(source, 8, 17, 300);
    expect(merged?.id).toBe(first!.id);
    expect(merged?.quote).toBe("Mitochondria make");
    expect(merged?.note).toBe("the powerhouse");

    await addHighlight(source, content.indexOf("Ribosomes"), content.length, 400);
    const rows = await listSourceHighlights("s1");
    expect(rows.map((h) => h.quote)).toEqual(["Mitochondria make", "Ribosomes build proteins."]);
    expect((await highlightCounts("nb1")).get("s1")).toBe(2);

    await removeHighlight(rows[1].id);
    expect(await listSourceHighlights("s1")).toHaveLength(1);
  });

  it("goes away with its source or notebook", async () => {
    await addHighlight(source, 0, 12);
    await deleteSource("s1");
    expect(await db.highlights.count()).toBe(0);

    await db.sources.put(source);
    await addHighlight(source, 0, 12);
    await deleteNotebook("nb1");
    expect(await db.highlights.count()).toBe(0);
  });
});

describe("sharing highlights", () => {
  it("writes a Markdown note with quotes, notes and pages", () => {
    const md = highlightsMarkdown("Cells", [hl("a", 0, 12, "the powerhouse"), hl("b", 52, 61)], (at) =>
      at < 50 ? 3 : undefined,
    );
    expect(md).toBe("From “Cells”.\n\n> Mitochondria (p. 3)\n\nthe powerhouse\n\n> Ribosomes");
  });

  it("opens a chat question with the passage quoted on one line", () => {
    expect(passagePrompt("Cells", "Mitochondria\nmake ATP")).toBe(
      "About this passage from “Cells”:\n> Mitochondria make ATP\n\n",
    );
    expect(passagePrompt("Long", "word ".repeat(400)).length).toBeLessThan(1300);
  });
});
