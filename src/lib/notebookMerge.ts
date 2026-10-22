import type { Table as DexieTable } from "dexie";
import { db } from "./db";
import { notifyDeskActivity } from "./activity";
import { chunkText } from "./chunking";
import { estTokens } from "./retrieval";
import { assertBackupOwnership, validateBackupPayload, type BackupPayload } from "./backup";
import type { CardProgress, Chunk, Flashcard, FlashcardsPayload, Generation, Source } from "./types";

/**
 * Merging a notebook that arrives from another device into the same
 * notebook here. Rows are matched by id, so a notebook sent back and forth
 * stays one notebook:
 *
 * - anything only one side has is kept;
 * - notebooks, conversations, highlights and notes keep the newer edit;
 * - a flashcard deck keeps every card either side has;
 * - a card's review history keeps the side that has reviewed it more;
 * - sources, messages and quiz results never change once written.
 *
 * Deleting something on one device doesn't delete it on the other: with
 * no record of deletions, the merge can't tell "deleted there" from "new
 * here".
 */

export interface MergeResult {
  notebookId: string;
  name: string;
  /** The notebook wasn't on this device before. */
  isNew: boolean;
  added: number;
  updated: number;
}

const TABLES = [
  "notebooks",
  "sources",
  "chatSessions",
  "messages",
  "generations",
  "cardProgress",
  "attempts",
  "highlights",
] as const;

type Table = (typeof TABLES)[number];
type Row = { id: string; notebookId?: string } & Record<string, unknown>;

const stamp = (row: Row, field = "updatedAt") => (typeof row[field] === "number" ? (row[field] as number) : 0);

function mergeDeck(local: Generation, incoming: Generation): Generation | null {
  const mine = (local.payload as FlashcardsPayload | undefined)?.cards ?? [];
  const theirs = (incoming.payload as FlashcardsPayload | undefined)?.cards ?? [];
  const have = new Set(mine.map((c) => c.id));
  const extra = theirs.filter((c: Flashcard) => !have.has(c.id));
  const newer = (incoming.updatedAt ?? incoming.createdAt) > (local.updatedAt ?? local.createdAt);
  if (extra.length === 0 && !(newer && incoming.title !== local.title)) return null;
  return {
    ...local,
    title: newer ? incoming.title : local.title,
    payload: { cards: [...mine, ...extra] } satisfies FlashcardsPayload,
    updatedAt: Math.max(local.updatedAt ?? local.createdAt, incoming.updatedAt ?? incoming.createdAt),
  };
}

/** The row to write when both devices have one with this id, or null to
 *  keep this device's copy. */
export function pickRow(table: Table, local: Row, incoming: Row): Row | null {
  switch (table) {
    case "notebooks":
    case "chatSessions":
    case "highlights":
      return stamp(incoming) > stamp(local) ? incoming : null;
    case "generations": {
      const a = local as unknown as Generation;
      const b = incoming as unknown as Generation;
      if (a.kind === "flashcards" && b.kind === "flashcards") return mergeDeck(a, b) as unknown as Row | null;
      return (b.updatedAt ?? b.createdAt) > (a.updatedAt ?? a.createdAt) ? incoming : null;
    }
    case "cardProgress": {
      const a = local as unknown as CardProgress;
      const b = incoming as unknown as CardProgress;
      return b.reps > a.reps || (b.reps === a.reps && b.dueAt > a.dueAt) ? incoming : null;
    }
    default:
      return null;
  }
}

function rowsOf(payload: BackupPayload, table: Table | "chunks"): Row[] {
  const rows = payload.data?.[table];
  return Array.isArray(rows) ? (rows as Row[]).filter((r) => r && typeof r.id === "string") : [];
}

export async function mergeNotebookPayload(payload: BackupPayload): Promise<MergeResult> {
  validateBackupPayload(payload);
  const notebook = rowsOf(payload, "notebooks")[0];
  if (!notebook) throw new Error("That isn't a Comtus notebook.");
  const notebookId = notebook.id;
  const before = await db.notebooks.get(notebookId);
  let added = 0;
  let updated = 0;
  const newSources: Source[] = [];

  const tables = [...TABLES.map((t) => db[t]), db.chunks];
  await db.transaction("rw", tables, async () => {
    const scopedData = Object.fromEntries([...TABLES, "chunks" as const].map((table) => [
      table,
      rowsOf(payload, table).filter((row) => table === "notebooks" ? row.id === notebookId : row.notebookId === notebookId),
    ]));
    await assertBackupOwnership({ ...payload, data: scopedData }, true);
    for (const table of TABLES) {
      const store = db[table] as unknown as DexieTable<Row, string>;
      // Only this notebook's rows, whatever else the file holds.
      const incoming = rowsOf(payload, table).filter((r) => (table === "notebooks" ? r.id === notebookId : r.notebookId === notebookId));
      const locals = await store.bulkGet(incoming.map((r) => r.id));
      for (const [i, row] of incoming.entries()) {
        const local = locals[i];
        if (!local) {
          await store.add(row);
          added++;
          if (table === "sources") newSources.push(row as unknown as Source);
          continue;
        }
        if (table !== "notebooks" && local.notebookId !== notebookId) continue;
        const next = pickRow(table, local, row);
        if (next) {
          await store.put(next);
          updated++;
        }
      }
    }
    // Retrieval chunks come with the file or are rebuilt from the text.
    const sent = rowsOf(payload, "chunks") as unknown as Chunk[];
    for (const source of newSources) {
      const provided = sent.filter((c) => c.sourceId === source.id && c.notebookId === notebookId);
      const chunks: Chunk[] = provided.length
        ? provided
        : chunkText(source.content).map((text, idx) => ({
            id: `${source.id}:${idx}`,
            sourceId: source.id,
            notebookId,
            idx,
            text,
            tokens: estTokens(text),
          }));
      // A transferred source is new. Existing chunk keys must never be
      // overwritten, including keys belonging to a different notebook.
      await db.chunks.bulkAdd(chunks);
    }
  });

  notifyDeskActivity();
  const after = await db.notebooks.get(notebookId);
  return { notebookId, name: after?.name ?? String(notebook.name ?? ""), isNew: !before, added, updated };
}
