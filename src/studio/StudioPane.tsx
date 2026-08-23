import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  Briefcase,
  ClockCounterClockwise,
  DotsThreeVertical,
  FileText,
  GraduationCap,
  Info,
  ListChecks,
  NotePencil,
  PencilSimple,
  PenNib,
  Plus,
  Presentation,
  Question,
  SidebarSimple,
  SpeakerHigh,
  Stack,
  Trash,
} from "@phosphor-icons/react";
import { db, createCustomNote, updateCustomNote, deleteGeneration } from "../lib/db";
import type {
  Generation,
  GenerationKind,
  QuizPayload,
  ExamPayload,
  EssayReviewPayload,
  DocPayload,
  NotePayload,
  AudioOverviewPayload,
} from "../lib/types";
import { SOFT, Spotlight } from "./fx";
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
import {
  AudioOverviewModal,
  AudioOverviewViewer,
} from "./generators/AudioOverviewFlow";
import { useDesk } from "./DeskContext";

type Flow = "quiz" | "exam" | "essay" | "flashcards" | "presentation" | "aids" | "audio-overview" | null;

const QUICK_AID_PILLS: { kind: GenerationKind; icon: typeof BookOpen; name: string }[] = [
  { kind: "study-guide", icon: BookOpen, name: "Study guide" },
  { kind: "brief", icon: Briefcase, name: "Briefing doc" },
  { kind: "faq", icon: Question, name: "FAQ" },
  { kind: "timeline", icon: ClockCounterClockwise, name: "Timeline" },
];

const MORE_TOOLS: { flow: Exclude<Flow, null>; icon: typeof ListChecks; name: string; line: string }[] = [
  { flow: "quiz", icon: ListChecks, name: "Practice Quiz", line: "Instant checks & rationales" },
  { flow: "exam", icon: GraduationCap, name: "Mock Exam", line: "Timed simulation & board review" },
  { flow: "essay", icon: PenNib, name: "Essay Coach", line: "Writing rubric feedback" },
  { flow: "flashcards", icon: Stack, name: "Flashcards", line: "Spaced repetition deck" },
  { flow: "presentation", icon: Presentation, name: "Slides & Deck", line: "Visual presentation outline" },
];

