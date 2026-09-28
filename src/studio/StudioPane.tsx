import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  ArrowCounterClockwise,
  ArrowUpRight,
  Briefcase,
  CaretDown,
  ClockCounterClockwise,
  FileText,
  GraduationCap,
  ListChecks,
  NotePencil,
  PencilSimple,
  PenNib,
  Plus,
  Presentation,
  Question,
  SidebarSimple,
  Stack,
  Trash,
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
import type {
  Attempt,
  Generation,
  GenerationKind,
  QuizPayload,
  ExamPayload,
  EssayReviewPayload,
  DocPayload,
  NotePayload,
} from "../lib/types";
import { SOFT } from "./fx";
import { Toast } from "./Toast";
import { timeAgo, Modal, Field, inputCls, btnLamp, btnGhost } from "./ui";
import ExportMenu from "./ExportMenu";
import { QuizConfigForm, QuizTaker } from "./generators/QuizFlow";
import { ExamConfigForm, ExamRunner } from "./generators/ExamFlow";
import { EssayConfigForm, EssayFeedback } from "./generators/EssayFlow";
import {
  AidsConfigForm,
  DocViewer,
  FlashcardsConfigForm,
  FlashcardsView,
  PresentationConfigForm,
  SlideshowView,
} from "./generators/AidsFlow";
import { useDesk } from "./DeskContext";
import StudyStanding from "./StudyStanding";
import { fmtScore } from "./generators/common";
import { kindAccent } from "../lib/milestones";
import { Button, IconButton } from "../ui";
import "./study-tools.css";

type Flow = "quiz" | "exam" | "essay" | "flashcards" | "presentation" | "aids" | null;
type DeletedGenerationNotice = {
  generation: Generation;
  focusUndo: boolean;
};

const DOCUMENT_TOOLS: { kind: GenerationKind; icon: typeof BookOpen; name: string }[] = [
  { kind: "study-guide", icon: BookOpen, name: "Study guide" },
  { kind: "brief", icon: Briefcase, name: "Briefing doc" },
  { kind: "faq", icon: Question, name: "FAQ" },
  { kind: "timeline", icon: ClockCounterClockwise, name: "Timeline" },
];

const PRACTICE_TOOLS: {
  flow: Exclude<Flow, null>;
  icon: typeof ListChecks;
  name: string;
  line: string;
  kindVar: string;
}[] = [
  { flow: "quiz", icon: ListChecks, name: "Practice quiz", line: "Check what you know", kindVar: "var(--brass)" },
  { flow: "flashcards", icon: Stack, name: "Flashcards", line: "Remember the key ideas", kindVar: "var(--sage)" },
  { flow: "exam", icon: GraduationCap, name: "Mock exam", line: "Practice under time pressure", kindVar: "var(--rust)" },
];

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

