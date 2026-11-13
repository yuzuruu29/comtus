import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowCounterClockwise,
  CaretDown,
  FileText,
  ListChecks,
  NotePencil,
  PencilSimple,
  PenNib,
  Plus,
  Presentation,
  SidebarSimple,
  Trash,
  Tray,
} from "@phosphor-icons/react";
import {
  db,
  createCustomNote,
  updateCustomNote,
  deleteGeneration,
  restoreGeneration,
} from "../lib/db";
import { purgeDeckProgress } from "../lib/reviews";
import { latestAttempts } from "../lib/attempts";
import { WORK_SAVED } from "../lib/activity";
import type { Attempt, Generation, GenerationKind, NotePayload } from "../lib/types";
import { DRIFT_X, EXIT, RISE_2, SOFT } from "./fx";
import { Toast } from "./Toast";
import { timeAgo, Modal, Field, inputCls, btnLamp, btnGhost } from "./ui";
import ExportMenu from "./ExportMenu";
import {
  ArtifactView,
  DOCUMENT_TOOLS,
  FLOW_TITLES,
  FlowForm,
  PRACTICE_KINDS,
  PRACTICE_TOOLS,
  type Flow,
} from "./practiceFlows";
import { useDesk } from "./DeskContext";
import StudyStanding from "./StudyStanding";
import ExamPlan from "./ExamPlan";
import { fmtScore } from "./generators/common";
import { kindAccent } from "../lib/milestones";
import { Button, IconButton } from "../ui";
import "./study-tools.css";
import { ICON } from "../ui/iconScale";

type DeletedGenerationNotice = {
  generation: Generation;
  focusUndo: boolean;
};

const KIND_CSS: Record<ReturnType<typeof kindAccent>, string> = {
  brass: "var(--brass)",
  moon: "var(--moon)",
  sage: "var(--sage)",
  rust: "var(--rust)",
};

const KIND_LABELS: Record<GenerationKind, string> = {
  quiz: "Quiz",
  exam: "Mock exam",
  "essay-review": "Essay feedback",
  "study-guide": "Study guide",
  brief: "Briefing doc",
  faq: "FAQ",
  timeline: "Timeline",
  flashcards: "Flashcards",
  presentation: "Presentation",
  slideshow: "Slideshow",
  note: "Note",
  "audio-overview": "Audio overview",
};

const UNDO_DELETE_MS = 5_000;

/** Undo keeps a deleted deck's review schedule; once the deletion is final,
 *  the schedule goes too. Best effort — orphaned rows are never counted. */
function commitDeletion(generation: Generation | undefined) {
  if (generation?.kind === "flashcards") void purgeDeckProgress(generation.id).catch(() => {});
}

