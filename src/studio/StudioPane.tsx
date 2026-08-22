import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  Briefcase,
  ClockCounterClockwise,
  FileText,
  GraduationCap,
  ListChecks,
  PenNib,
  Presentation,
  Question,
  SidebarSimple,
  Stack,
} from "@phosphor-icons/react";
import { db } from "../lib/db";
import type { Generation, GenerationKind } from "../lib/types";
import { SOFT, Spotlight } from "./fx";
import { timeAgo, Modal } from "./ui";
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
import type { QuizPayload, ExamPayload, EssayReviewPayload, DocPayload } from "../lib/types";

type Flow = "quiz" | "exam" | "essay" | "flashcards" | "presentation" | "aids" | null;

const TILES: {
  flow: Exclude<Flow, null> | "aids-kind";
  icon: typeof ListChecks;
  name: string;
  line: string;
  badge?: string;
}[] = [
  { flow: "quiz", icon: ListChecks, name: "Quiz", line: "Quick set, instant rationales" },
  { flow: "exam", icon: GraduationCap, name: "Mock exam", line: "Full simulation or drill" },
  { flow: "essay", icon: PenNib, name: "Essay coach", line: "Prompts + rubric grading" },
  { flow: "flashcards", icon: Stack, name: "Flashcards", line: "Custom cards from sources" },
  {
    flow: "presentation",
    icon: Presentation,
    name: "PPT & Slides",
    line: "Decks and speaker notes",
    badge: "Anthropic",
  },
];

const AID_TILES: { kind: GenerationKind; icon: typeof BookOpen; name: string }[] = [
  { kind: "study-guide", icon: BookOpen, name: "Study guide" },
  { kind: "brief", icon: Briefcase, name: "Briefing doc" },
  { kind: "faq", icon: Question, name: "FAQ" },
  { kind: "timeline", icon: ClockCounterClockwise, name: "Timeline" },
];

const FLOW_TITLES: Record<string, string> = {
  quiz: "Quiz",
  exam: "Mock exam",
  essay: "Essay coach",
  flashcards: "Flashcards",
  presentation: "PPT & Slideshow Maker (Anthropic Exclusive)",
  aids: "Study aid",
};

export default function StudioPane({
  notebookId,
  onCollapse,
}: {
  notebookId: string;
  onCollapse?: () => void;
}) {
  const [gens, setGens] = useState<Generation[]>([]);
  const [flow, setFlow] = useState<Flow>(null);
  const [aidKind, setAidKind] = useState<GenerationKind | undefined>(undefined);
  const [viewing, setViewing] = useState<Generation | null>(null);

  const refresh = useCallback(() => {
    void db.generations
      .where("notebookId")
      .equals(notebookId)
      .reverse()
      .sortBy("createdAt")
      .then(setGens);
  }, [notebookId]);

  useEffect(refresh, [refresh]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-[var(--desk-pad)] pb-2 pt-3">
        <div className="text-[12px] text-muted">Studio</div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="rounded p-1 text-muted transition-colors hover:text-ink"
            aria-label="Collapse studio"
          >
            <SidebarSimple size={16} weight="light" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        <div className="flex flex-col">
          {TILES.map((t, i) => (
            <Spotlight key={t.name} className="anim-rise rounded-[var(--radius-control)]" radius={200} style={{ ["--d" as string]: `${i * 40}ms` }}>
            <button
              onClick={() => setFlow(t.flow as Flow)}
              className="flex w-full items-start gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-left hover:bg-ink/[0.04]"
            >
              <t.icon size={16} weight="light" className="mt-0.5 shrink-0 text-brasspale/80" />
              <span className="min-w-0">
                <span className="block text-[13px] text-ink/95">
                  {t.name}
                  {t.badge && <span className="ml-2 text-[10px] text-muted">{t.badge}</span>}
                </span>
                <span className="block text-label leading-snug text-muted">{t.line}</span>
              </span>
            </button>
            </Spotlight>
          ))}
        </div>

        <div className="mt-1 flex flex-col">
          {AID_TILES.map((t) => (
            <button
              key={t.kind}
              onClick={() => openAid(t.kind)}
              className="flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-left hover:bg-ink/[0.04]"
            >
              <t.icon size={16} weight="light" className="shrink-0 text-muted" />
              <span className="truncate text-[13px] text-ink/85">{t.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 border-t border-hairline px-2.5 pt-4">
          <div className="mb-2 text-[12px] text-muted">Saved work</div>
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {gens.map((g) => (
                <Spotlight key={g.id} className="hover-lift rounded-xl" radius={180}>
                <motion.button
                  layout
                  onClick={() => setViewing(g)}
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -12, scale: 0.96, transition: { duration: 0.18 } }}
                  transition={SOFT}
                  className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-ink/[0.015] px-3.5 py-2.5 text-left"
                >
                  <FileText size={13} weight="light" className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-ink/90">{g.title}</span>
                    <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-muted/60">
                      {g.kind} · {timeAgo(g.createdAt)}
                    </span>
                  </span>
                </motion.button>
                </Spotlight>
              ))}
            </AnimatePresence>
            {gens.length === 0 && (
              <p className="px-1 py-4 text-[12.5px] leading-relaxed text-muted">
                Quizzes, exams, essays, and aids you generate collect here.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Generator flows */}
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
            onDone={done}
            onCancel={() => setFlow(null)}
          />
        )}
        {flow === "exam" && (
          <ExamConfigForm
            notebookId={notebookId}
            onDone={done}
            onCancel={() => setFlow(null)}
          />
        )}
        {flow === "essay" && (
          <EssayConfigForm
            notebookId={notebookId}
            onDone={done}
            onCancel={() => setFlow(null)}
          />
        )}
        {flow === "flashcards" && (
          <FlashcardsConfigForm
            notebookId={notebookId}
            onDone={done}
            onCancel={() => setFlow(null)}
          />
        )}
        {flow === "presentation" && (
          <PresentationConfigForm
            notebookId={notebookId}
            onDone={done}
            onCancel={() => setFlow(null)}
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

      {/* Artifact viewers */}
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
        {viewing && <ArtifactView gen={viewing} notebookId={notebookId} onRetake={() => setViewing(null)} />}
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
      return (
        <QuizTaker
          payload={gen.payload as QuizPayload}
          onRetake={onRetake}
          onRegenerate={() => {
            onRetake();
          }}
        />
      );
    case "exam":
      return <ExamRunner payload={gen.payload as ExamPayload} onExit={onRetake} />;
    case "essay-review":
      return <EssayFeedback payload={gen.payload as EssayReviewPayload} />;
    case "flashcards":
      return <FlashcardsView gen={gen} notebookId={notebookId} />;
    case "presentation":
    case "slideshow":
      return <SlideshowView gen={gen} />;
    default:
      return <DocViewer payload={gen.payload as DocPayload} />;
  }
}
