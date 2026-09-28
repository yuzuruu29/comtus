/**
 * Splits a source's text into readable blocks for the source reader —
 * headings, paragraphs, lists and page breaks — without changing a single
 * character. Every block knows where its text starts in `Source.content`,
 * so citations, search hits and highlights can all point into the reader
 * by plain character offsets.
 *
 * Sources arrive in three shapes: Markdown (web pages, .md files, AI
 * transcriptions), hard-wrapped PDF text layers ("[page N]" markers and a
 * line break at the end of every printed line), and plain pasted text.
 * The splitter keeps Markdown's structure and reflows the printed lines
 * of a PDF back into paragraphs.
 */

export type ReaderBlockKind = "heading" | "page" | "prose" | "lines";

export interface ReaderBlock {
  kind: ReaderBlockKind;
  /** Where `text` starts in the source's content. */
  at: number;
  /** Exactly `content.slice(at, at + text.length)`. */
  text: string;
  /** Heading level, 1–6. */
  level?: number;
  /** The printed page this block sits on, from "[page N]" markers. For a
   *  page block, the page that starts there. */
  page?: number;
}

const PAGE_MARKER = /^\[page (\d+)\]$/;
const HEADING = /^(#{1,6})[ \t]+(?=\S)/;
const FENCE = /^\s*(```|~~~)/;
/** Bullets, numbered items and table rows keep their own lines. */
const LINE_ITEM = /^\s*(?:[-*+•●▪◦‣–][ \t]|\d{1,3}[.)][ \t]|\(?[a-z][.)][ \t]|\|)/;
const ENDS_SENTENCE = /[.!?:;"”’)\]]$/;
const STARTS_SENTENCE = /^[\p{Lu}\p{N}"“‘(]/u;
/** Past this many characters a reflowed paragraph breaks at the next
 *  sentence end, so a page with no visible paragraph breaks still reads. */
const LONG_PARAGRAPH = 1600;

interface Line {
  at: number;
  text: string;
}

function lines(content: string): Line[] {
  const out: Line[] = [];
  let at = 0;
  while (at <= content.length) {
    const nl = content.indexOf("\n", at);
    const end = nl === -1 ? content.length : nl;
    // Treat "\r\n" as one break; the "\r" is never part of a block's text.
    const text = content.slice(at, end).replace(/\r$/, "");
    out.push({ at, text });
    if (nl === -1) break;
    at = nl + 1;
  }
  return out;
}

/** Splits a run of plain lines into paragraphs. Knowing the whole run's
 *  longest line tells a printed paragraph's short last line (or a title)
 *  from a line that simply wraps. */
function paragraphs(run: Line[]): Line[][] {
  const maxLen = Math.max(...run.map((l) => l.text.trim().length));
  const out: Line[][] = [];
  let current: Line[] = [];
  let chars = 0;
  run.forEach((line, i) => {
    current.push(line);
    chars += line.text.length + 1;
    const next = run[i + 1];
    if (!next) return;
    const text = line.text.trim();
    const startsNext = STARTS_SENTENCE.test(next.text.trim());
    const endsSentence = ENDS_SENTENCE.test(text);
    const shortLine = text.length < maxLen * 0.7;
    // "Chapter 4. Cellular respiration" over a full line of body text.
    const titleLine = current.length === 1 && text.length < maxLen * 0.55 && !endsSentence && !/[,\-–]$/.test(text);
    if (startsNext && ((endsSentence && (shortLine || chars > LONG_PARAGRAPH)) || titleLine)) {
      out.push(current);
      current = [];
      chars = 0;
    }
  });
  if (current.length) out.push(current);
  return out;
}

export function readerBlocks(content: string): ReaderBlock[] {
  const blocks: ReaderBlock[] = [];
  let page: number | undefined;
  let prose: Line[] = [];
  let listLines: Line[] = [];

  const emit = (kind: "prose" | "lines", group: Line[]) => {
    const first = group[0];
    const last = group[group.length - 1];
    const lead = kind === "prose" ? first.text.length - first.text.trimStart().length : 0;
    const start = first.at + lead;
    const end = last.at + last.text.trimEnd().length;
    if (end > start) blocks.push({ kind, at: start, text: content.slice(start, end), ...(page ? { page } : {}) });
  };
  const flushProse = () => {
    if (prose.length) for (const para of paragraphs(prose)) emit("prose", para);
    prose = [];
  };
  const flushLines = () => {
    if (listLines.length) emit("lines", listLines);
    listLines = [];
  };
  const flush = () => {
    flushProse();
    flushLines();
  };

  const all = lines(content);
  for (let i = 0; i < all.length; i++) {
    const line = all[i];
    const trimmed = line.text.trim();

    if (!trimmed) {
      flush();
      continue;
    }

    if (FENCE.test(line.text)) {
      // A fenced block keeps every line, blank ones included, to its fence.
      flush();
      listLines.push(line);
      while (++i < all.length) {
        listLines.push(all[i]);
        if (FENCE.test(all[i].text)) break;
      }
      flushLines();
      continue;
    }

    const marker = PAGE_MARKER.exec(trimmed);
    if (marker) {
      flush();
      page = Number(marker[1]);
      const lead = line.text.indexOf("[");
      blocks.push({ kind: "page", at: line.at + lead, text: trimmed, page });
      continue;
    }

    const heading = HEADING.exec(line.text);
    if (heading) {
      flush();
      const at = line.at + heading[0].length;
      const text = line.text.slice(heading[0].length).trimEnd();
      blocks.push({ kind: "heading", at, text, level: heading[1].length, ...(page ? { page } : {}) });
      continue;
    }

    // List items and table rows keep their lines; an indented line right
    // after one continues it.
    if (LINE_ITEM.test(line.text) || (listLines.length > 0 && /^\s/.test(line.text))) {
      flushProse();
      listLines.push(line);
      continue;
    }

    flushLines();
    prose.push(line);
  }
  flush();
  return blocks;
}

/** The block holding a character offset, or the last one before it. */
export function blockIndexAt(blocks: ReaderBlock[], offset: number): number {
  let found = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].at > offset) break;
    found = i;
  }
  return Math.max(0, found);
}

/** Page a block sits on when the source has no page markers but its page
 *  count is known — an even spread, as good as it gets without markers. */
export function estimatedPage(at: number, totalChars: number, pages?: number): number | undefined {
  if (!pages || totalChars === 0) return undefined;
  return Math.min(pages, Math.floor((at / totalChars) * pages) + 1);
}

/* ── Highlighted runs ─────────────────────────────────────── */

export interface MarkRange {
  id: string;
  start: number;
  end: number;
}

export interface TextRun {
  at: number;
  text: string;
  /** The highlight covering this run, if any. */
  mark?: string;
}

/** Cuts one block's text into plain and highlighted runs. `ranges` must be
 *  sorted and non-overlapping; anything outside the block is ignored. */
export function textRuns(at: number, text: string, ranges: MarkRange[]): TextRun[] {
  const end = at + text.length;
  const runs: TextRun[] = [];
  let cursor = at;
  for (const r of ranges) {
    const from = Math.max(r.start, cursor);
    const to = Math.min(r.end, end);
    if (to <= from) continue;
    if (from > cursor) runs.push({ at: cursor, text: text.slice(cursor - at, from - at) });
    runs.push({ at: from, text: text.slice(from - at, to - at), mark: r.id });
    cursor = to;
  }
  if (cursor < end) runs.push({ at: cursor, text: text.slice(cursor - at) });
  return runs;
}

/* ── Inline Markdown ──────────────────────────────────────── */

export type InlineStyle = "hide" | "strong" | "em" | "code" | "link";

/** A styled or hidden stretch of a block's text, as offsets into it. */
export interface InlineSpan {
  start: number;
  end: number;
  style: InlineStyle;
}

/**
 * Inline Markdown in a block's text: bold, italics, code and links, and
 * the markers around them. Nothing is removed — the reader hides markers
 * with CSS — so every offset still lines up with the source.
 */
export function inlineMarkup(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const taken: [number, number][] = [];
  const free = (a: number, b: number) => taken.every(([s, e]) => b <= s || a >= e);
  const wrap = (a: number, open: number, close: number, b: number, style: InlineStyle) => {
    spans.push({ start: a, end: open, style: "hide" }, { start: open, end: close, style }, { start: close, end: b, style: "hide" });
    taken.push([a, open], [close, b]);
  };

  // Code first: nothing inside it is markup.
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const a = m.index;
    const b = a + m[0].length;
    wrap(a, a + 1, b - 1, b, "code");
    taken.push([a, b]);
  }
  for (const m of text.matchAll(/(!?)\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"\n]*")?\)/g)) {
    const a = m.index;
    const b = a + m[0].length;
    if (!free(a, b)) continue;
    const open = a + m[1].length + 1;
    wrap(a, open, open + m[2].length, b, "link");
  }
  for (const m of text.matchAll(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g)) {
    const a = m.index;
    const b = a + m[0].length;
    if (!free(a, a + 2) || !free(b - 2, b)) continue;
    wrap(a, a + 2, b - 2, b, "strong");
  }
  // Single markers only where they can't be arithmetic or snake_case.
  for (const m of text.matchAll(/(?<![\p{L}\p{N}*_\\])([*_])(?=\S)([^*_\n]*?\S)\1(?![\p{L}\p{N}*_])/gu)) {
    const a = m.index;
    const b = a + m[0].length;
    if (!free(a, a + 1) || !free(b - 1, b)) continue;
    wrap(a, a + 1, b - 1, b, "em");
  }
  return spans;
}

export interface StyledPiece {
  at: number;
  text: string;
  styles: InlineStyle[];
}

/** Cuts a run of a block at every inline span boundary; `spans` are
 *  relative to the block, which starts at `blockAt`. */
export function styledPieces(blockAt: number, run: { at: number; text: string }, spans: InlineSpan[]): StyledPiece[] {
  const start = run.at;
  const end = run.at + run.text.length;
  const cuts = new Set<number>([start, end]);
  for (const s of spans) {
    for (const edge of [blockAt + s.start, blockAt + s.end]) if (edge > start && edge < end) cuts.add(edge);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const pieces: StyledPiece[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const styles = spans.filter((s) => blockAt + s.start <= from && blockAt + s.end >= to).map((s) => s.style);
    pieces.push({ at: from, text: run.text.slice(from - start, to - start), styles });
  }
  return pieces;
}

/** Text with its inline Markdown markers taken out, for quotes. */
export function stripInline(text: string): string {
  const hidden = inlineMarkup(text)
    .filter((s) => s.style === "hide")
    .sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const h of hidden) {
    out += text.slice(cursor, Math.max(cursor, h.start));
    cursor = Math.max(cursor, h.end);
  }
  return out + text.slice(cursor);
}