export default function StudioPane({
  notebookId,
  onCollapse,
  pendingGenerationId,
  onPendingGenerationConsumed,
  onOpenPractice,
}: {
  notebookId: string;
  onCollapse?: () => void;
  pendingGenerationId?: string | null;
  onPendingGenerationConsumed?: () => void;
  /** Set where a Practice desk exists: the pane then keeps notes and reading
   *  aids, and quizzes, decks and exams move to Practice. */
  onOpenPractice?: (generation?: Generation) => void;
}) {
  const desk = useDesk();
  const createStudyId = useId();
  const savedWorkId = useId();
  const [gens, setGens] = useState<Generation[]>([]);
  const [lastAttempts, setLastAttempts] = useState<Map<string, Attempt>>(new Map());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [quizScope, setQuizScope] = useState("");
  const [aidKind, setAidKind] = useState<GenerationKind | undefined>(undefined);
  const [viewing, setViewing] = useState<Generation | null>(null);
  // A quiz or exam with unfinished work: Escape, the backdrop and the close
  // button ask first instead of discarding answers, photos and the clock.
  const [sittingActive, setSittingActive] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<DeletedGenerationNotice | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const artifactButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Generation | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const refresh = useCallback(async () => {
    const rows = await db.generations
      .where("notebookId")
      .equals(notebookId)
      .reverse()
      .sortBy("createdAt");
    setGens(rows);
    // Scores are a convenience; a failed read leaves the list intact.
    setLastAttempts(await latestAttempts(notebookId).catch(() => new Map<string, Attempt>()));
    setHistoryVersion((v) => v + 1);
  }, [notebookId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Notes saved from chat or the reader, and decks built from quiz misses,
  // land in this list without a reload.
  useEffect(() => {
    const onSaved = (event: Event) => {
      if ((event as CustomEvent<string>).detail === notebookId) void refresh();
    };
    window.addEventListener(WORK_SAVED, onSaved);
    return () => window.removeEventListener(WORK_SAVED, onSaved);
  }, [notebookId, refresh]);

  useEffect(() => {
    if (!pendingGenerationId) return;
    let current = true;
    void db.generations
      .get(pendingGenerationId)
      .then((generation) => {
        if (!current) return;
        // Handing off to Practice consumes the link in the same URL update.
        if (generation?.notebookId === notebookId && onOpenPractice && PRACTICE_KINDS.has(generation.kind)) {
          onOpenPractice(generation);
          return;
        }
        if (generation?.notebookId === notebookId) setViewing(generation);
        onPendingGenerationConsumed?.();
      })
      .catch(() => {
        if (current) onPendingGenerationConsumed?.();
      });
    return () => {
      current = false;
    };
  }, [notebookId, onOpenPractice, onPendingGenerationConsumed, pendingGenerationId]);

  /** With a Practice desk beside it, practice work opens there. */
  const openSaved = (generation: Generation) =>
    onOpenPractice && PRACTICE_KINDS.has(generation.kind) ? onOpenPractice(generation) : setViewing(generation);

  const openQuiz = (scope = "") => {
    setQuizScope(scope);
    setFlow("quiz");
  };

  /** Closing a saved item may have produced an attempt or a new deck. */
  const closeViewer = () => {
    setConfirmLeave(false);
    setSittingActive(false);
    setViewing(null);
    void refresh();
  };
  const requestCloseViewer = () => (sittingActive ? setConfirmLeave(true) : closeViewer());

  /** Swap the viewer to another saved item, e.g. the Missed questions deck. */
  const openGeneration = (generation: Generation) => {
    setViewing(generation);
    void refresh();
  };

  const openAid = (kind: GenerationKind) => {
    setAidKind(kind);
    setFlow("aids");
  };

  const done = (gen: Generation) => {
    setFlow(null);
    setAidKind(undefined);
    void refresh();
    setViewing(gen);
  };

  const handleCreateNote = async () => {
    const trimmedTitle = noteTitle.trim() || "Untitled Note";
    if (editingNote) {
      await updateCustomNote(editingNote.id, trimmedTitle, noteContent);
    } else {
      await createCustomNote(notebookId, trimmedTitle, noteContent);
    }
    setNoteModalOpen(false);
    setEditingNote(null);
    setNoteTitle("");
    setNoteContent("");
    await refresh();
  };

  const openEditNote = (g: Generation) => {
    const p = g.payload as NotePayload;
    setEditingNote(g);
    setNoteTitle(g.title);
    setNoteContent(p?.content || "");
    setNoteModalOpen(true);
  };

  const handleDeleteGen = async (generation: Generation, focusUndo: boolean) => {
    setDeleteError("");
    try {
      const deleted = await deleteGeneration(generation.id);
      if (!deleted) return;
      // A second delete replaces the open notice, which makes the first final.
      commitDeletion(deleteNotice?.generation);
      setDeleteNotice({ generation: deleted, focusUndo });
      await refresh();
    } catch {
      setDeleteError("This saved item could not be removed. Please try again.");
    }
  };

  const handleUndoDelete = async () => {
    const deleted = deleteNotice?.generation;
    if (!deleted) return;
    setDeleteError("");
    try {
      await restoreGeneration(deleted);
      setDeleteNotice(null);
      await refresh();
      const restoreFocus = () => artifactButtonRefs.current.get(deleted.id)?.focus();
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(restoreFocus);
      else restoreFocus();
    } catch {
      setDeleteError("Undo did not complete. Please try again while this notice is open.");
    }
  };

  return (
    <div className="study-tools">
      <div className="pane-head">
        <div className="pane-head-title">
          <h2>{onOpenPractice ? "Notes & guides" : "Study tools"}</h2>
        </div>
        <div className="pane-head-actions">
          {onCollapse && (
            <IconButton
              onClick={onCollapse}
              size="sm"
              aria-label="Collapse studio pane"
              title="Collapse studio"
            >
              <SidebarSimple size={ICON.lg} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </div>

      <div className="study-tools-body scroll-thin">
        {onOpenPractice ? (
        <section aria-labelledby={createStudyId}>
          <div className="study-tools-intro">
            <h3 id={createStudyId}>Make something to read.</h3>
            <p>Guides and summaries written from your sources.</p>
          </div>
          <div className="guide-tools">
            {DOCUMENT_TOOLS.map((tool) => (
              <button key={tool.kind} type="button" className="guide-tool" onClick={() => openAid(tool.kind)}>
                <tool.icon size={ICON.lg} aria-hidden="true" />
                <span className="guide-tool-copy"><strong>{tool.name}</strong><small>{tool.line}</small></span>
              </button>
            ))}
            <button type="button" className="guide-tool" onClick={() => setFlow("presentation")}>
              <Presentation size={ICON.lg} aria-hidden="true" />
              <span className="guide-tool-copy"><strong>Slides & deck</strong><small>An outline you can present from.</small></span>
            </button>
          </div>
          <Button variant="secondary" className="practice-tool rule-bookmark" onClick={() => onOpenPractice()}>
            <span className="practice-tool-icon"><ListChecks size={ICON.xl} aria-hidden="true" /></span>
            <span className="practice-tool-copy">
              <strong>Test yourself in Practice</strong>
              <span>Quizzes, flashcards, mock exams and essay feedback</span>
            </span>
          </Button>
        </section>
        ) : (
        <section aria-labelledby={createStudyId}>
          <div className="study-tools-intro">
            <h3 id={createStudyId}>Put it into practice.</h3>
            <p>Work with your material. See what stays.</p>
          </div>
          <div className="practice-tools">
            {PRACTICE_TOOLS.map((tool) => (
              <Button
                key={tool.flow}
                variant="secondary"
                className={`practice-tool rule-bookmark${tool.flow === "quiz" ? " practice-tool-primary" : ""}`}
                onClick={() => (tool.flow === "quiz" ? openQuiz() : setFlow(tool.flow))}
              >
                <span className="practice-tool-icon"><tool.icon size={ICON.xl} aria-hidden="true" /></span>
                <span className="practice-tool-copy">
                  <strong>{tool.name}</strong>
                  <span>{tool.line}</span>
                </span>
              </Button>
            ))}
          </div>
          <details className="study-tools-more">
            <summary>
              <span>More ways to study<small>Guides, writing & presentations</small></span>
              <CaretDown size={ICON.md} aria-hidden="true" />
            </summary>
            <div className="study-tools-secondary">
              {DOCUMENT_TOOLS.map((tool) => (
                <Button key={tool.kind} variant="ghost" size="sm" onClick={() => openAid(tool.kind)}>
                  <tool.icon size={ICON.md} aria-hidden="true" />
                  {tool.name}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setFlow("essay")}>
                <PenNib size={ICON.md} aria-hidden="true" />Essay coach
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setFlow("presentation")}>
                <Presentation size={ICON.md} aria-hidden="true" />Slides & deck
              </Button>
            </div>
          </details>
        </section>
        )}

        <section className="study-saved" aria-labelledby={savedWorkId}>
          <div className="study-saved-heading">
            <div className="study-saved-title">
              <h3 id={savedWorkId}>Saved work</h3>
              <span>{gens.length}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={ICON.sm} aria-hidden="true" />}
              onClick={() => {
                setEditingNote(null);
                setNoteTitle("");
                setNoteContent("");
                setNoteModalOpen(true);
              }}
            >
              Add note
            </Button>
          </div>

          <div className="study-saved-list">
            <AnimatePresence initial={false}>
              {gens.map((g) => {
                const isNote = g.kind === "note";

                return (
                    <motion.div
                      key={g.id}
                      layout
                      initial={{ opacity: 0, y: -RISE_2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -DRIFT_X, transition: EXIT }}
                      transition={SOFT}
                      className="study-saved-row group"
                    >
                      <div
                        className="study-saved-icon"
                        style={{
                          ["--kind" as string]: KIND_CSS[kindAccent(g.kind)],
                        }}
                      >
                        {isNote ? (
                          <NotePencil size={ICON.lg} aria-hidden="true" />
                        ) : (
                          <FileText size={ICON.lg} aria-hidden="true" />
                        )}
                      </div>

                      <button
                        type="button"
                        ref={(node) => {
                          if (node) artifactButtonRefs.current.set(g.id, node);
                          else artifactButtonRefs.current.delete(g.id);
                        }}
                        onClick={() => {
                          if (isNote) {
                            openEditNote(g);
                          } else {
                            openSaved(g);
                          }
                        }}
                        className="study-saved-open"
                      >
                        <h4>{g.title}</h4>
                        <span>
                          <span>{KIND_LABELS[g.kind]}</span>
                          <span>{timeAgo(g.createdAt)}</span>
                          {lastAttempts.has(g.id) && (
                            <span className="study-saved-score">
                              Last {fmtScore(lastAttempts.get(g.id)!.score)}/{lastAttempts.get(g.id)!.total}
                            </span>
                          )}
                        </span>
                      </button>

                      <div className="artifact-actions study-saved-actions">
                        {isNote && (
                          <IconButton
                            size="sm"
                            onClick={() => openEditNote(g)}
                            aria-label={`Edit note ${g.title}`}
                            title="Edit note"
                          >
                            <PencilSimple size={ICON.md} aria-hidden="true" />
                          </IconButton>
                        )}
                        <IconButton
                          size="sm"
                          variant="danger"
                          onClick={(event) => void handleDeleteGen(g, event.detail === 0)}
                          aria-label={`${isNote ? "Delete note" : "Delete saved item"} ${g.title}`}
                          title={isNote ? "Delete note" : "Delete saved item"}
                        >
                          <Trash size={ICON.md} aria-hidden="true" />
                        </IconButton>
                      </div>
                    </motion.div>
                );
              })}
            </AnimatePresence>

            {gens.length === 0 && (
              <div className="study-saved-tray">
                <Tray size={ICON.xl} weight="light" aria-hidden="true" />
                <p className="study-saved-empty">
                  Save an answer, write a note, or make a study set. It waits here when you come back.
                </p>
              </div>
            )}

            {deleteError && (
              <p role="alert" className="rounded-[var(--radius-field)] border border-rust/30 bg-rust/[0.07] px-3 py-2 text-label leading-relaxed text-rust">
                {deleteError}
              </p>
            )}
          </div>
        </section>

        {!onOpenPractice && (
          <>
            <ExamPlan
              notebookId={notebookId}
              version={historyVersion}
              onOpenDeck={openGeneration}
              onPractice={(topic) => openQuiz(topic ?? "")}
              onMockExam={() => setFlow("exam")}
            />
            <StudyStanding notebookId={notebookId} version={historyVersion} onPractice={openQuiz} />
          </>
        )}
      </div>

      {/* Keyed by notice id: a second delete while one is open remounts the
          toast so its fuse restarts, instead of riding the running timer. */}
      <UndoDeleteToast
        key={deleteNotice?.generation.id ?? "none"}
        notice={deleteNotice}
        onUndo={() => void handleUndoDelete()}
        onExpire={() => {
          commitDeletion(deleteNotice?.generation);
          setDeleteNotice(null);
        }}
      />

      {/* Generator modals */}
      <Modal
        open={flow !== null}
        onClose={() => {
          setFlow(null);
          setAidKind(undefined);
        }}
        title={flow ? FLOW_TITLES[flow] ?? "Studio" : ""}
        wide
      >
        {flow && (
          <FlowForm
            flow={flow}
            notebookId={notebookId}
            quizScope={quizScope}
            aidKind={aidKind}
            onDone={done}
            onCancel={() => {
              setFlow(null);
              setAidKind(undefined);
            }}
            onOpenSettings={desk.openSettings}
          />
        )}
      </Modal>

      {/* Custom Note Creator & Editor Modal */}
      <Modal
        open={noteModalOpen}
        onClose={() => {
          setNoteModalOpen(false);
          setEditingNote(null);
        }}
        title={editingNote ? "Edit note" : "New note"}
      >
        <div className="space-y-4">
          <Field label="Note Title">
            <input
              data-autofocus
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title your note…"
              className={inputCls}
            />
          </Field>
          <Field label="Content">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={9}
              placeholder="Write your study notes, insights, or formulas here…"
              className={inputCls + " resize-none leading-relaxed"}
            />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button
              className={btnGhost}
              onClick={() => {
                setNoteModalOpen(false);
                setEditingNote(null);
              }}
            >
              Cancel
            </button>
            <button className={btnLamp} onClick={() => void handleCreateNote()}>
              {editingNote ? "Update note" : "Save note"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Artifact Viewer Modal */}
      <Modal
        open={viewing !== null}
        onClose={requestCloseViewer}
        title={
          <span className="flex items-center gap-3">
            <span className="min-w-0 truncate">{viewing?.title ?? ""}</span>
            {viewing && <ExportMenu gen={viewing} />}
          </span>
        }
        wide
      >
        {viewing && (
          <ArtifactView
            key={viewing.id}
            gen={viewing}
            notebookId={notebookId}
            onClose={closeViewer}
            onNewQuiz={() => {
              closeViewer();
              openQuiz();
            }}
            onOpenGeneration={openGeneration}
            onSittingChange={setSittingActive}
          />
        )}
      </Modal>

      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave this sitting?">
        <p className="text-body leading-relaxed text-muted">
          Your answers, any solution photos and the timer will be lost. Saved results are not affected.
        </p>
        <div className="flex justify-end gap-3 pt-5">
          <button className={btnGhost} onClick={closeViewer}>
            Leave
          </button>
          <button data-autofocus className={btnLamp} onClick={() => setConfirmLeave(false)}>
            Keep going
          </button>
        </div>
      </Modal>
    </div>
  );
}

function UndoDeleteToast({
  notice,
  onUndo,
  onExpire,
}: {
  notice: DeletedGenerationNotice | null;
  onUndo: () => void;
  onExpire: () => void;
}) {
  const undoButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard-triggered deletions hand focus straight to Undo; pointer
  // deletions leave focus alone (contract asserted in StudioPane.test.tsx).
  useEffect(() => {
    if (notice?.focusUndo) undoButtonRef.current?.focus();
  }, [notice]);

  // Shared Toast owns enter/exit motion, the fuse timer and hover/focus
  // pause; expiry commits the deletion via onExpire, Undo restores instead.
  return (
    <Toast
      open={notice !== null}
      onClose={onExpire}
      durationMs={UNDO_DELETE_MS}
      className="fixed bottom-[calc(5.5rem+var(--sab))] right-4 z-[80] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-[var(--radius-dialog)] border border-brass/30 bg-raised px-4 py-3 text-small text-ink shadow-modal lg:bottom-6 lg:right-6"
    >
      {notice && (
        <>
          <span role="status" aria-live="polite" aria-atomic="true" className="min-w-0 truncate">
            Removed “{notice.generation.title}”.
          </span>
          <button
            ref={undoButtonRef}
            type="button"
            onClick={onUndo}
            aria-label="Undo deletion"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-brass/40 bg-brass/[0.09] px-3 py-1.5 font-medium text-brass transition-colors hover:bg-brass/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/70"
          >
            <ArrowCounterClockwise size={ICON.sm} weight="bold" />
            Undo
          </button>
        </>
      )}
    </Toast>
  );
}
