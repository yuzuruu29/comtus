import { db } from "./db";

export interface NotebookStorageRow {
  id: string;
  name: string;
  updatedAt: number;
  sources: number;
  messages: number;
  generations: number;
  chunks: number;
  bytes: number;
}

export interface StorageStats {
  notebooks: NotebookStorageRow[];
  /** Sum of per-notebook JSON estimates. */
  totalBytes: number;
  /** Browser-reported origin usage, when available. */
  usageBytes: number | null;
  quotaBytes: number | null;
}

function byteLength(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Per-notebook counts and a JSON-size estimate, plus the origin quota. */
export async function getStorageStats(): Promise<StorageStats> {
  const notebooks = await db.notebooks.orderBy("updatedAt").reverse().toArray();
  const rows: NotebookStorageRow[] = await Promise.all(
    notebooks.map(async (nb) => {
      const [sources, messages, generations, chunks] = await Promise.all([
        db.sources.where("notebookId").equals(nb.id).toArray(),
        db.messages.where("notebookId").equals(nb.id).toArray(),
        db.generations.where("notebookId").equals(nb.id).toArray(),
        db.chunks.where("notebookId").equals(nb.id).toArray(),
      ]);
      const bytes =
        byteLength(nb) +
        byteLength(sources) +
        byteLength(messages) +
        byteLength(generations) +
        byteLength(chunks);
      return {
        id: nb.id,
        name: nb.name,
        updatedAt: nb.updatedAt,
        sources: sources.length,
        messages: messages.length,
        generations: generations.length,
        chunks: chunks.length,
        bytes,
      };
    }),
  );

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate) {
      usageBytes = estimate.usage ?? null;
      quotaBytes = estimate.quota ?? null;
    }
  } catch {
    /* private mode / unsupported */
  }

  return {
    notebooks: rows,
    totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    usageBytes,
    quotaBytes,
  };
}
