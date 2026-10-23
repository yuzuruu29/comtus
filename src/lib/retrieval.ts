import { db } from "./db";
import { MAX_CHUNK_CHARS, chunkText } from "./chunking";
import type { Chunk, Source } from "./types";

/**
 * Client-side retrieval over notebook chunks.
 *
 * Strategy: BM25 lexical scoring (no second API key, no embedding costs).
 * When a notebook is small enough to fit comfortably in context, skip
 * retrieval entirely and ground on everything — closer to how NotebookLM
 * behaves on small stacks.
 *
 * Tokenization is Unicode-aware: accents fold ("résumé" finds "resume"),
 * any alphabet counts as words, and scripts written without spaces (Han,
 * kana, Hangul, Thai) are indexed as overlapping character bigrams. Light
 * English plural folding lets "enzymes" meet "enzyme". The scored index is
 * cached per notebook source set, so follow-up questions skip re-tokenizing.
 */

const STOPWORDS = new Set(
  `a an and are as at be by for from has have he her his i if in into is it its of on or she
   that the their them then there these they this to was were what when where which who will with you your`
    .split(/\s+/)
    .filter(Boolean),
);

/** Scripts written without spaces between words. */
const UNSPACED_CLASS = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\p{Script=Thai}";
const UNSPACED_SPLIT = new RegExp(`([${UNSPACED_CLASS}]+)`, "u");
const UNSPACED = new RegExp(`^[${UNSPACED_CLASS}]`, "u");
const WORD_RUN = /[\p{L}\p{N}]+/gu;

/** Conservative English plural folding — never touches short words. */
function foldPlural(word: string): string {
  if (word.length <= 3 || !/^[a-z]+$/.test(word)) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:ss|us|is)$/.test(word)) return word;
  if (/(?:ss|sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  // Fold compatibility forms and Latin/Greek/Cyrillic accents, then
  // recompose so Hangul syllables and voiced kana survive intact.
  const folded = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFC").toLowerCase();
  const out: string[] = [];
  for (const [run] of folded.matchAll(WORD_RUN)) {
    // "atp合成" → "atp" + "合成": only the unspaced stretch becomes bigrams.
    for (const part of run.split(UNSPACED_SPLIT)) {
      if (!part) continue;
      if (UNSPACED.test(part)) {
        const chars = Array.from(part);
        if (chars.length === 1) out.push(part);
        for (let i = 0; i + 1 < chars.length; i++) out.push(chars[i] + chars[i + 1]);
      } else if (part.length > 1 && !STOPWORDS.has(part)) {
        out.push(foldPlural(part));
      }
    }
  }
  return out;
}

/** Rough token estimate — good enough for budgeting context. */
export const estTokens = (text: string) => Math.ceil(text.length / 4);

const FULL_CONTEXT_TOKEN_BUDGET = 90_000;
const RETRIEVAL_TOKEN_BUDGET = 45_000;
const MIN_PICKS = 8;
const K1 = 1.4;
const B = 0.72;
/** A query word in a source's title is a hint, not proof: a fraction of a hit. */
const TITLE_WEIGHT = 0.35;

export interface GroundingDoc {
  source: Source;
  /** Text sent to the model (full content or stitched chunks). */
  text: string;
}

export interface RetrievalResult {
  docs: GroundingDoc[];
  mode: "full" | "retrieved";
}

/* ── Index ────────────────────────────────────────────────── */

export interface ChunkIndex {
  chunks: Chunk[];
  /** Per-chunk term frequencies. */
  tf: Map<string, number>[];
  lengths: number[];
  avgLength: number;
  /** Document frequency per term. */
  df: Map<string, number>;
  /** Tokenized source titles, by source id. */
  titleTerms: Map<string, Set<string>>;
}

export function buildIndex(chunks: Chunk[], sources: Pick<Source, "id" | "title">[] = []): ChunkIndex {
  const tf: Map<string, number>[] = [];
  const lengths: number[] = [];
  const df = new Map<string, number>();
  for (const chunk of chunks) {
    const terms = tokenize(chunk.text);
    const counts = new Map<string, number>();
    for (const t of terms) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const t of counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    tf.push(counts);
    lengths.push(terms.length);
  }
  const total = lengths.reduce((s, n) => s + n, 0);
  return {
    chunks,
    tf,
    lengths,
    avgLength: total / Math.max(1, chunks.length) || 1,
    df,
    titleTerms: new Map(sources.map((s) => [s.id, new Set(tokenize(s.title))])),
  };
}

/** BM25 score per chunk, in index order. */
export function scoreChunks(index: ChunkIndex, query: string): number[] {
  const terms = Array.from(new Set(tokenize(query)));
  const n = Math.max(1, index.chunks.length);
  const idf = new Map(
    terms.map((t) => {
      const d = index.df.get(t) ?? 0;
      return [t, Math.log(1 + (n - d + 0.5) / (d + 0.5))] as const;
    }),
  );
  return index.chunks.map((chunk, i) => {
    const counts = index.tf[i];
    const norm = 1 - B + B * (index.lengths[i] / index.avgLength);
    const title = index.titleTerms.get(chunk.sourceId);
    let score = 0;
    for (const t of terms) {
      const f = counts.get(t) ?? 0;
      if (f > 0) score += idf.get(t)! * ((f * (K1 + 1)) / (f + K1 * norm));
      if (title?.has(t)) score += TITLE_WEIGHT * idf.get(t)!;
    }
    return score;
  });
}

/**
 * Chunks to ground on, in no particular order. Query hits first, then
 * unmatched chunks up to a floor of MIN_PICKS. A query with no lexical
 * signal ("summarize this") instead reads every source from its opening,
 * round robin, so the answer sees the whole notebook rather than whichever
 * chunks happened to sort first. The budget is a hard cap either way: a
 * chunk that would overflow it is skipped for a smaller one.
 */
export function pickChunks(index: ChunkIndex, query: string, budget = RETRIEVAL_TOKEN_BUDGET): Chunk[] {
  const scores = scoreChunks(index, query);
  const picked: Chunk[] = [];
  let used = 0;

  if (scores.some((s) => s > 0)) {
    const order = scores.map((score, i) => ({ score, i })).sort((a, b) => b.score - a.score || a.i - b.i);
    for (const { score, i } of order) {
      if (picked.length >= MIN_PICKS && score <= 0) break;
      if (used + index.chunks[i].tokens > budget) continue;
      picked.push(index.chunks[i]);
      used += index.chunks[i].tokens;
    }
    return picked;
  }

  const bySource = new Map<string, Chunk[]>();
  for (const c of index.chunks) bySource.set(c.sourceId, [...(bySource.get(c.sourceId) ?? []), c]);
  const queues = [...bySource.values()].map((list) => list.sort((a, b) => a.idx - b.idx));
  for (let round = 0; used < budget && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      const c = q[round];
      if (!c || used + c.tokens > budget) continue;
      picked.push(c);
      used += c.tokens;
    }
  }
  return picked;
}

