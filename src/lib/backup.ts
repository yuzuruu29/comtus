import type { Table } from "dexie";
import { db, uid } from "./db";
import { notifyDeskActivity } from "./activity";
import type {
  Attempt,
  CardProgress,
  ChatMessage,
  ChatSession,
  Chunk,
  FlashcardsPayload,
  Generation,
  Highlight,
  Notebook,
  Source,
} from "./types";
import { saveTextFile } from "./saveFile";
import { useSettings } from "./settings";

const TABLES = [
  "notebooks",
  "sources",
  "chunks",
  "messages",
  "chatSessions",
  "generations",
  "cardProgress",
  "attempts",
  "highlights",
] as const;

type TableName = (typeof TABLES)[number];

export interface BackupPayload {
  app?: string;
  schema?: number;
  exportedAt?: string;
  /** "notebook" when the file holds a single notebook; absent for a full backup. */
  scope?: "notebook";
  data?: Partial<Record<TableName, unknown[]>>;
}

function backupFilename(): string {
  return `comtus-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

async function buildPayload(): Promise<BackupPayload> {
  const data: Partial<Record<TableName, unknown[]>> = {};
  for (const t of TABLES) data[t] = await db[t].toArray();
  return {
    app: "comtus",
    schema: 2,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** One notebook with everything that hangs off it — sources, chunks, chats,
 *  saved work and review history — in the same shape as a full backup, so
 *  Settings → Restore merges it straight back in. */
export async function buildNotebookPayload(notebookId: string): Promise<BackupPayload> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) throw new Error("This notebook is no longer on this device.");
  const data: Partial<Record<TableName, unknown[]>> = { notebooks: [notebook] };
  for (const t of TABLES) {
    if (t === "notebooks") continue;
    data[t] = await db[t].where("notebookId").equals(notebookId).toArray();
  }
  return {
    app: "comtus",
    schema: 2,
    scope: "notebook",
    exportedAt: new Date().toISOString(),
    data,
  };
}

function notebookFilename(name: string): string {
  const slug = name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "notebook";
  return `${slug}-comtus-${new Date().toISOString().slice(0, 10)}.json`;
}

function markBackedUp(): void {
  useSettings.getState().update({ lastBackupAt: Date.now() });
}

const JSON_FILE = { name: "JSON", extensions: ["json"], mime: "application/json" };

/** Native save dialog on Tauri, browser download otherwise. False = cancelled. */
const saveJson = (json: string, filename: string) => saveTextFile(json, filename, JSON_FILE);

/** Full local store → a file. */
export async function exportBackup(): Promise<boolean> {
  const saved = await saveJson(JSON.stringify(await buildPayload()), backupFilename());
  if (saved) markBackedUp();
  return saved;
}

/** One notebook → a restorable file. */
export async function exportNotebook(notebook: Pick<Notebook, "id" | "name">): Promise<boolean> {
  return saveJson(JSON.stringify(await buildNotebookPayload(notebook.id)), notebookFilename(notebook.name));
}

export function parseBackupPayload(text: string): BackupPayload {
  let payload: BackupPayload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (payload?.app !== "comtus" || !payload.data) {
    throw new Error("That isn't a Comtus backup file.");
  }
  return payload;
}

export async function importBackupText(text: string): Promise<number> {
  const payload = parseBackupPayload(text);
  const tables: Array<Table<Record<string, unknown>, string>> = TABLES.map(
    (t) => db[t] as unknown as Table<Record<string, unknown>, string>,
  );
  let count = 0;
  await db.transaction("rw", tables, async () => {
    for (let i = 0; i < TABLES.length; i++) {
      const rows = payload.data?.[TABLES[i]];
      if (Array.isArray(rows) && rows.length) {
        await tables[i].bulkPut(rows as Record<string, unknown>[]);
        count += rows.length;
      }
    }
  });
  return count;
}

/** Merge rows from a backup file into the local store; a row whose id
 *  is already here is replaced by the file's copy. */
export async function importBackup(file: File): Promise<number> {
  return importBackupText(await file.text());
}

/** Native open dialog on Tauri. Returns 0 if the user cancelled. */
export async function importBackupNative(): Promise<number | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path || Array.isArray(path)) return null;
  return importBackupText(await readTextFile(path));
}

/* ── Opening a notebook file ──────────────────────────────── */

type NotebookData = {
  notebooks: Notebook[];
  sources: Source[];
  chunks: Chunk[];
  messages: ChatMessage[];
  chatSessions: ChatSession[];
  generations: Generation[];
  cardProgress: CardProgress[];
  attempts: Attempt[];
  highlights: Highlight[];
};

const rowsOf = <K extends keyof NotebookData>(payload: BackupPayload, table: K): NotebookData[K] => {
  const rows = payload.data?.[table];
  return (Array.isArray(rows) ? rows : []) as NotebookData[K];
};

/**
 * A notebook export with every id replaced, so it can sit beside the
 * notebook it came from: sources, chats, saved work, review history,
 * attempts and highlights all keep pointing at each other.
 */
export function copyNotebookPayload(payload: BackupPayload, newId = uid, now = Date.now()): NotebookData {
  const [notebook] = rowsOf(payload, "notebooks");
  const notebookId = newId();
  const oldNotebookId = notebook.id;
  const sourceIds = new Map(rowsOf(payload, "sources").map((s) => [s.id, newId()]));
  const sessionIds = new Map(rowsOf(payload, "chatSessions").map((s) => [s.id, newId()]));
  // The notebook's own decks keep their per-notebook ids.
  const genIds = new Map(
    rowsOf(payload, "generations").map((g) => {
      for (const prefix of ["misses-", "reading-"]) {
        if (g.id === `${prefix}${oldNotebookId}`) return [g.id, `${prefix}${notebookId}`] as const;
      }
      return [g.id, newId()] as const;
    }),
  );
  const source = (id: string) => sourceIds.get(id) ?? id;
  const gen = (id: string) => genIds.get(id) ?? id;

  return {
    notebooks: [{ ...notebook, id: notebookId, name: `${notebook.name} (copy)`, updatedAt: now }],
    sources: rowsOf(payload, "sources").map((s) => ({ ...s, id: source(s.id), notebookId })),
    chunks: rowsOf(payload, "chunks").map((c) => ({ ...c, id: `${source(c.sourceId)}:${c.idx}`, sourceId: source(c.sourceId), notebookId })),
    chatSessions: rowsOf(payload, "chatSessions").map((s) => ({ ...s, id: sessionIds.get(s.id) ?? s.id, notebookId })),
    messages: rowsOf(payload, "messages").map((m) => ({
      ...m,
      id: newId(),
      notebookId,
      ...(m.sessionId ? { sessionId: sessionIds.get(m.sessionId) ?? m.sessionId } : {}),
      ...(m.citations
        ? { citations: m.citations.map((c) => (c.sourceId ? { ...c, sourceId: source(c.sourceId) } : c)) }
        : {}),
    })),
    generations: rowsOf(payload, "generations").map((g) => {
      const copy: Generation = { ...g, id: gen(g.id), notebookId };
      // Cards made from quiz misses are named after the quiz they came from.
      if (g.kind === "flashcards" && g.id.startsWith("misses-")) {
        const cards = (g.payload as FlashcardsPayload | undefined)?.cards ?? [];
        copy.payload = {
          cards: cards.map((c) => {
            for (const [from, to] of genIds) {
              if (c.id.startsWith(`m-${from}-`)) return { ...c, id: `m-${to}-${c.id.slice(from.length + 3)}` };
            }
            return c;
          }),
        } satisfies FlashcardsPayload;
      }
      return copy;
    }),
    cardProgress: rowsOf(payload, "cardProgress").map((p) => {
      const cardId = p.id.slice(p.generationId.length + 1);
      return { ...p, id: `${gen(p.generationId)}:${cardId}`, generationId: gen(p.generationId), notebookId };
    }),
    attempts: rowsOf(payload, "attempts").map((a) => ({ ...a, id: newId(), generationId: gen(a.generationId), notebookId })),
    highlights: rowsOf(payload, "highlights").map((h) => ({ ...h, id: newId(), sourceId: source(h.sourceId), notebookId })),
  };
}

export type OpenedFile =
  | { kind: "notebook"; notebookId: string; name: string; copied: boolean }
  | { kind: "backup"; count: number };

/**
 * Opens an exported notebook (or a full backup) from the shelf. A
 * notebook already on this device comes in as a separate copy, so an
 * older file never overwrites newer work.
 */
export async function openNotebookText(text: string): Promise<OpenedFile> {
  const payload = parseBackupPayload(text);
  const [notebook] = rowsOf(payload, "notebooks");
  if (payload.scope !== "notebook" || !notebook?.id) {
    const count = await importBackupText(text);
    notifyDeskActivity();
    return { kind: "backup", count };
  }
  if (!(await db.notebooks.get(notebook.id))) {
    await importBackupText(text);
    notifyDeskActivity();
    return { kind: "notebook", notebookId: notebook.id, name: notebook.name, copied: false };
  }
  const copy = copyNotebookPayload(payload);
  const tables = TABLES.map((t) => db[t] as unknown as Table<Record<string, unknown>, string>);
  await db.transaction("rw", tables, async () => {
    for (let i = 0; i < TABLES.length; i++) {
      const rows = copy[TABLES[i]] as unknown as Record<string, unknown>[];
      if (rows.length) await tables[i].bulkAdd(rows);
    }
  });
  notifyDeskActivity();
  return { kind: "notebook", notebookId: copy.notebooks[0].id, name: copy.notebooks[0].name, copied: true };
}

/** The native open dialog on desktop; null when cancelled. */
export async function readNotebookFileNative(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({ multiple: false, filters: [{ name: "Comtus notebook", extensions: ["json"] }] });
  if (!path || Array.isArray(path)) return null;
  return readTextFile(path);
}
