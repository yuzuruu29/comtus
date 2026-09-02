import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  ArrowCounterClockwise,
  Briefcase,
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
import type {
  Generation,
  GenerationKind,
  QuizPayload,
  ExamPayload,
  EssayReviewPayload,
  DocPayload,
  NotePayload,
} from "../lib/types";
import { SOFT, Spotlight } from "./fx";
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
import { kindAccent } from "../lib/milestones";

type Flow = "quiz" | "exam" | "essay" | "flashcards" | "presentation" | "aids" | null;
type DeletedGenerationNotice = {
  generation: Generation;
  focusUndo: boolean;
};

const QUICK_AID_PILLS: { kind: GenerationKind; icon: typeof BookOpen; name: string; kindVar: string }[] = [
  { kind: "study-guide", icon: BookOpen, name: "Study guide", kindVar: "var(--brass)" },
  { kind: "brief", icon: Briefcase, name: "Briefing doc", kindVar: "var(--candle)" },
  { kind: "faq", icon: Question, name: "FAQ", kindVar: "var(--sage)" },
  { kind: "timeline", icon: ClockCounterClockwise, name: "Timeline", kindVar: "var(--brasspale)" },
];

const MORE_TOOLS: {
  flow: Exclude<Flow, null>;
  icon: typeof ListChecks;
  name: string;
  line: string;
  kindVar: string;
}[] = [
  { flow: "quiz", icon: ListChecks, name: "Practice Quiz", line: "Instant checks & rationales", kindVar: "var(--brass)" },
  { flow: "exam", icon: GraduationCap, name: "Mock Exam", line: "Timed simulation & board review", kindVar: "var(--rust)" },
  { flow: "essay", icon: PenNib, name: "Essay Coach", line: "Writing rubric feedback", kindVar: "var(--candle)" },
  { flow: "flashcards", icon: Stack, name: "Flashcards", line: "Spaced repetition deck", kindVar: "var(--sage)" },
  { flow: "presentation", icon: Presentation, name: "Slides & Deck", line: "Visual presentation outline", kindVar: "var(--brasspale)" },
];

