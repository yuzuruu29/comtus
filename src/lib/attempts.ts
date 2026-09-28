import { db, saveGeneration, uid } from "./db";
import type {
  Attempt,
  AttemptItem,
  Flashcard,
  FlashcardsPayload,
  Generation,
  QuizQuestion,
  SolutionCheck,
} from "./types";

/**
 * Quiz and exam attempts: what the student got right, by topic, over time.
 * Pure helpers score a sitting and turn its misses into flashcards; the
 * rest persists attempts and reads a notebook's standing back.
 */

/* ── Grading ──────────────────────────────────────────────── */

/** Case-, accent- and punctuation-insensitive, in any script. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Typed-answer check for identification items. A blank answer is never
 *  right; a longer fragment of the key ("mitochondri" for "mitochondria")
 *  earns credit as before. */
export function typedAnswerMatches(typed: string, answer: string): boolean {
  const t = normalizeAnswer(typed);
  const a = normalizeAnswer(answer);
  if (!t || !a) return false;
  return t === a || (Array.from(t).length > 3 && a.includes(t));
}

export interface ItemResponse {
  picked: number | null;
  typed: string;
  check: SolutionCheck | null;
}

/** Credit for one item: 1, 0.5 for a partially correct solution, or 0. */
export function itemCredit(q: QuizQuestion, r: ItemResponse): number {
  if (q.format === "solution") {
    return r.check?.verdict === "correct" ? 1 : r.check?.verdict === "partial" ? 0.5 : 0;
  }
  if (q.format === "identification") return typedAnswerMatches(r.typed, q.answer) ? 1 : 0;
  return r.picked === q.answerIndex ? 1 : 0;
}

function isAnswered(q: QuizQuestion, r: ItemResponse): boolean {
  if (q.format === "solution") return r.check !== null;
  if (q.format === "identification") return r.typed.trim().length > 0;
  return r.picked !== null;
}

export function scoreItems(questions: QuizQuestion[], responses: ItemResponse[]): AttemptItem[] {
  return questions.map((q, i) => {
    const r = responses[i] ?? { picked: null, typed: "", check: null };
    return { questionId: q.id, topic: q.topic, credit: itemCredit(q, r), answered: isAnswered(q, r) };
  });
}

/** Questions that didn't earn full credit, in their original order. */
export function missedQuestions(questions: QuizQuestion[], items: AttemptItem[]): QuizQuestion[] {
  const missed = new Set(items.filter((it) => it.credit < 1).map((it) => it.questionId));
  return questions.filter((q) => missed.has(q.id));
}

/* ── Misses → flashcards ──────────────────────────────────── */

const letter = (i: number) => String.fromCharCode(65 + i);

/** A recall card for a missed question. Stems keep their Markdown and math;
 *  the answer side names the key and teaches why. */
export function cardFromQuestion(generationId: string, q: QuizQuestion): Flashcard {
  let front = q.stem.trim();
  if (q.format === "mcq") front += `\n\n${q.options.map((o, i) => `${letter(i)}. ${o}`).join("\n\n")}`;
  if (q.format === "truefalse") front += "\n\nTrue or false?";
  if (q.graph) front += "\n\n_This question has a graph — see the original quiz._";

  const key =
    q.format === "mcq"
      ? `${letter(q.answerIndex)}. ${q.options[q.answerIndex] ?? q.answer}`
      : q.format === "truefalse"
        ? (q.options[q.answerIndex] ?? q.answer)
        : q.answer;
  const back = [`**Answer:** ${key}`, q.rationale.trim()].filter(Boolean).join("\n\n");

  return { id: `m-${generationId}-${q.id}`, front, back, topic: q.topic };
}

/** One "Missed questions" deck per notebook, grown over time. */
export const missesDeckId = (notebookId: string) => `misses-${notebookId}`;

/** Adds cards for the given misses to the notebook's deck, skipping any
 *  already there. Creates the deck on first use. */
