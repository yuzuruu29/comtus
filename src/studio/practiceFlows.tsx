import {
  BookOpen,
  Briefcase,
  ClockCounterClockwise,
  GraduationCap,
  ListChecks,
  Question,
  Stack,
} from "@phosphor-icons/react";
import type {
  DocPayload,
  EssayReviewPayload,
  ExamPayload,
  Generation,
  GenerationKind,
  NotePayload,
  QuizPayload,
} from "../lib/types";
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

/** The study tools both desks offer: the study tools pane in Understand, and
 *  the Practice desk, which runs them in place instead of in a dialog. */

export type Flow = "quiz" | "exam" | "essay" | "flashcards" | "presentation" | "aids";

export const DOCUMENT_TOOLS: { kind: GenerationKind; icon: typeof BookOpen; name: string }[] = [
  { kind: "study-guide", icon: BookOpen, name: "Study guide" },
  { kind: "brief", icon: Briefcase, name: "Briefing doc" },
  { kind: "faq", icon: Question, name: "FAQ" },
  { kind: "timeline", icon: ClockCounterClockwise, name: "Timeline" },
];

/* The rows used to carry a tinted icon tile each, which spent three semantic
   colours (sage means verified, rust means error) on decoration. They are ink
   on paper now; the brass bookmark in .rule-bookmark marks the one you are on. */
export const PRACTICE_TOOLS: {
  flow: Flow;
  icon: typeof ListChecks;
  name: string;
  line: string;
}[] = [
  { flow: "quiz", icon: ListChecks, name: "Practice quiz", line: "Check what you know" },
  { flow: "flashcards", icon: Stack, name: "Flashcards", line: "Remember the key ideas" },
  { flow: "exam", icon: GraduationCap, name: "Mock exam", line: "Practice under time pressure" },
];

export const FLOW_TITLES: Record<Flow, string> = {
  quiz: "Quiz",
  exam: "Mock exam",
  essay: "Essay coach",
  flashcards: "Flashcards",
  presentation: "Presentation & Slides",
  aids: "Study aid",
};

/** The set-up form for one tool. */
export function FlowForm({
  flow,
  notebookId,
  sourceIds,
  quizScope,
  aidKind,
  onDone,
  onCancel,
  onOpenSettings,
}: {
  flow: Flow;
  notebookId: string;
  sourceIds?: string[];
  quizScope?: string;
  aidKind?: GenerationKind;
  onDone: (gen: Generation) => void;
  onCancel: () => void;
  onOpenSettings?: () => void;
}) {
  const shared = { notebookId, sourceIds, onDone, onCancel };
  switch (flow) {
    case "quiz":
      return <QuizConfigForm {...shared} defaultScope={quizScope} />;
    case "exam":
      return <ExamConfigForm {...shared} />;
    case "essay":
      return <EssayConfigForm {...shared} />;
    case "flashcards":
      return <FlashcardsConfigForm {...shared} />;
    case "presentation":
      return <PresentationConfigForm {...shared} onOpenSettings={onOpenSettings} />;
    case "aids":
      return <AidsConfigForm {...shared} initialKind={aidKind} />;
  }
}

/** A saved item, opened: a quiz or exam to sit, a deck to review, a document to read. */
export function ArtifactView({
  gen,
  notebookId,
  onClose,
  onNewQuiz,
  onOpenGeneration,
  onSittingChange,
}: {
  gen: Generation;
  notebookId: string;
  onClose: () => void;
  onNewQuiz: () => void;
  onOpenGeneration: (gen: Generation) => void;
  onSittingChange: (active: boolean) => void;
}) {
  switch (gen.kind) {
    case "quiz":
      return (
        <QuizTaker
          payload={gen.payload as QuizPayload}
          gen={gen}
          onRegenerate={onNewQuiz}
          onOpenGeneration={onOpenGeneration}
          onActiveChange={onSittingChange}
        />
      );
    case "exam":
      return (
        <ExamRunner
          payload={gen.payload as ExamPayload}
          gen={gen}
          onExit={onClose}
          onOpenGeneration={onOpenGeneration}
          onActiveChange={onSittingChange}
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
        <div className="prose max-w-none text-ink text-body leading-relaxed whitespace-pre-wrap">
          {(gen.payload as NotePayload)?.content}
        </div>
      );
    default:
      return <DocViewer payload={gen.payload as DocPayload} />;
  }
}