const KIND_CSS: Record<ReturnType<typeof kindAccent>, string> = {
  brass: "var(--brass)",
  moon: "var(--candle)",
  sage: "var(--sage)",
  rust: "var(--rust)",
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
  const [flow, setFlow] = useState<Flow>(null);
  const [aidKind, setAidKind] = useState<GenerationKind | undefined>(undefined);
  const [viewing, setViewing] = useState<Generation | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<DeletedGenerationNotice | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const artifactButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  // Note editor modal
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

  // Find latest audio overview if any
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
    <div className="flex min-h-0 flex-1 flex-col bg-surface/40">
      {/* Studio Header matching Screenshot 2 */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3.5">
        <h2 className="font-display text-[15.5px] font-[450] text-ink">Studio</h2>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="rounded-[var(--radius-control)] p-1 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Collapse studio pane"
            title="Collapse studio"
          >
            <SidebarSimple size={17} weight="light" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        {/* Section 1: Audio Overview — Coming Soon */}
        <section aria-labelledby="audio-overview-title">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <h3 id="audio-overview-title" className="font-display text-[14px] font-[450] text-ink">
                Audio Overview
              </h3>
              <span className="rounded-full border border-brass/30 bg-brass/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-brasspale font-semibold">
                Coming Soon
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brass/10 text-brass">
                  <ClockCounterClockwise size={18} weight="light" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-[450] text-ink">
                    2-host audio deep dive
                  </span>
                  <span className="block text-[11px] text-muted line-clamp-1">
                    Interactive conversation analyzing your sources — coming soon
                  </span>
                </div>
              </div>

              <button
                disabled
                className="shrink-0 rounded-full border border-hairline-strong bg-surface px-4 py-1.5 text-[12px] font-medium text-muted cursor-not-allowed opacity-70"
              >
                Soon
              </button>
            </div>
          </div>
        </section>

        {/* Section 2: Notes & Study Tools matching Screenshot 2 */}
        <section aria-labelledby="notes-section-title">
          <div className="flex items-center justify-between mb-2.5">
            <h3 id="notes-section-title" className="font-display text-[14px] font-[450] text-ink">
              Notes
            </h3>
          </div>

          {/* + Add note button (Screenshot 2 primary button) */}
          <button
            onClick={() => {
              setEditingNote(null);
              setNoteTitle("");
              setNoteContent("");
              setNoteModalOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline-strong bg-surface px-4 py-2.5 text-[13px] font-medium text-ink shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/50 hover:bg-raised hover:shadow-[0_4px_16px_-2px_rgba(227,176,75,0.18)] active:scale-[0.98]"
          >
            <Plus size={15} weight="bold" className="text-brass" />
            <span>Add note</span>
          </button>

          {/* Quick Tool Grid (Screenshot 2 4-pill layout) */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUICK_AID_PILLS.map((t) => (
              <button
                key={t.kind}
                onClick={() => openAid(t.kind)}
                className="kind-tile flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium text-ink/90 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3)] active:translate-y-0.5 active:scale-[0.99]"
                style={{ ["--kind" as string]: t.kindVar }}
              >
                <t.icon size={14} weight="light" className="kind-icon shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>

          {/* Extended Tools Drawer (Quiz, Exam, Essay, Flashcards, Slides) */}
          <div className="mt-3 space-y-1 border-t border-hairline pt-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-brasspale mb-1 px-1 font-semibold">
              More Study Generators
            </div>
            {MORE_TOOLS.map((t) => (
              <button
                key={t.flow}
                onClick={() => {
                  setFlow(t.flow);
                }}
                className="kind-tile flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3)] active:translate-y-0.5 active:scale-[0.99]"
                style={{ ["--kind" as string]: t.kindVar }}
              >
                <t.icon size={15} weight="light" className="kind-icon shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-ink">{t.name}</span>
                  <span className="block text-[10.5px] text-muted">{t.line}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Saved Notes & Artifacts List matching Screenshot 2 */}
          <div className="mt-5 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted px-1">
              Saved Work & Notes ({gens.length})
            </div>

            <AnimatePresence initial={false}>
              {gens.map((g) => {
                const isNote = g.kind === "note";

                return (
                  <Spotlight key={g.id} className="rounded-xl" radius={180}>
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
                      transition={SOFT}
                      className="desk-row group flex items-start gap-3 rounded-xl border border-hairline bg-surface/70 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/40 hover:bg-surface hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.4),0_0_14px_-3px_rgba(227,176,75,0.14)]"
                    >
                      {/* Note Icon (Yellow/Gold Notebook icon matching Screenshot 2) */}
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border mt-0.5"
                        style={{
                          ["--kind" as string]: KIND_CSS[kindAccent(g.kind)],
                          background: "color-mix(in srgb, var(--kind) 14%, transparent)",
                          color: "var(--kind)",
                          borderColor: "color-mix(in srgb, var(--kind) 30%, transparent)",
                        }}
                      >
                        {isNote ? (
                          <NotePencil size={16} weight="fill" />
                        ) : (
                          <FileText size={16} weight="fill" />
                        )}
                      </div>

                      {/* Title & Preview */}
                      <button
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
                        className="min-w-0 flex-1 text-left"
                      >
                        <h4 className="truncate text-[13px] font-[500] text-ink group-hover:text-brasspale">
                          {g.title}
                        </h4>
                        <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-muted/70 mt-0.5">
                          {g.kind} · {timeAgo(g.createdAt)}
                        </span>
                      </button>

                      {/* Actions */}
                      <div className="artifact-actions flex items-center gap-0.5 transition-opacity">
                        {isNote && (
                          <button
                            onClick={() => openEditNote(g)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/70"
                            aria-label={`Edit note ${g.title}`}
                            title="Edit note"
                          >
                            <PencilSimple size={13} />
                          </button>
                        )}
                        <button
                          onClick={(event) => void handleDeleteGen(g, event.detail === 0)}
                          className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-rust/10 hover:text-rust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust/70"
                          aria-label={`${isNote ? "Delete note" : "Delete saved item"} ${g.title}`}
                          title={isNote ? "Delete note" : "Delete saved item"}
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    </motion.div>
                  </Spotlight>
                );
              })}
            </AnimatePresence>

            {gens.length === 0 && (
              <p className="px-2 py-6 text-center text-[12px] leading-relaxed text-muted">
                Notes you add and study guides, quizzes, or audio overviews you generate will appear here.
              </p>
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
        onExpire={() => setDeleteNotice(null)}
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
          <QuizConfigForm notebookId={notebookId} onDone={done} onCancel={() => setFlow(null)} />
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
        onClose={() => setViewing(null)}
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
            gen={viewing}
            notebookId={notebookId}
            onRetake={() => setViewing(null)}
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
  onRetake,
}: {
  gen: Generation;
  notebookId: string;
  onRetake: () => void;
}) {
  switch (gen.kind) {
    case "quiz":
      return <QuizTaker payload={gen.payload as QuizPayload} onRetake={onRetake} onRegenerate={onRetake} />;
    case "exam":
      return <ExamRunner payload={gen.payload as ExamPayload} onExit={onRetake} />;
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
