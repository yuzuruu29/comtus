import Dexie, { type Table } from "dexie";
import type {
  Notebook,
  Source,
  Chunk,
  ChatMessage,
  Generation,
  CardProgress,
} from "./types";

/** Local-first store. Everything lives in IndexedDB on this device.
 *  (Settings live in localStorage via zustand — not here.) */
class ComtusDB extends Dexie {
  notebooks!: Table<Notebook, string>;
  sources!: Table<Source, string>;
  chunks!: Table<Chunk, string>;
  messages!: Table<ChatMessage, string>;
  generations!: Table<Generation, string>;
  cardProgress!: Table<CardProgress, string>;

  constructor() {
    super("comtus");
    this.version(1).stores({
      notebooks: "id, updatedAt",
      sources: "id, notebookId, addedAt",
      chunks: "id, sourceId, notebookId",
      messages: "id, notebookId, createdAt",
      generations: "id, notebookId, kind, createdAt",
      cardProgress: "id, generationId, notebookId, dueAt",
    });
  }
}

export const db = new ComtusDB();

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/* ── Notebooks ────────────────────────────────────────────── */

export async function createNotebook(name: string): Promise<Notebook> {
  const now = Date.now();
  const nb: Notebook = { id: uid(), name, createdAt: now, updatedAt: now };
  await db.notebooks.add(nb);
  return nb;
}

export async function touchNotebook(id: string) {
  await db.notebooks.update(id, { updatedAt: Date.now() });
}

export async function deleteNotebook(id: string) {
  await db.transaction(
    "rw",
    [db.notebooks, db.sources, db.chunks, db.messages, db.generations, db.cardProgress],
    async () => {
      await db.notebooks.delete(id);
      await db.sources.where("notebookId").equals(id).delete();
      await db.chunks.where("notebookId").equals(id).delete();
      await db.messages.where("notebookId").equals(id).delete();
      await db.generations.where("notebookId").equals(id).delete();
      await db.cardProgress.where("notebookId").equals(id).delete();
    },
  );
}

/* ── Sources ──────────────────────────────────────────────── */

export async function addSourceWithChunks(
  source: Source,
  chunks: Chunk[],
): Promise<void> {
  await db.transaction("rw", db.sources, db.chunks, async () => {
    await db.sources.put(source);
    await db.chunks.bulkPut(chunks);
  });
  await touchNotebook(source.notebookId);
}

export async function deleteSource(sourceId: string) {
  await db.transaction("rw", db.sources, db.chunks, async () => {
    await db.sources.delete(sourceId);
    await db.chunks.where("sourceId").equals(sourceId).delete();
  });
}

/* ── Messages & generations ───────────────────────────────── */

export async function saveMessage(msg: ChatMessage) {
  await db.messages.put(msg);
  await touchNotebook(msg.notebookId);
}

export async function saveGeneration(gen: Generation) {
  await db.generations.put(gen);
  await touchNotebook(gen.notebookId);
}
