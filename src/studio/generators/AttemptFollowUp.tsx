import { useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, Stack } from "@phosphor-icons/react";
import { addMissesToDeck, missedQuestions, recordAttempt, type RecordedAttempt } from "../../lib/attempts";
import type { AttemptItem, Generation, QuizQuestion } from "../../lib/types";
import { Button } from "../../ui";
import "./attempt-follow-up.css";
import { ICON } from "../../ui/iconScale";

const percent = (score: number, total: number) => Math.round((score / Math.max(1, total)) * 100);

/**
 * The part of a results screen that looks forward: saves the sitting,
 * compares it with the last one, and turns what was missed into either a
 * focused retake or cards in the notebook's "Missed questions" deck.
 */
export default function AttemptFollowUp({
  gen,
  kind,
  scope,
  questions,
  items,
  ready = true,
  onRetakeMisses,
  onOpenGeneration,
}: {
  /** The quiz or exam sat; without it nothing is saved (previews, tests). */
  gen?: Pick<Generation, "id" | "notebookId">;
  kind: "quiz" | "exam";
  scope: "full" | "misses";
  questions: QuizQuestion[];
  items: AttemptItem[];
  /** False while answers are still being graded; the attempt waits. */
  ready?: boolean;
  onRetakeMisses: (missed: QuizQuestion[]) => void;
  onOpenGeneration?: (gen: Generation) => void;
}) {
  const [recorded, setRecorded] = useState<RecordedAttempt | null>(null);
  const [deckNote, setDeckNote] = useState<{ deck: Generation; added: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const saved = useRef(false);

  const score = items.reduce((s, it) => s + it.credit, 0);
  const missed = missedQuestions(questions, items);

  useEffect(() => {
    if (!gen || !ready || saved.current) return;
    saved.current = true;
    recordAttempt({
      notebookId: gen.notebookId,
      generationId: gen.id,
      kind,
      scope,
      score,
      total: items.length,
      items,
    })
      .then(setRecorded)
      .catch(() => {
        // History is a convenience; the results on screen stay correct.
      });
  }, [gen, items, kind, ready, score, scope]);

  const addToDeck = async () => {
    if (!gen) return;
    setAdding(true);
    setError("");
    try {
      setDeckNote(await addMissesToDeck(gen, missed));
    } catch {
      setError("The cards were not saved. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  // A retake of misses isn't comparable with a full sitting.
  const previous = scope === "full" ? recorded?.previous : undefined;
  const change = previous ? percent(score, items.length) - percent(previous.score, previous.total) : 0;
  const plural = (n: number) => (n === 1 ? "item" : "items");

  return (
    <section className="attempt-follow-up" aria-label="What to do next">
      {previous && (
        <p className="attempt-compare" data-trend={change > 0 ? "up" : change < 0 ? "down" : "same"}>
          {change > 0
            ? `Up ${change} points from last time (${percent(previous.score, previous.total)}%).`
            : change < 0
              ? `Last time you scored ${percent(previous.score, previous.total)}%. These topics are worth another look.`
              : `The same score as last time.`}
        </p>
      )}

      {missed.length > 0 ? (
        <>
          <p className="attempt-missed">
            {missed.length} {plural(missed.length)} to work on
            {scope === "misses" ? " from this retake" : ""}.
          </p>
          <div className="attempt-actions">
            <Button
              variant="secondary"
              icon={<ArrowCounterClockwise size={ICON.md} aria-hidden="true" />}
              onClick={() => onRetakeMisses(missed)}
            >
              Retake the {missed.length} I missed
            </Button>
            {gen && !deckNote && (
              <Button
                variant="ghost"
                loading={adding}
                icon={<Stack size={ICON.md} aria-hidden="true" />}
                onClick={() => void addToDeck()}
              >
                Make {missed.length === 1 ? "a flashcard" : "flashcards"} from them
              </Button>
            )}
          </div>
          {deckNote && (
            <p className="attempt-deck-note" role="status">
              {deckNote.added > 0
                ? `Added ${deckNote.added} ${deckNote.added === 1 ? "card" : "cards"} to Missed questions.`
                : "These are already in Missed questions."}
              {onOpenGeneration && (
                <button type="button" onClick={() => onOpenGeneration(deckNote.deck)}>
                  Review the deck
                </button>
              )}
            </p>
          )}
          {error && (
            <p className="attempt-error" role="alert">
              {error}
            </p>
          )}
        </>
      ) : (
        <p className="attempt-missed">
          {scope === "misses" ? "Every missed item is right this time." : `Nothing missed on this ${kind}.`}
        </p>
      )}
    </section>
  );
}
