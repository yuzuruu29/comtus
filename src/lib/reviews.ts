import { db } from "./db";
import { notifyDeskActivity } from "./activity";
import { progressId, schedule, type Rating } from "./srs";
import type { CardProgress, FlashcardsPayload, Generation } from "./types";

/**
 * Flashcard review persistence: the IndexedDB side of src/lib/srs.ts.
 * Progress rows are keyed `${generationId}:${cardId}`; every read here
 * joins back to the live deck so progress for deleted decks or cards is
 * never counted.
 */

const cardIdOf = (row: CardProgress) => row.id.slice(row.generationId.length + 1);

/** A deck's progress rows, keyed by card id. */
export async function loadDeckProgress(generationId: string): Promise<Map<string, CardProgress>> {
  const rows = await db.cardProgress.where("generationId").equals(generationId).toArray();
  return new Map(rows.map((row) => [cardIdOf(row), row]));
}

/** Schedules one answer and stores it. Returns the written row. */
export async function recordRating(
  gen: Pick<Generation, "id" | "notebookId">,
  cardId: string,
  rating: Rating,
  now = Date.now(),
): Promise<CardProgress> {
  const id = progressId(gen.id, cardId);
  const row = await db.transaction("rw", db.cardProgress, async () => {
    const existing = await db.cardProgress.get(id);
    const next: CardProgress = {
      id,
      generationId: gen.id,
      notebookId: gen.notebookId,
      ...schedule(existing, rating, now),
    };
    await db.cardProgress.put(next);
    return next;
  });
  notifyDeskActivity();
  return row;
}

/** Drops a deck's schedule once its deletion is final (after Undo expires). */
export async function purgeDeckProgress(generationId: string): Promise<void> {
  const deckExists = await db.generations.get(generationId);
  if (deckExists) return;
  await db.cardProgress.where("generationId").equals(generationId).delete();
}

export interface DueDeck {
  generationId: string;
  notebookId: string;
  notebookName: string;
  title: string;
  /** Cards studied before and due now. */
  due: number;
  /** Cards in the deck. */
  total: number;
}

/** Decks with reviews due, across every notebook, most due first. Decks
 *  never studied are left out: an unstarted deck is not a debt. */
export async function listDueDecks(now = Date.now()): Promise<DueDeck[]> {
  const dueRows = await db.cardProgress.where("dueAt").belowOrEqual(now).toArray();
  if (dueRows.length === 0) return [];

  const dueCards = new Map<string, Set<string>>();
  for (const row of dueRows) {
    const set = dueCards.get(row.generationId) ?? new Set<string>();
    set.add(cardIdOf(row));
    dueCards.set(row.generationId, set);
  }

  const genIds = [...dueCards.keys()];
  const gens = await db.generations.bulkGet(genIds);
  const decks = gens.filter((g): g is Generation => g?.kind === "flashcards");
  const notebooks = await db.notebooks.bulkGet([...new Set(decks.map((g) => g.notebookId))]);
  const notebookNames = new Map(notebooks.flatMap((nb) => (nb ? [[nb.id, nb.name] as const] : [])));

  const out: DueDeck[] = [];
  for (const gen of decks) {
    const notebookName = notebookNames.get(gen.notebookId);
    if (notebookName === undefined) continue;
    const cards = (gen.payload as FlashcardsPayload)?.cards ?? [];
    const dueIds = dueCards.get(gen.id)!;
    const due = cards.filter((card) => dueIds.has(card.id)).length;
    if (due === 0) continue;
    out.push({
      generationId: gen.id,
      notebookId: gen.notebookId,
      notebookName,
      title: gen.title,
      due,
      total: cards.length,
    });
  }
  return out.sort((a, b) => b.due - a.due || a.title.localeCompare(b.title));
}
