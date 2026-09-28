import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { listDueDecks, loadDeckProgress, purgeDeckProgress, recordRating } from "./reviews";
import { DAY_MS } from "./srs";
import type { Generation } from "./types";

const NOON = new Date(2026, 8, 28, 12, 0, 0).getTime();

const deck = (id: string, notebookId: string, cardIds: string[], title = `Deck ${id}`): Generation => ({
  id,
  notebookId,
  kind: "flashcards",
  title,
  payload: { cards: cardIds.map((c) => ({ id: c, front: `Q ${c}`, back: `A ${c}` })) },
  createdAt: NOON,
});

describe("flashcard reviews", () => {
  beforeEach(async () => {
    await Promise.all([db.notebooks.clear(), db.generations.clear(), db.cardProgress.clear()]);
    await db.notebooks.bulkAdd([
      { id: "nb-1", name: "Pharmacology", createdAt: NOON, updatedAt: NOON },
      { id: "nb-2", name: "Anatomy", createdAt: NOON, updatedAt: NOON },
    ]);
    await db.generations.bulkAdd([deck("g-1", "nb-1", ["c0", "c1", "c2"]), deck("g-2", "nb-2", ["c0", "c1"])]);
  });

  it("records a rating and reads it back by card id", async () => {
    await recordRating({ id: "g-1", notebookId: "nb-1" }, "c1", "good", NOON);
    const progress = await loadDeckProgress("g-1");
    expect([...progress.keys()]).toEqual(["c1"]);
    expect(progress.get("c1")).toMatchObject({ id: "g-1:c1", intervalDays: 1, reps: 1 });
  });

  it("builds on the previous rating", async () => {
    await recordRating({ id: "g-1", notebookId: "nb-1" }, "c0", "good", NOON);
    const second = await recordRating({ id: "g-1", notebookId: "nb-1" }, "c0", "good", NOON + DAY_MS);
    expect(second.reps).toBe(2);
    expect(second.intervalDays).toBeGreaterThan(1);
  });

  it("lists decks with due reviews, most due first, and skips unstarted decks", async () => {
    await recordRating({ id: "g-1", notebookId: "nb-1" }, "c0", "good", NOON);
    await recordRating({ id: "g-1", notebookId: "nb-1" }, "c1", "good", NOON);
    await recordRating({ id: "g-2", notebookId: "nb-2" }, "c0", "good", NOON);
    // Not due yet.
    expect(await listDueDecks(NOON)).toEqual([]);

    const later = NOON + 2 * DAY_MS;
    expect(await listDueDecks(later)).toEqual([
      { generationId: "g-1", notebookId: "nb-1", notebookName: "Pharmacology", title: "Deck g-1", due: 2, total: 3 },
      { generationId: "g-2", notebookId: "nb-2", notebookName: "Anatomy", title: "Deck g-2", due: 1, total: 2 },
    ]);
  });

  it("ignores progress for deleted decks and removed cards", async () => {
    await recordRating({ id: "g-1", notebookId: "nb-1" }, "c0", "good", NOON);
    await db.cardProgress.put({
      id: "g-1:gone",
      generationId: "g-1",
      notebookId: "nb-1",
      ease: 2.5,
      intervalDays: 1,
      dueAt: NOON,
      reps: 1,
    });
    await recordRating({ id: "g-2", notebookId: "nb-2" }, "c0", "good", NOON);
    await db.generations.delete("g-2");

    const due = await listDueDecks(NOON + 2 * DAY_MS);
    expect(due.map((d) => [d.generationId, d.due])).toEqual([["g-1", 1]]);
  });

  it("purges a deck's schedule only once the deck is really gone", async () => {
    await recordRating({ id: "g-1", notebookId: "nb-1" }, "c0", "good", NOON);
    await purgeDeckProgress("g-1");
    expect(await db.cardProgress.count()).toBe(1);

    await db.generations.delete("g-1");
    await purgeDeckProgress("g-1");
    expect(await db.cardProgress.count()).toBe(0);
  });
});
