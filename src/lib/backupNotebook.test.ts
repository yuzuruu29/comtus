import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildNotebookPayload, importBackupText, openNotebookText } from "./backup";
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
    db.attempts.clear(),
    db.highlights.clear(),
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
    await db.attempts.add({ id: `${id}-try`, notebookId: id, generationId: `${id}-quiz`, kind: "quiz", scope: "full", score: 1, total: 2, items: [], finishedAt: NOW });
    await db.highlights.add({ id: `${id}-mark`, notebookId: id, sourceId: `${id}-src`, start: 0, end: 4, quote: "text", note: "", createdAt: NOW, updatedAt: NOW });
  }
}

describe("notebook export", () => {
  beforeEach(seed);

  it("holds exactly one notebook and everything attached to it", async () => {
    const payload = await buildNotebookPayload("keep");
    expect(payload).toMatchObject({ app: "comtus", schema: 2, scope: "notebook" });
    const data = payload.data!;
    for (const table of ["notebooks", "sources", "chunks", "messages", "chatSessions", "generations", "cardProgress", "attempts", "highlights"] as const) {
      expect(data[table], table).toHaveLength(1);
      expect(JSON.stringify(data[table])).not.toContain("other");
    }
  });

  it("restores through the ordinary backup import", async () => {
    const json = JSON.stringify(await buildNotebookPayload("keep"));
    for (const t of [db.notebooks, db.sources, db.chunks, db.messages, db.chatSessions, db.generations, db.cardProgress, db.attempts, db.highlights]) {
      await t.clear();
    }

    expect(await importBackupText(json)).toBe(9);
    expect(await db.attempts.get("keep-try")).toBeDefined();
    expect(await db.highlights.get("keep-mark")).toBeDefined();
    expect(await db.notebooks.get("keep")).toMatchObject({ name: "Notebook keep" });
    expect(await db.messages.where("notebookId").equals("keep").count()).toBe(1);
    expect(await db.cardProgress.get("keep-deck:c0")).toBeDefined();
    expect(await db.notebooks.get("other")).toBeUndefined();
  });

  it("explains a notebook that is gone", async () => {
    await expect(buildNotebookPayload("missing")).rejects.toThrow(/no longer on this device/);
  });
});

describe("opening a notebook file", () => {
  beforeEach(seed);

  it("brings a notebook that isn't here in as it was", async () => {
    const json = JSON.stringify(await buildNotebookPayload("keep"));
    await db.transaction("rw", [db.notebooks, db.sources, db.chunks, db.messages, db.chatSessions, db.generations, db.cardProgress, db.attempts, db.highlights], async () => {
      for (const t of [db.notebooks, db.sources, db.chunks, db.messages, db.chatSessions, db.generations, db.cardProgress, db.attempts, db.highlights]) {
        await t.where("id").startsWith("keep").delete();
      }
    });
    expect(await openNotebookText(json)).toEqual({ kind: "notebook", notebookId: "keep", name: "Notebook keep", copied: false });
    expect(await db.cardProgress.get("keep-deck:c0")).toBeDefined();
  });

  it("opens a notebook that is already here as a linked copy", async () => {
    await db.messages.update("keep-m1", { citations: [{ documentIndex: 0, sourceId: "keep-src", sourceTitle: "Lecture", citedText: "ATP" }] });
    await db.generations.add({
      id: "misses-keep",
      notebookId: "keep",
      kind: "flashcards",
      title: "Missed questions",
      payload: { cards: [{ id: "m-keep-quiz-q-1", front: "Q", back: "A" }] },
      createdAt: NOW,
    });
    await db.generations.add({ id: "keep-quiz", notebookId: "keep", kind: "quiz", title: "Quiz", payload: { questions: [] }, createdAt: NOW });
    const json = JSON.stringify(await buildNotebookPayload("keep"));
    const before = await db.sources.count();

    const opened = await openNotebookText(json);
    expect(opened).toMatchObject({ kind: "notebook", name: "Notebook keep (copy)", copied: true });
    const id = (opened as { notebookId: string }).notebookId;
    expect(id).not.toBe("keep");
    expect(await db.sources.count()).toBe(before + 1);
    // The original is untouched.
    expect(await db.notebooks.get("keep")).toMatchObject({ name: "Notebook keep" });

    const [source] = await db.sources.where("notebookId").equals(id).toArray();
    const [chunk] = await db.chunks.where("notebookId").equals(id).toArray();
    expect(chunk).toMatchObject({ id: `${source.id}:0`, sourceId: source.id });
    const [session] = await db.chatSessions.where("notebookId").equals(id).toArray();
    const [message] = await db.messages.where("notebookId").equals(id).toArray();
    expect(message.sessionId).toBe(session.id);
    expect(message.citations?.[0].sourceId).toBe(source.id);
    const [mark] = await db.highlights.where("notebookId").equals(id).toArray();
    expect(mark.sourceId).toBe(source.id);

    const gens = await db.generations.where("notebookId").equals(id).toArray();
    const deck = gens.find((g) => g.title === "Deck")!;
    const quiz = gens.find((g) => g.kind === "quiz")!;
    const misses = gens.find((g) => g.title === "Missed questions")!;
    expect(misses.id).toBe(`misses-${id}`);
    expect((misses.payload as { cards: { id: string }[] }).cards[0].id).toBe(`m-${quiz.id}-q-1`);
    const [progress] = await db.cardProgress.where("notebookId").equals(id).toArray();
    expect(progress).toMatchObject({ id: `${deck.id}:c0`, generationId: deck.id });
    const [attempt] = await db.attempts.where("notebookId").equals(id).toArray();
    expect(attempt.generationId).toBe(quiz.id);
  });

  it("restores a full backup as before", async () => {
    const backup = JSON.stringify({ app: "comtus", schema: 2, data: { notebooks: [{ id: "x", name: "X", createdAt: 1, updatedAt: 1 }] } });
    expect(await openNotebookText(backup)).toEqual({ kind: "backup", count: 1 });
  });
});
