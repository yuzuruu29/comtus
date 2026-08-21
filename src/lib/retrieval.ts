import { db } from "./db";
import type { Chunk, Source } from "./types";

/**
 * Client-side retrieval over notebook chunks.
 *
 * v1 strategy: BM25-style lexical scoring (no second API key, no embedding
 * costs). When a notebook is small enough to fit comfortably in context,
 * skip retrieval entirely and ground on everything — closer to how
 * NotebookLM behaves on small stacks. The `Retriever` seam below leaves
 * room for an embedding-based implementation later.
 */

const STOPWORDS = new Set(
  `a an and are as at be by for from has have he her his i if in into is it its of on or she
   that the their them then there these they this to was were what when where which who will with you your`
    .split(/\s+/)
    .filter(Boolean),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Rough token estimate — good enough for budgeting context. */
export const estTokens = (text: string) => Math.ceil(text.length / 4);

const FULL_CONTEXT_TOKEN_BUDGET = 90_000;
const RETRIEVAL_TOKEN_BUDGET = 45_000;

export interface GroundingDoc {
  source: Source;
  /** Text sent to the model (full content or stitched chunks). */
  text: string;
}

export interface RetrievalResult {
  docs: GroundingDoc[];
  mode: "full" | "retrieved";
}

export async function groundContext(
  notebookId: string,
  query: string,
): Promise<RetrievalResult> {
  const sources = await db.sources.where("notebookId").equals(notebookId).toArray();
  if (sources.length === 0) return { docs: [], mode: "full" };

  const totalTokens = sources.reduce((s, src) => s + src.tokens, 0);
  if (totalTokens <= FULL_CONTEXT_TOKEN_BUDGET) {
    return {
      docs: sources.map((source) => ({ source, text: source.content })),
      mode: "full",
    };
  }

  // Lexical retrieval over chunks.
  const chunks = await db.chunks.where("notebookId").equals(notebookId).toArray();
  const queryTerms = Array.from(new Set(tokenize(query)));
  const df = new Map<string, number>();
  const chunkTerms: string[][] = chunks.map((c) => tokenize(c.text));
  for (const terms of chunkTerms) {
    for (const t of new Set(terms)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = Math.max(1, chunks.length);
  const k1 = 1.4;
  const b = 0.72;
  const avgLen =
    chunks.reduce((s, c) => s + c.text.length, 0) / N || 1;

  const scored = chunks.map((chunk, i) => {
    let score = 0;
    const lenNorm = 1 - b + b * (chunk.text.length / avgLen);
    for (const term of queryTerms) {
      const f = chunkTerms[i].filter((t) => t === term).length;
      if (f === 0) continue;
      const idf = Math.log(1 + (N - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * lenNorm));
    }
    return { chunk, score };
  });

  scored.sort((a, b2) => b2.score - a.score);

  // Take top chunks until the budget; always keep at least a few.
  const picked: Chunk[] = [];
  let used = 0;
  for (const { chunk, score } of scored) {
    if (picked.length >= 8 && (score <= 0 || used > RETRIEVAL_TOKEN_BUDGET)) break;
    picked.push(chunk);
    used += chunk.tokens;
  }

  // Stitch picked chunks back per source, in reading order.
  const bySource = new Map<string, Chunk[]>();
  for (const c of picked) {
    const list = bySource.get(c.sourceId) ?? [];
    list.push(c);
    bySource.set(c.sourceId, list);
  }
  const docs: GroundingDoc[] = [];
  for (const [sourceId, list] of bySource) {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) continue;
    list.sort((a, b3) => a.idx - b3.idx);
    docs.push({
      source,
      text: list.map((c) => `[…segment ${c.idx + 1}…]\n${c.text}`).join("\n\n"),
    });
  }
  return { docs, mode: "retrieved" };
}
