import { useEffect, useState } from "react";
import { CalendarBlank, PencilSimple } from "@phosphor-icons/react";
import { notebookStanding } from "../lib/attempts";
import { reviewCards } from "../lib/cloze";
import { db } from "../lib/db";
import { daysUntil, examCountdown, examDateLabel, fromDateInput, setNotebookExam, toDateInput } from "../lib/exam";
import { startOfLocalDay } from "../lib/srs";
import { buildPlan, type PlanItem, type StudyPlan } from "../lib/studyPlan";
import type { FlashcardsPayload, Generation, Notebook } from "../lib/types";
import { Button, Dialog, Field, Input } from "../ui";
import { ErrorNote } from "./ui";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The exam date and today's plan, in the study tools pane. Without a date
 * it's one quiet line; with one, a few concrete things for today, worked
 * out fresh from what's due — never a tally of days missed.
 */
export default function ExamPlan({
  notebookId,
  version,
  onOpenDeck,
  onPractice,
  onMockExam,
}: {
  notebookId: string;
  /** Bump to re-read after studying. */
  version: number;
  onOpenDeck: (deck: Generation) => void;
  onPractice: (topic?: string) => void;
  onMockExam: () => void;
}) {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [decks, setDecks] = useState<Map<string, Generation>>(new Map());
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    void (async () => {
      const nb = await db.notebooks.get(notebookId);
      if (!current) return;
      setNotebook(nb ?? null);
      if (!nb?.examAt) {
        setPlan(null);
        return;
      }
      const [gens, progress, attempts, standing] = await Promise.all([
        db.generations.where("notebookId").equals(notebookId).toArray(),
        db.cardProgress.where("notebookId").equals(notebookId).toArray(),
        db.attempts.where("notebookId").equals(notebookId).toArray(),
        notebookStanding(notebookId),
      ]);
      if (!current) return;
      const deckRows = gens.filter((g) => g.kind === "flashcards");
      setDecks(new Map(deckRows.map((g) => [g.id, g])));
      setPlan(
        buildPlan({
          now: Date.now(),
          examAt: nb.examAt,
          decks: deckRows.map((g) => ({
            id: g.id,
            title: g.title,
            cards: reviewCards((g.payload as FlashcardsPayload)?.cards ?? []),
          })),
          progress,
          standing,
          attempts,
        }),
      );
    })().catch(() => {
      if (current) setPlan(null);
    });
    return () => {
      current = false;
    };
  }, [notebookId, version, reload]);

  if (!notebook) return null;

  const dialog = editing && (
    <ExamDateDialog
      open
      notebook={notebook}
      onClose={() => setEditing(false)}
      onSaved={() => {
        setEditing(false);
        setReload((n) => n + 1);
      }}
    />
  );

  if (!notebook.examAt) {
    return (
      <section className="exam-plan exam-plan-quiet" aria-label="Exam date">
        <CalendarBlank size={17} aria-hidden="true" />
        <p>
          <strong>Exam coming up?</strong> Add the date and each day gets a short plan.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Add date
        </Button>
        {dialog}
      </section>
    );
  }

  const daysLeft = daysUntil(notebook.examAt);
  const what = notebook.examName?.trim() || "exam";

  if (daysLeft < 0) {
    return (
      <section className="exam-plan exam-plan-quiet" aria-label="Exam date">
        <CalendarBlank size={17} aria-hidden="true" />
        <p>
          Your {what} was on {examDateLabel(notebook.examAt)}. Reviews are back on their usual schedule.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Set the next one
        </Button>
        {dialog}
      </section>
    );
  }

  return (
    <section className="exam-plan" aria-labelledby="exam-plan-title">
      <div className="exam-plan-head">
        <div>
          <h3 id="exam-plan-title">{examCountdown(notebook)}</h3>
          <p>{examDateLabel(notebook.examAt)}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="exam-plan-edit"
          aria-label="Change the exam date"
          title="Change the exam date"
          onClick={() => setEditing(true)}
        >
          <PencilSimple size={15} aria-hidden="true" />
        </Button>
      </div>

      {daysLeft === 0 && <p className="exam-plan-note">A light review is plenty today. The work is done.</p>}

      {plan && plan.items.length > 0 ? (
        <>
          {daysLeft > 0 && <p className="exam-plan-label">For today</p>}
          <ul className="exam-plan-list">
            {plan.items.map((item) => (
              <PlanRow
                key={item.kind}
                item={item}
                onDeck={(id) => {
                  const deck = decks.get(id);
                  if (deck) onOpenDeck(deck);
                }}
                onPractice={onPractice}
                onMockExam={onMockExam}
              />
            ))}
          </ul>
        </>
      ) : (
        daysLeft > 0 && <p className="exam-plan-note">Nothing is due today. Rest is part of remembering, too.</p>
      )}
      {dialog}
    </section>
  );
}

function PlanRow({
  item,
  onDeck,
  onPractice,
  onMockExam,
}: {
  item: PlanItem;
  onDeck: (id: string) => void;
  onPractice: (topic?: string) => void;
  onMockExam: () => void;
}) {
  let title: string;
  let detail: string;
  let action: string;
  let run: () => void;
  switch (item.kind) {
    case "review":
      title = `Review ${plural(item.due, "card")}`;
      detail = `About ${item.minutes} min${item.decks > 1 ? ` across ${item.decks} decks` : ` · ${item.deckTitle}`}`;
      action = "Review";
      run = () => onDeck(item.deckId);
      break;
    case "learn":
      title = `Learn ${plural(item.count, "new card")}`;
      detail = "Enough each day to see every card before the exam";
      action = "Start";
      run = () => onDeck(item.deckId);
      break;
    case "practice":
      title = `Practice ${item.topic}`;
      detail = `${item.percent}% in your recent answers`;
      action = "Practice";
      run = () => onPractice(item.topic);
      break;
    case "first-quiz":
      title = "Take a practice quiz";
      detail = "It shows which topics need the most time";
      action = "Start";
      run = () => onPractice();
      break;
    case "mock-exam":
      title = "Sit a timed mock exam";
      detail = "One this week shows how the real one will feel";
      action = "Start";
      run = onMockExam;
      break;
  }
  return (
    <li className="exam-plan-item" data-kind={item.kind}>
      <span className="exam-plan-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={run} aria-label={`${action}: ${title}`}>
        {action}
      </Button>
    </li>
  );
}

function ExamDateDialog({
  open,
  notebook,
  onClose,
  onSaved,
}: {
  open: boolean;
  notebook: Notebook;
  onClose: () => void;
  onSaved: () => void;
}) {
  const upcoming = notebook.examAt && daysUntil(notebook.examAt) >= 0 ? notebook.examAt : undefined;
  const [date, setDate] = useState(upcoming ? toDateInput(upcoming) : "");
  const [name, setName] = useState(upcoming ? (notebook.examName ?? "") : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const today = toDateInput(Date.now());

  const save = async (clear = false) => {
    const at = clear ? null : fromDateInput(date);
    if (!clear && (at === null || at < startOfLocalDay(Date.now()))) {
      setError("Choose today or a day ahead.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await setNotebookExam(notebook.id, at, name);
      onSaved();
    } catch {
      setError("The date was not saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Exam date">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="text-body leading-relaxed text-muted">
          Comtus plans a little each day up to it, and keeps every flashcard review before the exam.
        </p>
        <Field label="Date">
          <Input type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Name" hint="Optional">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Midterm, Board exam" maxLength={40} />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
          {notebook.examAt && (
            <Button variant="ghost" className="mr-auto" onClick={() => void save(true)} disabled={saving}>
              Remove date
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!date}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
