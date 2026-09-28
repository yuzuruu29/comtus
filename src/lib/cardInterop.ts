import type { Flashcard } from "./types";

/**
 * Flashcards in and out of Comtus: Anki's plain-text notes format and
 * ordinary spreadsheets (CSV or tab-separated). Cards here are Markdown
 * with $…$ math; Anki fields are HTML with \(…\) math. Cloze cards use
 * Anki's own {{c1::…}} syntax, so they cross unchanged.
 */

/* ── Out: Anki ────────────────────────────────────────────── */

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline Markdown on already-escaped text. */
function inlineHtml(text: string): string {
  return text
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, "<b>$2</b>")
    .replace(/(?<![\p{L}\p{N}*_\\])([*_])(?=\S)([^*_\n]*?\S)\1(?![\p{L}\p{N}*_])/gu, "<i>$2</i>")
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** Block Markdown (paragraphs, bullet and numbered lists) on escaped text. */
function blockHtml(text: string): string {
  const out: string[] = [];
  let list = null as { tag: "ul" | "ol"; items: string[] } | null;
  const closeList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*+•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      const tag = bullet ? "ul" : "ol";
      if (list?.tag !== tag) {
        closeList();
        list = { tag, items: [] };
      }
      list.items.push(inlineHtml(item[1]));
      continue;
    }
    closeList();
    out.push(inlineHtml(line));
  }
  closeList();
  // Line breaks between plain lines; lists already break on their own.
  return out
    .join("<br>")
    .replace(/(<br>)+(<[uo]l>)/g, "$2")
    .replace(/(<\/[uo]l>)(<br>)+/g, "$1")
    .replace(/^(<br>)+|(<br>)+$/g, "");
}

/** Display math $$…$$ and inline $…$ (not "$5 and $10"). */
const MATH = /\$\$([\s\S]+?)\$\$|\$(?=\S)([^$\n]*?\S)\$(?!\d)/g;

/** A card field as Anki HTML, with math in MathJax delimiters. */
export function markdownToAnkiHtml(markdown: string): string {
  let out = "";
  let cursor = 0;
  for (const m of markdown.trim().matchAll(MATH)) {
    out += blockHtml(escapeHtml(markdown.trim().slice(cursor, m.index)));
    out += m[1] !== undefined ? `\\[${escapeHtml(m[1])}\\]` : `\\(${escapeHtml(m[2])}\\)`;
    cursor = m.index + m[0].length;
  }
  return out + blockHtml(escapeHtml(markdown.trim().slice(cursor)));
}

export const isClozeText = (text: string) => /\{\{c\d+::[\s\S]+?\}\}/.test(text);

/** Anki wants tags without spaces; "::" nests them. */
const tagFor = (topic?: string) =>
  topic
    ? `comtus::${topic
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\p{L}\p{N}_-]/gu, "")}`
    : "comtus";

/** One field of a delimited file, quoted when it has to be. */
function field(value: string, delimiter: string): string {
  return value.includes('"') || value.includes(delimiter) || /[\r\n]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** A deck in Anki's notes-in-plain-text format: File → Import in Anki
 *  reads the headers and files each card as Basic or Cloze. */
export function deckToAnki(cards: Flashcard[], deckName: string): string {
  const header = [
    "#separator:tab",
    "#html:true",
    "#notetype column:1",
    `#deck:${deckName.replace(/[\r\n\t]+/g, " ").trim() || "Comtus"}`,
    "#tags column:4",
  ];
  const rows = cards.map((card) =>
    [isClozeText(card.front) ? "Cloze" : "Basic", markdownToAnkiHtml(card.front), markdownToAnkiHtml(card.back), tagFor(card.topic)]
      .map((value) => field(value, "\t"))
      .join("\t"),
  );
  return `${[...header, ...rows].join("\n")}\n`;
}

/* ── Out: spreadsheet ─────────────────────────────────────── */

/** CSV with a header row, Markdown kept as written. The byte-order mark
 *  tells Excel the file is UTF-8. */
export function deckToCsv(cards: Flashcard[]): string {
  const rows = [["Front", "Back", "Topic"], ...cards.map((c) => [c.front, c.back, c.topic ?? ""])];
  return `﻿${rows.map((row) => row.map((v) => field(v, ",")).join(",")).join("\r\n")}\r\n`;
}

/* ── In ───────────────────────────────────────────────────── */

export interface ParsedDeck {
  title: string;
  cards: Flashcard[];
  /** Rows without a front, or without a back on a basic card. */
  skipped: number;
  /** Cards whose images or sounds could not come along. */
  mediaDropped: number;
}

export const MAX_IMPORT_CARDS = 5000;

/** Splits delimited text into rows of fields, honouring quotes (which may
 *  hold delimiters, doubled quotes and line breaks). */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let atFieldStart = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else quoted = false;
      } else value += ch;
      continue;
    }
    if (ch === '"' && atFieldStart) {
      quoted = true;
      atFieldStart = false;
      continue;
    }
    if (ch === delimiter) {
      row.push(value);
      value = "";
      atFieldStart = true;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      atFieldStart = true;
      continue;
    }
    value += ch;
    atFieldStart = false;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
}

const SEPARATORS: Record<string, string> = {
  tab: "\t",
  comma: ",",
  semicolon: ";",
  pipe: "|",
  colon: ":",
  space: " ",
};

/** Tab if any line has one, else whichever of ; or , is more common —
 *  counting only outside quoted fields. */
