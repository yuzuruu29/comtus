import { db, saveGeneration, touchNotebook, uid } from "./db";
import { notifyDeskActivity } from "./activity";
import type { Flashcard, FlashcardsPayload, Highlight, Source } from "./types";
import { clozeFromSelection } from "./cloze";
import { stripInline } from "./readerBlocks";

/**
 * Highlights and margin notes on sources. A highlight is a character range
 * in `Source.content` — the same offsets citations and search use — plus
 * the words it covers and an optional note in the student's own words.
 * Overlapping highlights merge, so a passage is never marked twice.
 */

/* ── Ranges ───────────────────────────────────────────────── */

/** Letters of scripts that separate words with spaces; a selection that
 *  stops inside one of these words grows to the whole word. */
const WORD_CHAR = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{N}'’-]/u;
const MAX_WORD_GROWTH = 40;

/** Trims whitespace off both ends of a selection and completes a word cut
 *  in half, the way a pen would mark it. Returns null for an empty range. */
export function tidyRange(content: string, start: number, end: number): { start: number; end: number } | null {
  let s = Math.max(0, Math.min(start, end));
  let e = Math.min(content.length, Math.max(start, end));
  while (s < e && /\s/.test(content[s])) s++;
  while (e > s && /\s/.test(content[e - 1])) e--;
  if (e <= s) return null;
  for (let n = 0; n < MAX_WORD_GROWTH && s > 0 && WORD_CHAR.test(content[s - 1]) && WORD_CHAR.test(content[s]); n++) s--;
  for (let n = 0; n < MAX_WORD_GROWTH && e < content.length && WORD_CHAR.test(content[e]) && WORD_CHAR.test(content[e - 1]); n++) e++;
  // Leading apostrophes, dashes and closing quotes aren't part of the word.
  while (s < e && /['’-]/.test(content[s])) s++;
  while (e > s && /['’-]/.test(content[e - 1])) e--;
  return e > s ? { start: s, end: e } : null;
}

export interface HighlightPlan {
  start: number;
  end: number;
  note: string;
  /** Existing highlights the new one swallows. */
  absorbed: Highlight[];
}

/** A new highlight over [start, end) merged with every highlight it
 *  overlaps or touches; their notes are kept, in reading order. */
export function planHighlight(existing: Highlight[], start: number, end: number): HighlightPlan {
  let s = start;
  let e = end;
  let absorbed: Highlight[] = [];
  // Merging can widen the range into further highlights, so repeat.
  for (;;) {
    const hits = existing.filter((h) => h.start <= e && h.end >= s);
    if (hits.length === absorbed.length) break;
    absorbed = hits;
    s = Math.min(s, ...hits.map((h) => h.start));
    e = Math.max(e, ...hits.map((h) => h.end));
  }
  absorbed.sort((a, b) => a.start - b.start);
  const note = absorbed
    .map((h) => h.note.trim())
    .filter(Boolean)
    .join("\n\n");
  return { start: s, end: e, note, absorbed };
}

/* ── Persistence ──────────────────────────────────────────── */

export async function listSourceHighlights(sourceId: string): Promise<Highlight[]> {
  const rows = await db.highlights.where("sourceId").equals(sourceId).toArray();
  return rows.sort((a, b) => a.start - b.start);
}

/** Highlight counts per source, for the sources list. */
export async function highlightCounts(notebookId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  await db.highlights
    .where("notebookId")
    .equals(notebookId)
    .each((h) => counts.set(h.sourceId, (counts.get(h.sourceId) ?? 0) + 1));
  return counts;
}

/** Marks [start, end) of a source, merging with any highlight it touches.
 *  A merge into a single existing highlight keeps that highlight's id. */
export async function addHighlight(
  source: Pick<Source, "id" | "notebookId" | "content">,
  start: number,
  end: number,
  now = Date.now(),
): Promise<Highlight | null> {
  const range = tidyRange(source.content, start, end);
  if (!range) return null;
  const saved = await db.transaction("rw", db.highlights, async () => {
    const existing = await db.highlights.where("sourceId").equals(source.id).toArray();
    const plan = planHighlight(existing, range.start, range.end);
    const keep = plan.absorbed[0];
    const highlight: Highlight = {
      id: keep?.id ?? uid(),
      notebookId: source.notebookId,
      sourceId: source.id,
      start: plan.start,
      end: plan.end,
      quote: source.content.slice(plan.start, plan.end),
      note: plan.note,
      createdAt: keep?.createdAt ?? now,
      updatedAt: now,
    };
    const drop = plan.absorbed.slice(1).map((h) => h.id);
    if (drop.length) await db.highlights.bulkDelete(drop);
    await db.highlights.put(highlight);
    return highlight;
  });
  await touchNotebook(source.notebookId);
  notifyDeskActivity();
  return saved;
}

export async function setHighlightNote(id: string, note: string, now = Date.now()): Promise<void> {
  const existing = await db.highlights.get(id);
  if (!existing) return;
  await db.highlights.update(id, { note: note.trim(), updatedAt: now });
  await touchNotebook(existing.notebookId);
}

export async function removeHighlight(id: string): Promise<void> {
  const existing = await db.highlights.get(id);
  if (!existing) return;
  await db.highlights.delete(id);
  await touchNotebook(existing.notebookId);
  notifyDeskActivity();
}

/* ── Sharing out ──────────────────────────────────────────── */

/** One line of quote for lists and notes: Markdown markers dropped and
 *  whitespace collapsed. */
export function quoteLine(text: string): string {
  return stripInline(text).replace(/\s+/g, " ").trim();
}

/** A source's highlights as a Markdown note: each passage quoted, the
 *  student's note under it, and the page when it's known. */
export function highlightsMarkdown(
  sourceTitle: string,
  highlights: Pick<Highlight, "quote" | "note" | "start">[],
  pageOf: (offset: number) => number | undefined = () => undefined,
): string {
  const parts = highlights.map((h) => {
    const page = pageOf(h.start);
    const quote = `> ${quoteLine(h.quote)}${page ? ` (p. ${page})` : ""}`;
    return h.note.trim() ? `${quote}\n\n${h.note.trim()}` : quote;
  });
  return [`From “${sourceTitle}”.`, ...parts].join("\n\n");
}

const ASK_QUOTE_LIMIT = 1200;

/** The opening of a chat question about a passage. */
export function passagePrompt(sourceTitle: string, passage: string): string {
  const line = quoteLine(passage);
  const clipped = line.length > ASK_QUOTE_LIMIT ? `${line.slice(0, ASK_QUOTE_LIMIT).trimEnd()}…` : line;
  return `About this passage from “${sourceTitle}”:\n> ${clipped}\n\n`;
}

/* ── Cards from reading ──────────────────────────────────── */

export const READING_DECK = "From your reading";

/** One deck per notebook collects the cards made while reading. */
export const readingDeckId = (notebookId: string) => `reading-${notebookId}`;

/** Turns a selected passage into a cloze card — its sentence with the
 *  selection blanked — in the notebook's reading deck. `added` is false
 *  when the same card is already there. */
export async function addReadingCard(
  source: Pick<Source, "id" | "notebookId" | "title" | "content">,
  start: number,
  end: number,
  page?: number,
  now = Date.now(),
): Promise<{ added: boolean } | null> {
  const range = tidyRange(source.content, start, end);
  const front = range && clozeFromSelection(source.content, range.start, range.end);
  if (!front) return null;
  const deckId = readingDeckId(source.notebookId);
  const existing = await db.generations.get(deckId);
  const cards = existing?.kind === "flashcards" ? ((existing.payload as FlashcardsPayload).cards ?? []) : [];
  if (cards.some((c) => c.front === front)) return { added: false };
  const card: Flashcard = {
    id: `r-${uid()}`,
    front,
    back: `From “${source.title}”${page ? `, page ${page}` : ""}.`,
    topic: source.title.slice(0, 60),
  };
  await saveGeneration({
    id: deckId,
    notebookId: source.notebookId,
    kind: "flashcards",
    title: READING_DECK,
    payload: { cards: [...cards, card] } satisfies FlashcardsPayload,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  return { added: true };
}