export async function addMissesToDeck(
  gen: Pick<Generation, "id" | "notebookId">,
  missed: QuizQuestion[],
): Promise<{ deck: Generation; added: number }> {
  const deckId = missesDeckId(gen.notebookId);
  const existing = await db.generations.get(deckId);
  const cards = existing?.kind === "flashcards" ? ((existing.payload as FlashcardsPayload).cards ?? []) : [];
  const have = new Set(cards.map((c) => c.id));
  const fresh = missed.map((q) => cardFromQuestion(gen.id, q)).filter((c) => !have.has(c.id));
  const deck: Generation = {
    id: deckId,
    notebookId: gen.notebookId,
    kind: "flashcards",
    title: "Missed questions",
    payload: { cards: [...cards, ...fresh] } satisfies FlashcardsPayload,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  if (fresh.length > 0 || !existing) await saveGeneration(deck);
  return { deck, added: fresh.length };
}

/* ── Persistence ──────────────────────────────────────────── */

export interface RecordedAttempt {
  attempt: Attempt;
  /** The most recent earlier full attempt on the same quiz or exam. */
  previous?: Attempt;
}

export async function recordAttempt(input: Omit<Attempt, "id" | "finishedAt">, now = Date.now()): Promise<RecordedAttempt> {
  const earlier = await db.attempts.where("generationId").equals(input.generationId).sortBy("finishedAt");
  const previous = earlier.filter((a) => a.scope === "full").pop();
  const attempt: Attempt = { ...input, id: uid(), finishedAt: now };
  await db.attempts.add(attempt);
  return { attempt, previous };
}

/** Latest full attempt per generation in a notebook, for saved-work rows. */
export async function latestAttempts(notebookId: string): Promise<Map<string, Attempt>> {
  const rows = await db.attempts.where("notebookId").equals(notebookId).sortBy("finishedAt");
  const latest = new Map<string, Attempt>();
  for (const a of rows) if (a.scope === "full") latest.set(a.generationId, a);
  return latest;
}

/* ── Standing by topic ────────────────────────────────────── */

export interface TopicStanding {
  topic: string;
  /** Credit earned over the recent items counted. */
  earned: number;
  /** Recent items counted (at most RECENT_PER_TOPIC). */
  total: number;
  lastSeenAt: number;
}

const RECENT_PER_TOPIC = 12;
const MIN_ITEMS = 2;

/** Topics ranked weakest first, from each topic's most recent items across
 *  every attempt. Recency matters: a topic you've since mastered rises
 *  out of the list on its own. Topics seen fewer than twice are left out. */
export function topicStanding(attempts: Attempt[]): TopicStanding[] {
  const byTopic = new Map<string, { label: string; recent: { credit: number; at: number }[] }>();
  const newestFirst = [...attempts].sort((a, b) => b.finishedAt - a.finishedAt);
  for (const attempt of newestFirst) {
    for (const item of attempt.items) {
      const key = normalizeAnswer(item.topic) || "general";
      const entry = byTopic.get(key) ?? { label: item.topic.trim() || "General", recent: [] };
      if (entry.recent.length < RECENT_PER_TOPIC) entry.recent.push({ credit: item.credit, at: attempt.finishedAt });
      byTopic.set(key, entry);
    }
  }
  return [...byTopic.values()]
    .filter((e) => e.recent.length >= MIN_ITEMS)
    .map((e) => ({
      topic: e.label,
      earned: e.recent.reduce((s, r) => s + r.credit, 0),
      total: e.recent.length,
      lastSeenAt: e.recent[0].at,
    }))
    .sort((a, b) => a.earned / a.total - b.earned / b.total || b.total - a.total || a.topic.localeCompare(b.topic));
}

export async function notebookStanding(notebookId: string): Promise<TopicStanding[]> {
  return topicStanding(await db.attempts.where("notebookId").equals(notebookId).toArray());
}
