import { db } from "./db";
import type {
  ChatMessage,
  ChatSession,
  DocPayload,
  ExamPayload,
  FlashcardsPayload,
  Generation,
  NotePayload,
  QuizPayload,
} from "./types";

/**
 * Search across the whole library — sources, conversations, notes and
 * saved study work — for the command palette. Everything stays on the
 * device: the palette builds a snapshot when it opens and every keystroke
 * filters that snapshot in memory.
 *
 * Matching is case- and accent-insensitive and works in any script;
 * every word of the query must appear somewhere in the item.
 */

export type SearchTarget =
  | { kind: "source"; sourceId: string; at: number }
  | { kind: "chat"; sessionId: string }
  | { kind: "work"; generationId: string };

export interface LibraryHit {
  id: string;
  group: "Sources" | "Saved work" | "Conversations";
  notebookId: string;
  notebookName: string;
  title: string;
  /** Text around the first match, with the match's span inside it. */
  snippet: { text: string; start: number; end: number } | null;
  target: SearchTarget;
  score: number;
  updatedAt: number;
}

interface Doc {
  id: string;
  group: LibraryHit["group"];
  notebookId: string;
  title: string;
  body: string;
  foldedTitle: string;
  foldedBody: string;
  updatedAt: number;
  target: (matchAt: number) => SearchTarget;
}

export interface LibrarySnapshot {
  docs: Doc[];
  notebookNames: Map<string, string>;
}

const folded = new Map<string, string>();

function foldChar(ch: string): string {
  let out = folded.get(ch);
  if (out === undefined) {
    const lower = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    // Never change length: match offsets must map straight back to the text.
    out = lower.length === ch.length ? lower : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
    folded.set(ch, out);
  }
  return out;
}

/** Lowercase and drop Latin/Greek/Cyrillic accents without moving any
 *  character. Plain ASCII takes the fast path; only capitals and
 *  non-ASCII characters are looked at individually. */
export function foldForSearch(text: string): string {
  return text.replace(/[A-Z]|[^\u0000-\u007f]/gu, foldChar);
}

