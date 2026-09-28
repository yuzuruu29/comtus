import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowCounterClockwise, CheckCircle, Plus, Stack } from "@phosphor-icons/react";
import { db } from "../../lib/db";
import { loadDeckProgress, recordRating } from "../../lib/reviews";
import {
  RATINGS,
  buildReviewQueue,
  deckStatus,
  describeNextDue,
  previewIntervals,
  type Rating,
} from "../../lib/srs";
import { useSettings } from "../../lib/settings";
import type { CardProgress, Flashcard, FlashcardsPayload, Generation } from "../../lib/types";
import { Button, Dialog, Field, Input, Textarea } from "../../ui";
import { SPRING } from "../fx";
import { playSfx } from "../companion/sfx";
import { ErrorNote, LampPulse } from "../ui";
import "./flashcard-review.css";

const RATING_LABEL: Record<Rating, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

interface Session {
  /** Card ids still to answer, front first. "Again" sends a card to the back. */
  queue: string[];
  mode: "due" | "all";
  /** Distinct cards answered this session. */
  seen: Set<string>;
  /** Cards that needed another pass this session. */
  relearned: Set<string>;
}

const newSession = (queue: string[], mode: Session["mode"]): Session => ({
  queue,
  mode,
  seen: new Set(),
  relearned: new Set(),
});

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Spaced-repetition review for a flashcard deck. A session holds today's
 * work — due reviews first, then new cards — and a card answered "again"
 * returns at the back of the queue until it sticks. Scheduling lives in
 * src/lib/srs.ts; this component only drives the session.
 */
