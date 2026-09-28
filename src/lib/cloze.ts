import type { Flashcard } from "./types";

/**
 * Cloze cards, in Anki's syntax: "The {{c1::Krebs cycle}} runs in the
 * {{c2::matrix::where?}}". Each number is its own card to review — c1
 * blanks the first answer and shows the second, c2 the other way round —
 * and the card's back holds any extra notes.
 */

const CLOZE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

export const isCloze = (text: string) => /\{\{c\d+::[\s\S]*?\}\}/.test(text);

/** The cloze numbers in a text, in order. */
export function clozeNumbers(text: string): number[] {
  return [...new Set([...text.matchAll(CLOZE)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

/** The prompt for cloze `n`: its answers blanked (or its hint shown). */
export function clozeFront(text: string, n: number): string {
  return text.replace(CLOZE, (_, num: string, answer: string, hint?: string) =>
    Number(num) === n ? `**[${hint?.trim() || "…"}]**` : answer,
  );
}

/** The answer side for cloze `n`: the sentence whole, the answer in bold,
 *  then the card's extra notes. */
export function clozeBack(text: string, n: number, extra = ""): string {
  const full = text.replace(CLOZE, (_, num: string, answer: string) => (Number(num) === n ? `**${answer}**` : answer));
  return extra.trim() ? `${full}\n\n${extra.trim()}` : full;
}

/** The sentence with every cloze filled in, for search and lists. */
export const clozePlain = (text: string) => text.replace(CLOZE, (_, _num: string, answer: string) => answer);

/** Cards as reviewed: each cloze number becomes its own card with its
 *  own schedule (id `<card>~c<n>`); ordinary cards pass through. */
export function reviewCards(cards: Flashcard[]): Flashcard[] {
  return cards.flatMap((card) => {
    const numbers = isCloze(card.front) ? clozeNumbers(card.front) : [];
    if (numbers.length === 0) return [card];
    return numbers.map((n) => ({
      id: `${card.id}~c${n}`,
      front: clozeFront(card.front, n),
      back: clozeBack(card.front, n, card.back),
      ...(card.topic ? { topic: card.topic } : {}),
    }));
  });
}

/* ── Cards from reading ──────────────────────────────────── */

const SENTENCE_END = /[.!?。！？](?=["”’)\]]*(\s|$))/g;
const MAX_SENTENCE = 420;

/**
 * A cloze card from a passage the student selected: the sentence around
 * it with the selection blanked. Line breaks from printed pages fold into
 * spaces and page markers drop out.
 */
export function clozeFromSelection(content: string, start: number, end: number): string | null {
  const answer = content.slice(start, end).replace(/\s+/g, " ").trim();
  if (!answer) return null;

  // Back to the end of the previous sentence or paragraph.
  const before = content.slice(Math.max(0, start - MAX_SENTENCE), start);
  let from = start - before.length;
  const para = before.lastIndexOf("\n\n");
  if (para >= 0) from = start - before.length + para + 2;
  for (const m of before.matchAll(SENTENCE_END)) {
    const at = start - before.length + m.index + 1;
    if (at > from) from = at;
  }

  // Forward to the end of this sentence or paragraph.
  const after = content.slice(end, end + MAX_SENTENCE);
  let to = end + after.length;
  const nextPara = after.indexOf("\n\n");
  if (nextPara >= 0) to = end + nextPara;
  SENTENCE_END.lastIndex = 0;
  const stop = SENTENCE_END.exec(after);
  if (stop && end + stop.index + 1 < to) to = end + stop.index + 1;

  const tidy = (text: string) =>
    text
      .replace(/\[page \d+\]/g, " ")
      .replace(/\s+/g, " ")
      // Two closing braces would end the cloze early.
      .replace(/\}\}/g, "} }");
  const lead = tidy(content.slice(from, start)).trimStart();
  const tail = tidy(content.slice(end, to)).trimEnd();
  const blank = tidy(answer).replace(/::/g, ": :");
  return `${lead}{{c1::${blank}}}${tail}`.trim();
}