export function queryTerms(query: string): string[] {
  return foldForSearch(query)
    .split(/[\s,.;:!?"'()[\]{}]+/u)
    .filter(Boolean);
}

/** Enough to search: two characters, or one in a script without spaces. */
export function isSearchable(query: string): boolean {
  const q = query.trim();
  return q.length >= 2 || /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(q);
}

function generationText(gen: Generation): string {
  const p = gen.payload as Record<string, unknown> | undefined;
  switch (gen.kind) {
    case "note":
      return (p as NotePayload | undefined)?.content ?? "";
    case "flashcards":
      return ((p as FlashcardsPayload | undefined)?.cards ?? []).map((c) => `${c.front}\n${c.back}`).join("\n\n");
    case "quiz":
    case "exam":
      return ((p as QuizPayload | ExamPayload | undefined)?.questions ?? [])
        .map((q) => `${q.stem}\n${q.answer}\n${q.rationale}`)
        .join("\n\n");
    default: {
      const markdown = (p as Partial<DocPayload> | undefined)?.markdown;
      return typeof markdown === "string" ? markdown : "";
    }
  }
}

function doc(input: Omit<Doc, "foldedTitle" | "foldedBody">): Doc {
  return { ...input, foldedTitle: foldForSearch(input.title), foldedBody: foldForSearch(input.body) };
}

/** Reads the library once. Chat messages are grouped per conversation. */
export async function loadLibrarySnapshot(): Promise<LibrarySnapshot> {
  const [notebooks, sources, sessions, messages, generations] = await Promise.all([
    db.notebooks.toArray(),
    db.sources.toArray(),
    db.chatSessions.toArray(),
    db.messages.toArray(),
    db.generations.toArray(),
  ]);
  const notebookNames = new Map(notebooks.map((nb) => [nb.id, nb.name]));
  const docs: Doc[] = [];

  for (const s of sources) {
    docs.push(
      doc({
        id: `source-${s.id}`,
        group: "Sources",
        notebookId: s.notebookId,
        title: s.title,
        body: s.content,
        updatedAt: s.addedAt,
        target: (at) => ({ kind: "source", sourceId: s.id, at }),
      }),
    );
  }

  for (const g of generations) {
    docs.push(
      doc({
        id: `work-${g.id}`,
        group: "Saved work",
        notebookId: g.notebookId,
        title: g.title,
        body: generationText(g),
        updatedAt: g.createdAt,
        target: () => ({ kind: "work", generationId: g.id }),
      }),
    );
  }

  const bySession = new Map<string, ChatMessage[]>();
  for (const m of messages) {
    if (!m.sessionId) continue;
    const list = bySession.get(m.sessionId) ?? [];
    list.push(m);
    bySession.set(m.sessionId, list);
  }
  const sessionById = new Map<string, ChatSession>(sessions.map((s) => [s.id, s]));
  for (const [sessionId, list] of bySession) {
    const session = sessionById.get(sessionId);
    if (!session) continue;
    list.sort((a, b) => a.createdAt - b.createdAt);
    docs.push(
      doc({
        id: `chat-${sessionId}`,
        group: "Conversations",
        notebookId: session.notebookId,
        title: session.title || "Untitled conversation",
        body: list.map((m) => m.content).join("\n\n"),
        updatedAt: session.updatedAt,
        target: () => ({ kind: "chat", sessionId }),
      }),
    );
  }

  return { docs: docs.filter((d) => notebookNames.has(d.notebookId)), notebookNames };
}

const SNIPPET_BEFORE = 48;
const SNIPPET_LENGTH = 150;

function makeSnippet(body: string, at: number, length: number): LibraryHit["snippet"] {
  if (at < 0) return null;
  const from = Math.max(0, at - SNIPPET_BEFORE);
  const raw = body.slice(from, from + SNIPPET_LENGTH);
  // Collapse whitespace while tracking where the match lands.
  const lead = (from > 0 ? "…" : "") + raw.slice(0, at - from).replace(/\s+/g, " ").trimStart();
  const match = raw.slice(at - from, at - from + length).replace(/\s+/g, " ");
  const tail = raw.slice(at - from + length).replace(/\s+/g, " ") + (from + SNIPPET_LENGTH < body.length ? "…" : "");
  return { text: lead + match + tail, start: lead.length, end: lead.length + match.length };
}

/** Items containing every query word; title hits and recent items first. */
export function searchSnapshot(snapshot: LibrarySnapshot, query: string, perGroup = 5): LibraryHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const hits: LibraryHit[] = [];

  for (const d of snapshot.docs) {
    let score = 0;
    let firstAt = -1;
    let firstLen = 0;
    let matchedAll = true;
    for (const term of terms) {
      const inTitle = d.foldedTitle.includes(term);
      const at = d.foldedBody.indexOf(term);
      if (!inTitle && at < 0) {
        matchedAll = false;
        break;
      }
      score += inTitle ? 3 : 1;
      if (at >= 0 && (firstAt < 0 || at < firstAt)) {
        firstAt = at;
        firstLen = term.length;
      }
    }
    if (!matchedAll) continue;
    // The whole phrase appearing verbatim beats scattered words.
    const phrase = terms.join(" ");
    if (terms.length > 1 && (d.foldedTitle.includes(phrase) || d.foldedBody.includes(phrase))) score += 2;

    hits.push({
      id: d.id,
      group: d.group,
      notebookId: d.notebookId,
      notebookName: snapshot.notebookNames.get(d.notebookId) ?? "",
      title: d.title,
      snippet: makeSnippet(d.body, firstAt, firstLen),
      target: d.target(Math.max(0, firstAt)),
      score,
      updatedAt: d.updatedAt,
    });
  }

  const order: LibraryHit["group"][] = ["Sources", "Saved work", "Conversations"];
  return order.flatMap((group) =>
    hits
      .filter((h) => h.group === group)
      .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
      .slice(0, perGroup),
  );
}

/** The route that opens a hit in its notebook. */
export function hitHref(hit: Pick<LibraryHit, "notebookId" | "target">): string {
  const base = `/studio/${encodeURIComponent(hit.notebookId)}`;
  const t = hit.target;
  if (t.kind === "source") return `${base}?source=${encodeURIComponent(t.sourceId)}&at=${t.at}`;
  if (t.kind === "chat") return `${base}?chat=${encodeURIComponent(t.sessionId)}`;
  return `${base}?work=${encodeURIComponent(t.generationId)}`;
}
