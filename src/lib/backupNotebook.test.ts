import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildNotebookPayload, importBackupText } from "./backup";
import { db } from "./db";

const NOW = 1_790_000_000_000;

async function seed() {
  await Promise.all([
    db.notebooks.clear(),
    db.sources.clear(),
    db.chunks.clear(),
    db.messages.clear(),
    db.chatSessions.clear(),
    db.generations.clear(),
    db.cardProgress.clear(),
  ]);
  for (const id of ["keep", "other"]) {
    await db.notebooks.add({ id, name: `Notebook ${id}`, createdAt: NOW, updatedAt: NOW });
    await db.sources.add({
      id: `${id}-src`,
      notebookId: id,
      title: "Lecture",
      kind: "txt",
      content: "Mitochondria make ATP.",
      chars: 22,
      tokens: 6,
      addedAt: NOW,
    });
    await db.chunks.add({ id: `${id}-src:0`, sourceId: `${id}-src`, notebookId: id, idx: 0, text: "Mitochondria make ATP.", tokens: 6 });
    await db.chatSessions.add({ id: `${id}-chat`, notebookId: id, title: "Energy", createdAt: NOW, updatedAt: NOW });
    await db.messages.add({ id: `${id}-m1`, notebookId: id, sessionId: `${id}-chat`, role: "user", content: "What makes ATP?", createdAt: NOW });
    await db.generations.add({ id: `${id}-deck`, notebookId: id, kind: "flashcards", title: "Deck", payload: { cards: [] }, createdAt: NOW });
    await db.cardProgress.add({ id: `${id}-deck:c0`, generationId: `${id}-deck`, notebookId: id, ease: 2.5, intervalDays: 1, dueAt: NOW, reps: 1 });
  }
}

describe("notebook export", () => {
  beforeEach(seed);

  it("holds exactly one notebook and everything attached to it", async () => {
    const payload = await buildNotebookPayload("keep");
    expect(payload).toMatchObject({ app: "comtus", schema: 2, scope: "notebook" });
    const data = payload.data!;
    for (const table of ["notebooks", "sources", "chunks", "messages", "chatSessions", "generations", "cardProgress"] as const) {
      expect(data[table], table).toHaveLength(1);
      expect(JSON.stringify(data[table])).not.toContain("other");
    }
  });

  it("restores through the ordinary backup import", async () => {
    const json = JSON.stringify(await buildNotebookPayload("keep"));
    for (const t of [db.notebooks, db.sources, db.chunks, db.messages, db.chatSessions, db.generations, db.cardProgress]) {
      await t.clear();
    }

    expect(await importBackupText(json)).toBe(7);
    expect(await db.notebooks.get("keep")).toMatchObject({ name: "Notebook keep" });
    expect(await db.messages.where("notebookId").equals("keep").count()).toBe(1);
    expect(await db.cardProgress.get("keep-deck:c0")).toBeDefined();
    expect(await db.notebooks.get("other")).toBeUndefined();
  });

  it("explains a notebook that is gone", async () => {
    await expect(buildNotebookPayload("missing")).rejects.toThrow(/no longer on this device/);
  });
});