/** Chunks saved before chunkText capped their size can each be larger than
 *  the whole retrieval budget. Cut them to size in memory; the pieces keep
 *  their parent's position so they stitch back in reading order. */
function recut(chunk: Chunk): Chunk[] {
  if (chunk.text.length <= MAX_CHUNK_CHARS) return [chunk];
  return chunkText(chunk.text).map((text, i) => ({ ...chunk, id: `${chunk.id}.${i}`, text, tokens: estTokens(text) }));
}

/* The open notebook's index, reused while its source set is unchanged.
   Sources are immutable once added, so the ids are a sufficient key. */
let cached: { key: string; index: ChunkIndex } | null = null;

async function indexFor(notebookId: string, sources: Source[]): Promise<ChunkIndex> {
  const key = `${notebookId}|${sources.map((s) => s.id).sort().join(",")}`;
  if (cached?.key === key) return cached.index;
  const allow = new Set(sources.map((s) => s.id));
  const chunks = (await db.chunks.where("notebookId").equals(notebookId).toArray())
    .filter((c) => allow.has(c.sourceId))
    .flatMap(recut);
  const index = buildIndex(chunks, sources);
  cached = { key, index };
  return index;
}

/** Test seam: forget the cached index. */
export function clearRetrievalCache(): void {
  cached = null;
}

export async function groundContext(
  notebookId: string,
  query: string,
  sourceIds?: string[],
): Promise<RetrievalResult> {
  let sources = await db.sources.where("notebookId").equals(notebookId).toArray();
  if (sourceIds !== undefined) {
    const allow = new Set(sourceIds);
    sources = sources.filter((s) => allow.has(s.id));
  }
  if (sources.length === 0) return { docs: [], mode: "full" };

  const totalTokens = sources.reduce((s, src) => s + src.tokens, 0);
  if (totalTokens <= FULL_CONTEXT_TOKEN_BUDGET) {
    return {
      docs: sources.map((source) => ({ source, text: source.content })),
      mode: "full",
    };
  }

  const picked = pickChunks(await indexFor(notebookId, sources), query);

  // Stitch picked chunks back per source, in reading order.
  const bySource = new Map<string, Chunk[]>();
  for (const c of picked) bySource.set(c.sourceId, [...(bySource.get(c.sourceId) ?? []), c]);
  const docs: GroundingDoc[] = [];
  for (const source of sources) {
    const list = bySource.get(source.id);
    if (!list) continue;
    list.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id, undefined, { numeric: true }));
    docs.push({
      source,
      text: list.map((c) => `[…segment ${c.idx + 1}…]\n${c.text}`).join("\n\n"),
    });
  }
  return { docs, mode: "retrieved" };
}