const FLOW_TITLES: Record<string, string> = {
  quiz: "Quiz",
  exam: "Mock exam",
  essay: "Essay coach",
  flashcards: "Flashcards",
  presentation: "Presentation & Slides",
  aids: "Study aid",
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
}: {
  notebookId: string;
  onCollapse?: () => void;
  pendingGenerationId?: string | null;
  onPendingGenerationConsumed?: () => void;
}) {
  const desk = useDesk();
  const [gens, setGens] = useState<Generation[]>([]);
  const [lastAttempts, setLastAttempts] = useState<Map<string, Attempt>>(new Map());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [flow, setFlow] = useState<Flow>(null);
  const [quizScope, setQuizScope] = useState("");
  const [aidKind, setAidKind] = useState<GenerationKind | undefined>(undefined);
  const [viewing, setViewing] = useState<Generation | null>(null);
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

  useEffect(() => {
    if (!pendingGenerationId) return;
    let current = true;
    void db.generations
      .get(pendingGenerationId)
      .then((generation) => {
        if (current && generation?.notebookId === notebookId) setViewing(generation);
        if (current) onPendingGenerationConsumed?.();
      })
      .catch(() => {
        if (current) onPendingGenerationConsumed?.();
      });
    return () => {
      current = false;
    };
  }, [notebookId, onPendingGenerationConsumed, pendingGenerationId]);

  const openQuiz = (scope = "") => {
    setQuizScope(scope);
    setFlow("quiz");
  };

  /** Closing a saved item may have produced an attempt or a new deck. */
  const closeViewer = () => {
    setViewing(null);
    void refresh();
  };

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
      <div className="study-tools-header">
        <h2>Study tools</h2>
        {onCollapse && (
          <IconButton
            onClick={onCollapse}
            size="sm"
            aria-label="Collapse studio pane"
            title="Collapse studio"
          >
            <SidebarSimple size={17} aria-hidden="true" />
          </IconButton>
        )}
      </div>

      <div className="study-tools-body scroll-thin">
        <section aria-labelledby="create-study-title">
          <div className="study-tools-intro">
            <span className="study-tools-eyebrow">Put your learning to work</span>
            <h3 id="create-study-title">Make something from your sources.</h3>
            <p>Choose a format. Make it your own.</p>
          </div>
          <div className="practice-tools">
            {PRACTICE_TOOLS.map((tool) => (
              <Button
                key={tool.flow}
                variant="secondary"
                className="practice-tool"
                onClick={() => (tool.flow === "quiz" ? openQuiz() : setFlow(tool.flow))}
                style={{ ["--kind" as string]: tool.kindVar }}
              >
                <span className="practice-tool-icon"><tool.icon size={19} aria-hidden="true" /></span>
                <span className="practice-tool-copy">
                  <strong>{tool.name}</strong>
                  <span>{tool.line}</span>
                </span>
                <ArrowUpRight className="practice-tool-arrow" size={15} aria-hidden="true" />
              </Button>
            ))}
          </div>
          <details className="study-tools-more">
            <summary>
              <span>More ways to study<small>Guides, writing & presentations</small></span>
              <CaretDown size={16} aria-hidden="true" />
            </summary>
            <div className="study-tools-secondary">
              {DOCUMENT_TOOLS.map((tool) => (
                <Button key={tool.kind} variant="ghost" size="sm" onClick={() => openAid(tool.kind)}>
                  <tool.icon size={16} aria-hidden="true" />
                  {tool.name}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setFlow("essay")}>
                <PenNib size={16} aria-hidden="true" />Essay coach
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setFlow("presentation")}>
                <Presentation size={16} aria-hidden="true" />Slides & deck
              </Button>
            </div>
          </details>
        </section>

        <StudyStanding notebookId={notebookId} version={historyVersion} onPractice={openQuiz} />

        <section className="study-saved" aria-labelledby="saved-work-title">
          <div className="study-saved-heading">
            <div className="study-saved-title">
              <h3 id="saved-work-title">Saved work</h3>
              <span>{gens.length}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={14} aria-hidden="true" />}
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
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
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
                          <NotePencil size={18} aria-hidden="true" />
                        ) : (
                          <FileText size={18} aria-hidden="true" />
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
                            setViewing(g);
                          }
                        }}
                        className="study-saved-open"
                      >
                        <h4>{g.title}</h4>
                        <span>
                          {KIND_LABELS[g.kind]} · {timeAgo(g.createdAt)}
                          {lastAttempts.has(g.id) && (
                            <>
                              {" · "}
                              <span className="study-saved-score">
                                Last {fmtScore(lastAttempts.get(g.id)!.score)}/{lastAttempts.get(g.id)!.total}
                              </span>
                            </>
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
                            <PencilSimple size={15} aria-hidden="true" />
                          </IconButton>
                        )}
                        <IconButton
                          size="sm"
                          variant="danger"
                          onClick={(event) => void handleDeleteGen(g, event.detail === 0)}
                          aria-label={`${isNote ? "Delete note" : "Delete saved item"} ${g.title}`}
                          title={isNote ? "Delete note" : "Delete saved item"}
                        >
                          <Trash size={15} aria-hidden="true" />
                        </IconButton>
                      </div>
                    </motion.div>
                );
              })}
            </AnimatePresence>

            {gens.length === 0 && (
              <div className="study-saved-empty">
                <NotePencil size={24} aria-hidden="true" />
                <h4>Your work, all in one place.</h4>
                <p>Add a note or try a study tool above. Everything you create stays with this notebook.</p>
              </div>
            )}

            {deleteError && (
              <p role="alert" className="rounded-lg border border-rust/30 bg-rust/[0.07] px-3 py-2 text-[11.5px] leading-relaxed text-rust">
                {deleteError}
              </p>
            )}
          </div>
        </section>
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
        {flow === "quiz" && (
          <QuizConfigForm
            notebookId={notebookId}
            defaultScope={quizScope}
            onDone={done}
            onCancel={() => setFlow(null)}
          />
        )}
        {flow === "exam" && (
          <ExamConfigForm notebookId={notebookId} onDone={done} onCancel={() => setFlow(null)} />
        )}
        {flow === "essay" && (
          <EssayConfigForm notebookId={notebookId} onDone={done} onCancel={() => setFlow(null)} />
        )}
        {flow === "flashcards" && (
          <FlashcardsConfigForm notebookId={notebookId} onDone={done} onCancel={() => setFlow(null)} />
        )}
        {flow === "presentation" && (
          <PresentationConfigForm
            notebookId={notebookId}
            onDone={done}
            onCancel={() => setFlow(null)}
            onOpenSettings={desk.openSettings}
          />
        )}
        {flow === "aids" && (
          <AidsConfigForm
            notebookId={notebookId}
            initialKind={aidKind}
            onDone={done}
            onCancel={() => {
              setFlow(null);
              setAidKind(undefined);
            }}
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
              autoFocus
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
        onClose={closeViewer}
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
          />
        )}
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
      className="fixed bottom-[calc(5.5rem+var(--sab))] right-4 z-[80] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-brass/30 bg-raised px-4 py-3 text-[12.5px] text-ink shadow-modal lg:bottom-6 lg:right-6"
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brass/40 bg-brass/[0.09] px-3 py-1.5 font-medium text-brasspale transition-colors hover:bg-brass/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/70"
          >
            <ArrowCounterClockwise size={13} weight="bold" />
            Undo
          </button>
        </>
      )}
    </Toast>
  );
}