function guessDelimiter(sample: string): string {
  const lines = sample
    .slice(0, 20_000)
    .replace(/"(?:[^"]|"")*"/g, "")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 20);
  const count = (ch: string) => lines.reduce((n, l) => n + l.split(ch).length - 1, 0);
  if (count("\t") > 0) return "\t";
  return count(";") > count(",") ? ";" : ",";
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** An Anki HTML field as Markdown with $…$ math. Reports whether an image
 *  or sound had to be left behind. */
export function ankiHtmlToMarkdown(html: string): { text: string; droppedMedia: boolean } {
  let droppedMedia = false;
  const text = html
    .replace(/\[sound:[^\]]*\]/g, () => {
      droppedMedia = true;
      return "";
    })
    .replace(/<img\b[^>]*>/gi, () => {
      droppedMedia = true;
      return "";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<\/(div|p|ul|ol|h[1-6]|tr)>/gi, "\n")
    .replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "");
  const markdown = decodeEntities(text)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `$$${m}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `$${m}$`)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: markdown, droppedMedia };
}

const looksLikeHtml = (text: string) => /<(br|div|p|b|i|span|img|ul|ol|li)\b|&(nbsp|amp|lt|gt|#\d+);/i.test(text);

const HEADER_FRONT = /^(front|question|term|prompt|q|text|word)$/i;
const HEADER_BACK = /^(back|answer|definition|meaning|a|back extra|extra)$/i;
const HEADER_TOPIC = /^(topic|tags?|category|subject|deck)$/i;

/** A deck from an Anki plain-text export, a CSV or a tab-separated file. */
export function parseCardFile(text: string, fileName: string): ParsedDeck {
  const body = text.replace(/^﻿/, "");
  const lines = body.split(/\r?\n/);

  // Anki's export headers ("#separator:tab", "#deck:…"), always at the top.
  const headers = new Map<string, string>();
  let first = 0;
  while (first < lines.length && /^#[a-z ]+:/i.test(lines[first])) {
    const [key, ...rest] = lines[first].slice(1).split(":");
    headers.set(key.trim().toLowerCase(), rest.join(":").trim());
    first++;
  }
  const rest = lines.slice(first).join("\n");
  const sep = headers.get("separator")?.toLowerCase();
  const delimiter = sep ? (SEPARATORS[sep] ?? sep) : guessDelimiter(rest);
  const rows = parseDelimited(rest, delimiter);

  const column = (name: string) => {
    const n = Number(headers.get(`${name} column`));
    return Number.isInteger(n) && n > 0 ? n - 1 : -1;
  };
  // Columns that hold something other than card text.
  const notetypeCol = column("notetype");
  const tagsCol = column("tags");
  const skip = new Set([notetypeCol, column("guid"), column("deck"), tagsCol].filter((i) => i >= 0));

  let frontCol = -1;
  let backCol = -1;
  let topicCol = tagsCol;
  // Anki tags are space-separated; a spreadsheet's topic cell is one topic.
  let topicIsTags = tagsCol >= 0;
  const head = rows[0] ?? [];
  if (head.some((v) => HEADER_FRONT.test(v.trim())) && head.some((v) => HEADER_BACK.test(v.trim()))) {
    frontCol = head.findIndex((v) => HEADER_FRONT.test(v.trim()));
    backCol = head.findIndex((v) => HEADER_BACK.test(v.trim()));
    const t = head.findIndex((v) => HEADER_TOPIC.test(v.trim()));
    if (t >= 0) {
      topicCol = t;
      topicIsTags = /^tags?$/i.test(head[t].trim());
    }
    rows.shift();
  }
  if (frontCol < 0) {
    const width = Math.max(0, ...rows.map((r) => r.length));
    const textCols = Array.from({ length: width }, (_, i) => i).filter((i) => !skip.has(i));
    [frontCol, backCol] = [textCols[0] ?? 0, textCols[1] ?? 1];
    if (topicCol < 0 && textCols.length >= 3 && headers.size === 0) topicCol = textCols[2];
  }

  const html = headers.get("html") === "true" || rows.slice(0, 50).some((r) => r.some(looksLikeHtml));
  const clean = (value: string | undefined) => {
    const raw = (value ?? "").trim();
    return html ? ankiHtmlToMarkdown(raw) : { text: raw, droppedMedia: false };
  };

  const cards: Flashcard[] = [];
  let skipped = 0;
  let mediaDropped = 0;
  for (const row of rows) {
    if (cards.length >= MAX_IMPORT_CARDS) {
      skipped++;
      continue;
    }
    const front = clean(row[frontCol]);
    const back = clean(row[backCol]);
    const cloze = isClozeText(front.text) || /^cloze/i.test(row[notetypeCol] ?? "");
    if (!front.text || (!back.text && !cloze)) {
      skipped++;
      continue;
    }
    if (front.droppedMedia || back.droppedMedia) mediaDropped++;
    const topic = topicCol >= 0 ? topicFrom(row[topicCol], topicIsTags) : undefined;
    cards.push({ id: `c${cards.length}`, front: front.text, back: back.text, ...(topic ? { topic } : {}) });
  }

  const title =
    headers.get("deck")?.split("::").pop()?.trim() ||
    fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ||
    "Imported cards";
  return { title, cards, skipped, mediaDropped };
}

/** A topic from a spreadsheet cell, or the first real tag of an Anki tag
 *  list made readable ("comtus::Cell_biology" → "Cell biology"). */
function topicFrom(value: string | undefined, isTags: boolean): string | undefined {
  const cell = (value ?? "").trim();
  if (!isTags) return cell.slice(0, 80) || undefined;
  const tag = cell.split(/\s+/).find((t) => t && !/^(comtus|marked|leech)$/i.test(t));
  if (!tag) return undefined;
  const readable = tag.split("::").pop()!.replace(/_/g, " ").trim();
  return readable || undefined;
}
