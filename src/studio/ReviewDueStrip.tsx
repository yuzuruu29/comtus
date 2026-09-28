import { useEffect, useState } from "react";
import { ArrowRight, Cards } from "@phosphor-icons/react";
import { listDueDecks, type DueDeck } from "../lib/reviews";
import { DESK_ACTIVITY } from "../lib/activity";
import "./review-due.css";

const SHOWN = 4;

/**
 * Flashcard decks with reviews due today, across the whole library. Quiet
 * by design: it renders nothing until a studied card comes due, and it
 * never counts decks the student has not started.
 */
export default function ReviewDueStrip({
  onReview,
}: {
  onReview: (notebookId: string, generationId: string) => void;
}) {
  const [decks, setDecks] = useState<DueDeck[]>([]);

  useEffect(() => {
    let current = true;
    const load = () => {
      listDueDecks()
        .then((rows) => {
          if (current) setDecks(rows);
        })
        .catch(() => {
          // A review reminder is optional; a read failure stays silent.
        });
    };
    load();
    // Cards come due with the clock: refresh when the tab returns.
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(DESK_ACTIVITY, load);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(DESK_ACTIVITY, load);
    };
  }, []);

  if (decks.length === 0) return null;

  const totalDue = decks.reduce((sum, d) => sum + d.due, 0);
  const hidden = decks.length - SHOWN;

  return (
    <section className="review-due" aria-labelledby="review-due-title">
      <div className="review-due-head">
        <Cards className="review-due-icon" size={26} weight="light" aria-hidden="true" />
        <div>
          <h2 id="review-due-title">Ready for review</h2>
          <p>
            {totalDue} {totalDue === 1 ? "card is" : "cards are"} due
            {decks.length > 1 ? ` across ${decks.length} decks` : ""}. A short review now keeps them in memory.
          </p>
        </div>
      </div>
      <ul className="review-due-list">
        {decks.slice(0, SHOWN).map((deck) => (
          <li key={deck.generationId}>
            <button
              type="button"
              className="review-due-deck"
              onClick={() => onReview(deck.notebookId, deck.generationId)}
              aria-label={`Review ${deck.due} due ${deck.due === 1 ? "card" : "cards"} in ${deck.notebookName}, ${deck.title}`}
            >
              <span className="review-due-copy">
                <span className="review-due-notebook">{deck.notebookName}</span>
                <span className="review-due-deck-title">{deck.title}</span>
              </span>
              <span className="review-due-count">{deck.due} due</span>
              <ArrowRight className="review-due-arrow" size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="review-due-more">
          {hidden} more {hidden === 1 ? "deck has" : "decks have"} cards due.
        </p>
      )}
    </section>
  );
}
