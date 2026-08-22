import type { Table } from "dexie";
import { db } from "./db";

const TABLES = [
  "notebooks",
  "sources",
  "chunks",
  "messages",
  "generations",
  "cardProgress",
] as const;

type TableName = (typeof TABLES)[number];

/** Full local store → downloadable JSON file. */
export async function exportBackup(): Promise<void> {
  const data: Partial<Record<TableName, unknown[]>> = {};
  for (const t of TABLES) data[t] = await db[t].toArray();
  const payload = {
    app: "comtus",
    schema: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comtus-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Merge rows from a backup file into the local store (existing ids win). */
export async function importBackup(file: File): Promise<number> {
  let payload: {
    app?: string;
    data?: Partial<Record<TableName, unknown[]>>;
  };
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (payload?.app !== "comtus" || !payload.data) {
    throw new Error("That isn't a Comtus backup file.");
  }
  // The per-table generics differ, so normalize through a wide row type.
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