function ArtifactView({
  gen,
  notebookId,
  onClose,
  onNewQuiz,
  onOpenGeneration,
}: {
  gen: Generation;
  notebookId: string;
  onClose: () => void;
  onNewQuiz: () => void;
  onOpenGeneration: (gen: Generation) => void;
}) {
  switch (gen.kind) {
    case "quiz":
      return (
        <QuizTaker
          payload={gen.payload as QuizPayload}
          gen={gen}
          onRegenerate={onNewQuiz}
          onOpenGeneration={onOpenGeneration}
        />
      );
    case "exam":
      return (
        <ExamRunner
          payload={gen.payload as ExamPayload}
          gen={gen}
          onExit={onClose}
          onOpenGeneration={onOpenGeneration}
        />
      );
    case "essay-review":
      return <EssayFeedback payload={gen.payload as EssayReviewPayload} />;
    case "flashcards":
      return <FlashcardsView gen={gen} notebookId={notebookId} />;
    case "presentation":
    case "slideshow":
      return <SlideshowView gen={gen} />;
    case "note":
      return (
        <div className="prose max-w-none text-ink text-[14.5px] leading-relaxed whitespace-pre-wrap">
          {(gen.payload as NotePayload)?.content}
        </div>
      );
    default:
      return <DocViewer payload={gen.payload as DocPayload} />;
  }
}