const FLOW_TITLES: Record<string, string> = {
  quiz: "Quiz",
  exam: "Mock exam",
  essay: "Essay coach",
  flashcards: "Flashcards",
  presentation: "Presentation & Slides",
  aids: "Study aid",
  "audio-overview": "Audio Overview",
};

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
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Note editor modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Generation | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const refresh = useCallback(() => {
    void db.generations
      .where("notebookId")
      .equals(notebookId)
      .reverse()
      .sortBy("createdAt")
      .then(setGens);
  }, [notebookId]);

  useEffect(refresh, [refresh]);

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
  const latestAudio = gens.find((g) => g.kind === "audio-overview");

  const openAid = (kind: GenerationKind) => {
    setAidKind(kind);
    setFlow("aids");
  };

  const done = (gen: Generation) => {
    setFlow(null);
    setAidKind(undefined);
    refresh();
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
    refresh();
  };

  const openEditNote = (g: Generation) => {
    const p = g.payload as NotePayload;
    setEditingNote(g);
    setNoteTitle(g.title);
    setNoteContent(p?.content || "");
    setNoteModalOpen(true);
  };

  const handleDeleteGen = async (id: string) => {
    await deleteGeneration(id);
    refresh();
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
        {/* Section 1: Audio Overview matching Screenshot 2 */}
        <section aria-labelledby="audio-overview-title">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <h3 id="audio-overview-title" className="font-display text-[14px] font-[450] text-ink">
                Audio Overview
              </h3>
              <button
                onClick={() => setInfoOpen((v) => !v)}
                className="text-muted hover:text-ink transition-colors"
                title="Audio Overview information"
                aria-label="Audio Overview information"
              >
                <Info size={14} />
              </button>
            </div>
          </div>

          {infoOpen && (
            <div className="mb-3 rounded-xl border border-moon/30 bg-moon/[0.05] p-3 text-[12px] text-muted leading-relaxed">
              Two AI hosts generate an interactive deep-dive discussion exploring the key insights, debates, and connections across your sources.
            </div>
          )}

          {/* Audio Overview Card */}
          <div className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-sm hover:border-brass/30 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brass/10 text-brass">
                  <SpeakerHigh size={18} weight="light" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-[450] text-ink">
                    {latestAudio ? latestAudio.title : "Click to load the conversation."}
                  </span>
                  <span className="block text-[11px] text-muted line-clamp-1">
                    {latestAudio ? "Deep dive conversation ready" : "2-host discussion based on your sources"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (latestAudio) {
                    setViewing(latestAudio);
                  } else {
                    setFlow("audio-overview");
                  }
                }}
                className="shrink-0 rounded-full border border-hairline-strong bg-surface px-4 py-1.5 text-[12px] font-medium text-ink hover:border-brass/40 hover:bg-raised transition-all"
              >
                {latestAudio ? "Play" : "Load"}
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
            <button
              onClick={() => setShowMoreTools((v) => !v)}
              className="text-muted hover:text-ink transition-colors p-1"
              title="More study tools"
            >
              <DotsThreeVertical size={16} weight="bold" />
            </button>
          </div>

          {/* + Add note button (Screenshot 2 primary button) */}
          <button
            onClick={() => {
              setEditingNote(null);
              setNoteTitle("");
              setNoteContent("");
              setNoteModalOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline-strong bg-surface px-4 py-2.5 text-[13px] font-medium text-ink shadow-sm transition-all hover:border-brass/40 hover:bg-raised active:scale-[0.99]"
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
                className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface/70 px-3 py-2 text-[12px] font-medium text-ink/90 transition-all hover:border-brass/35 hover:bg-raised hover:text-brasspale active:scale-[0.98]"
              >
                <t.icon size={14} weight="light" className="text-muted shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>

          {/* Extended Tools Drawer (Quiz, Exam, Essay, Flashcards, Slides) */}
          <AnimatePresence>
            {showMoreTools && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-1 overflow-hidden border-t border-hairline pt-3"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted mb-1 px-1">
                  More Study Generators
                </div>
                {MORE_TOOLS.map((t) => (
                  <button
                    key={t.flow}
                    onClick={() => {
                      setFlow(t.flow);
                      setShowMoreTools(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-ink/[0.04] transition-colors"
                  >
                    <t.icon size={15} weight="light" className="text-brass shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-[12.5px] font-medium text-ink">{t.name}</span>
                      <span className="block text-[10.5px] text-muted">{t.line}</span>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Saved Notes & Artifacts List matching Screenshot 2 */}
          <div className="mt-5 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted px-1">
              Saved Work & Notes ({gens.length})
            </div>

            <AnimatePresence initial={false}>
              {gens.map((g) => {
                const isNote = g.kind === "note";
                const isAudio = g.kind === "audio-overview";

                return (
                  <Spotlight key={g.id} className="hover-lift rounded-xl" radius={180}>
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
                      transition={SOFT}
                      className="group flex items-start gap-3 rounded-xl border border-hairline bg-surface/70 p-3 hover:border-brass/30 hover:bg-surface transition-colors"
                    >
                      {/* Note Icon (Yellow/Gold Notebook icon matching Screenshot 2) */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 mt-0.5">
                        {isNote ? (
                          <NotePencil size={16} weight="fill" />
                        ) : isAudio ? (
                          <SpeakerHigh size={16} weight="fill" />
                        ) : (
                          <FileText size={16} weight="fill" />
                        )}
                      </div>

                      {/* Title & Preview */}
                      <button
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
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isNote && (
                          <button
                            onClick={() => openEditNote(g)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:text-ink"
                            title="Edit note"
                          >
                            <PencilSimple size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => void handleDeleteGen(g.id)}
                          className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-rust/10 hover:text-rust"
                          title="Delete note"
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
          </div>
        </section>
      </div>

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
        {flow === "audio-overview" && (
          <AudioOverviewModal
            notebookId={notebookId}
            open={true}
            onClose={() => setFlow(null)}
            onDone={done}
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
    case "audio-overview":
      return <AudioOverviewViewer payload={gen.payload as AudioOverviewPayload} onRegenerate={onRetake} />;
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
