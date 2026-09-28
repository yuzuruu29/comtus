import type { Table } from "dexie";
import { db } from "./db";
import type { Notebook } from "./types";
import { isTauri } from "./desktop";
import { useSettings } from "./settings";

const TABLES = [
  "notebooks",
  "sources",
  "chunks",
  "messages",
  "chatSessions",
  "generations",
  "cardProgress",
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

function downloadBlob(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Native save dialog on Tauri, browser download otherwise. False = cancelled. */
async function saveJson(json: string, filename: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return false;
    await writeTextFile(path, json);
  } else {
    downloadBlob(json, filename);
  }
  return true;
}

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

/** Merge rows from a backup file into the local store (existing ids win). */
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