export function FlashcardsView({ gen, notebookId }: { gen: Generation; notebookId: string }) {
  const sfxOn = useSettings((s) => s.companionSfx !== false);
  const [cards, setCards] = useState<Flashcard[]>(() => (gen.payload as FlashcardsPayload)?.cards ?? []);
  const [progress, setProgress] = useState<Map<string, CardProgress> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const rating = useRef(false);

  const deck = useMemo(() => ({ id: gen.id, notebookId }), [gen.id, notebookId]);
  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  // Open the deck on today's work; an empty queue means the deck is resting.
  useEffect(() => {
    let current = true;
    loadDeckProgress(gen.id)
      .then((rows) => {
        if (!current) return;
        const initialCards = (gen.payload as FlashcardsPayload)?.cards ?? [];
        const queue = buildReviewQueue(initialCards, rows, Date.now());
        setProgress(rows);
        setSession(queue.length ? newSession(queue, "due") : null);
      })
      .catch(() => {
        if (current) setLoadFailed(true);
      });
    return () => {
      current = false;
    };
  }, [gen.id, gen.payload]);

  const currentId = session?.queue[0];
  const card = currentId ? cardsById.get(currentId) : undefined;
  const finished = session !== null && session.queue.length === 0;

  useEffect(() => {
    if (finished) playSfx("unlock", sfxOn);
  }, [finished, sfxOn]);

  const flip = useCallback(() => {
    setFlipped((f) => !f);
    playSfx("cardFlip", sfxOn);
  }, [sfxOn]);

  const rate = useCallback(
    async (answer: Rating) => {
      if (!session || !currentId || rating.current) return;
      rating.current = true;
      setSaveError("");
      try {
        const row = await recordRating(deck, currentId, answer);
        setProgress((prev) => new Map(prev).set(currentId, row));
        setSession((s) => {
          if (!s || s.queue[0] !== currentId) return s;
          const rest = s.queue.slice(1);
          return {
            ...s,
            queue: answer === "again" ? [...rest, currentId] : rest,
            seen: new Set(s.seen).add(currentId),
            relearned: answer === "again" ? new Set(s.relearned).add(currentId) : s.relearned,
          };
        });
        setFlipped(false);
        playSfx(answer === "again" ? "wrong" : "lampClick", sfxOn);
      } catch {
        setSaveError("That answer was not saved. Your deck is unchanged — try again.");
      } finally {
        rating.current = false;
      }
    },
    [currentId, deck, session, sfxOn],
  );

  const studyAll = () => {
    setFlipped(false);
    setSession(newSession(cards.map((c) => c.id), "all"));
  };

  // Space flips, 1–4 answer once the answer is showing.
  useEffect(() => {
    if (!card || addOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.code === "Space") {
        // A focused button already activates on Space; don't flip twice.
        if (target?.closest("button, a")) return;
        e.preventDefault();
        flip();
        return;
      }
      const index = ["1", "2", "3", "4"].indexOf(e.key);
      if (flipped && index >= 0) {
        e.preventDefault();
        void rate(RATINGS[index]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addOpen, card, flip, flipped, rate]);

  const addCard = async (draft: Omit<Flashcard, "id">) => {
    const newCard: Flashcard = { id: `custom-${Date.now().toString(36)}`, ...draft };
    const updated = [...cards, newCard];
    await db.generations.put({
      ...gen,
      title: /^Flashcards · \d+$/.test(gen.title) ? `Flashcards · ${updated.length}` : gen.title,
      payload: { cards: updated } satisfies FlashcardsPayload,
    });
    setCards(updated);
    setAddOpen(false);
    // A new card joins today's session, or opens one if the deck was resting.
    setSession((s) =>
      s && s.queue.length > 0 ? { ...s, queue: [...s.queue, newCard.id] } : newSession([newCard.id], "due"),
    );
  };

  const addDialog = <AddCardDialog open={addOpen} onClose={() => setAddOpen(false)} onSave={addCard} />;

  if (loadFailed) {
    return <ErrorNote>This deck's review history could not be read. Your cards are safe on this device.</ErrorNote>;
  }
  if (!progress) {
    return (
      <div className="fc-rest">
        <LampPulse label="Opening the deck…" />
      </div>
    );
  }

  const now = Date.now();
  const status = deckStatus(cards, progress, now);
  const nextDue = describeNextDue(status.nextDueAt, now);

  if (!session || finished) {
    const reviewed = session?.seen.size ?? 0;
    const relearned = session?.relearned.size ?? 0;
    return (
      <div className="fc-rest" role="status">
        <CheckCircle className="fc-rest-icon" size={34} weight="light" aria-hidden="true" />
        {cards.length === 0 ? (
          <>
            <h3>This deck has no cards yet.</h3>
            <p>Add a card to start reviewing.</p>
          </>
        ) : finished ? (
          <>
            <h3>Session complete.</h3>
            <p>
              {plural(reviewed, "card")} reviewed
              {relearned > 0 ? `, ${relearned} with another pass.` : "."}
              {status.due + status.fresh === 0 && nextDue ? ` The next review is ${nextDue}.` : ""}
            </p>
          </>
        ) : (
          <>
            <h3>Nothing is due in this deck.</h3>
            <p>
              {plural(status.resting, "card")} resting.
              {nextDue ? ` The next review is ${nextDue}.` : ""} Reviewing on schedule keeps each card in memory
              longer.
            </p>
          </>
        )}
        <div className="fc-rest-actions">
          {cards.length > 0 && (
            <Button variant="secondary" icon={<ArrowCounterClockwise size={15} aria-hidden="true" />} onClick={studyAll}>
              Study all {plural(cards.length, "card")}
            </Button>
          )}
          <Button variant="ghost" icon={<Plus size={15} aria-hidden="true" />} onClick={() => setAddOpen(true)}>
            Add card
          </Button>
        </div>
        {addDialog}
      </div>
    );
  }

  if (!card) {
    // The queue named a card that no longer exists; skip it.
    return null;
  }

  const answered = session.seen.size;
  const remaining = new Set(session.queue).size;
  const cardProgress = progress.get(card.id);
  const cardState = session.relearned.has(card.id) ? "Relearning" : cardProgress ? "Review" : "New";
  const previews = previewIntervals(cardProgress, now);

  return (
    <div className="fc-review">
      <div className="fc-meta">
        <span className="fc-meta-count">
          {plural(remaining, "card")} left
          {session.mode === "all" && <span className="fc-meta-mode">Studying all</span>}
        </span>
        <span className="fc-meta-state" data-state={cardState.toLowerCase()}>
          {cardState}
          {card.topic ? ` · ${card.topic}` : ""}
        </span>
      </div>
      <div className="fc-progress" aria-hidden="true">
        <span style={{ ["--done" as string]: answered / Math.max(1, answered + remaining) }} />
      </div>

      <div key={card.id} className="fc-stage">
        <motion.button
          type="button"
          onClick={flip}
          aria-label={flipped ? "Show the question" : "Show the answer"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, rotateY: flipped ? 180 : 0 }}
          transition={{ ...SPRING, stiffness: 260, damping: 26 }}
          className="fc-card"
        >
          <span className="fc-face" aria-hidden={flipped}>
            <span className="fc-face-body fc-face-front">{card.front}</span>
            <span className="fc-face-hint">
              Select to reveal <kbd>Space</kbd>
            </span>
          </span>
          <span className="fc-face fc-face-back" aria-hidden={!flipped}>
            <span className="fc-face-body">{card.back}</span>
            <span className="fc-face-hint">
              How well did you recall it?
            </span>
          </span>
        </motion.button>
      </div>

      {saveError && <ErrorNote>{saveError}</ErrorNote>}

      {flipped ? (
        <div className="fc-rate-grid" role="group" aria-label="Rate your recall">
          {RATINGS.map((r, i) => (
            <button
              key={r}
              type="button"
              className="fc-rate"
              data-rating={r}
              onClick={() => void rate(r)}
              aria-label={`${RATING_LABEL[r]}: next review in ${previews[r]} (key ${i + 1})`}
            >
              <span className="fc-rate-label">{RATING_LABEL[r]}</span>
              <span className="fc-rate-next">{previews[r]}</span>
              <kbd aria-hidden="true">{i + 1}</kbd>
            </button>
          ))}
        </div>
      ) : (
        <div className="fc-reveal">
          <Button onClick={flip} icon={<Stack size={15} aria-hidden="true" />}>
            Show answer
          </Button>
          <Button variant="ghost" size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setAddOpen(true)}>
            Add card
          </Button>
        </div>
      )}
      {addDialog}
    </div>
  );
}

function AddCardDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (card: Omit<Flashcard, "id">) => Promise<void>;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topic, setTopic] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!front.trim() || !back.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ front: front.trim(), back: back.trim(), topic: topic.trim() || undefined });
      setFront("");
      setBack("");
      setTopic("");
    } catch {
      setError("The card was not saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add a card">
      <div className="space-y-4">
        <Field label="Front" hint="A question or term — avoid yes/no prompts.">
          <Input
            autoFocus
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="e.g. Cranial nerve VII function"
          />
        </Field>
        <Field label="Back">
          <Textarea
            rows={3}
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="e.g. Facial nerve: muscles of facial expression and taste on the anterior two-thirds of the tongue."
          />
        </Field>
        <Field label="Topic" hint="Optional">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Neuroanatomy" />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!front.trim() || !back.trim()}>
            Save card
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
