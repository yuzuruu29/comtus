import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { foldForSearch, hitHref, isSearchable, loadLibrarySnapshot, searchSnapshot } from "./librarySearch";

describe("folding", () => {
  it("drops case and accents without moving characters", () => {
    const text = "Résumé of the NIÑO — 光合作用";
    const folded = foldForSearch(text);
    expect(folded).toBe("resume of the nino — 光合作用");
    expect(folded.length).toBe(text.length);
  });

  it("knows when a query is worth running", () => {
    expect(isSearchable("a")).toBe(false);
    expect(isSearchable("at")).toBe(true);
    expect(isSearchable("水")).toBe(true);
  });
});

describe("library search", () => {
  beforeEach(async () => {
    await Promise.all(
      [db.notebooks, db.sources, db.chatSessions, db.messages, db.generations, db.highlights].map((t) => t.clear()),
    );
    await db.notebooks.bulkAdd([
      { id: "nb-1", name: "Pharmacology", createdAt: 1, updatedAt: 1 },
      { id: "nb-2", name: "Biology", createdAt: 1, updatedAt: 1 },
    ]);
    await db.sources.bulkAdd([
      {
        id: "s-1",
        notebookId: "nb-1",
        title: "Anticoagulants lecture",
        kind: "txt",
        content: "Heparin works fast.\\n\\nWarfarin inhibits vitamin K epoxide reductase and is monitored with the INR.",
        chars: 90,
        tokens: 20,
        addedAt: 5,
      },
      { id: "s-2", notebookId: "nb-2", title: "光合作用ノート", kind: "txt", content: "葉緑体で光合作用が起こる。", chars: 12, tokens: 4, addedAt: 4 },
      { id: "s-orphan", notebookId: "gone", title: "Warfarin orphan", kind: "txt", content: "warfarin", chars: 8, tokens: 2, addedAt: 1 },
    ]);
    await db.chatSessions.add({ id: "chat-1", notebookId: "nb-1", title: "INR targets", createdAt: 1, updatedAt: 9 });
    await db.messages.bulkAdd([
      { id: "m-1", notebookId: "nb-1", sessionId: "chat-1", role: "user", content: "What INR range for warfarin?", createdAt: 1 },
      { id: "m-2", notebookId: "nb-1", sessionId: "chat-1", role: "assistant", content: "Usually 2 to 3.", createdAt: 2 },
    ]);
    await db.generations.bulkAdd([
      { id: "note-1", notebookId: "nb-1", kind: "note", title: "Café notes", payload: { content: "Protamine reverses heparin." }, createdAt: 3 },
      {
        id: "deck-1",
        notebookId: "nb-1",
        kind: "flashcards",
        title: "Flashcards · 1",
        payload: { cards: [{ id: "c0", front: "Warfarin antidote?", back: "Vitamin K" }] },
        createdAt: 2,
      },
    ]);
  });

  it("finds a word across sources, saved work and conversations", async () => {
    const hits = searchSnapshot(await loadLibrarySnapshot(), "warfarin");
    expect(hits.map((h) => [h.group, h.id])).toEqual([
      ["Sources", "source-s-1"],
      ["Saved work", "work-deck-1"],
      ["Conversations", "chat-chat-1"],
    ]);
    expect(hits[0].notebookName).toBe("Pharmacology");
  });

  it("requires every word and points into the source at the match", async () => {
    const snapshot = await loadLibrarySnapshot();
    const [hit] = searchSnapshot(snapshot, "vitamin reductase");
    expect(hit.id).toBe("source-s-1");
    expect(hit.target).toEqual({ kind: "source", sourceId: "s-1", at: expect.any(Number) });
    const at = (hit.target as { at: number }).at;
    expect("Heparin works fast.\\n\\nWarfarin inhibits vitamin K epoxide reductase".slice(at, at + 7)).toBe("vitamin");
    expect(hit.snippet!.text.slice(hit.snippet!.start, hit.snippet!.end)).toBe("vitamin");
    expect(searchSnapshot(snapshot, "vitamin nonsense")).toEqual([]);
  });

  it("matches accents, titles and unspaced scripts", async () => {
    const snapshot = await loadLibrarySnapshot();
    expect(searchSnapshot(snapshot, "cafe").map((h) => h.id)).toEqual(["work-note-1"]);
    expect(searchSnapshot(snapshot, "光合作用").map((h) => h.id)).toEqual(["source-s-2"]);
  });

  it("finds margin notes and opens the reader at their passage", async () => {
    await db.highlights.bulkAdd([
      {
        id: "h-1",
        notebookId: "nb-1",
        sourceId: "s-1",
        start: 20,
        end: 28,
        quote: "Warfarin",
        note: "Check the antidote before the exam",
        createdAt: 1,
        updatedAt: 7,
      },
      // A plain highlight has no words of its own to find.
      { id: "h-2", notebookId: "nb-1", sourceId: "s-1", start: 0, end: 7, quote: "Heparin", note: "", createdAt: 1, updatedAt: 1 },
    ]);
    const hits = searchSnapshot(await loadLibrarySnapshot(), "antidote");
    expect(hits.map((h) => [h.id, h.title])).toEqual([
      ["note-h-1", "Your note on Anticoagulants lecture"],
      ["work-deck-1", "Flashcards · 1"],
    ]);
    expect(hitHref(hits[0])).toBe("/studio/nb-1?source=s-1&at=20");
    expect(searchSnapshot(await loadLibrarySnapshot(), "heparin").map((h) => h.id)).not.toContain("note-h-2");
  });

  it("links each kind of hit to the right place", async () => {
    const hits = searchSnapshot(await loadLibrarySnapshot(), "warfarin");
    expect(hits.map(hitHref)).toEqual([
      `/studio/nb-1?source=s-1&at=${(hits[0].target as { at: number }).at}`,
      "/studio/nb-1?work=deck-1",
      "/studio/nb-1?chat=chat-1",
    ]);
  });
});
