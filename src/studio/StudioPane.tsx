import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  PanelRightClose,
  ListChecks,
  GraduationCap,
  Feather,
  Layers,
  BookOpen,
  Briefcase,
  HelpCircle,
  History,
  FileText,
} from "lucide-react";
import { db } from "../lib/db";
import type { Generation, GenerationKind } from "../lib/types";
import { SOFT } from "./fx";
import { timeAgo, Modal } from "./ui";
import { QuizConfigForm, QuizTaker } from "./generators/QuizFlow";
import { ExamConfigForm, ExamRunner } from "./generators/ExamFlow";
import { EssayConfigForm, EssayFeedback } from "./generators/EssayFlow";
import { AidsConfigForm, DocViewer, FlashcardsConfigForm, FlashcardsView } from "./generators/AidsFlow";
import type { QuizPayload, ExamPayload, EssayReviewPayload, DocPayload } from "../lib/types";

type Flow = "quiz" | "exam" | "essay" | "flashcards" | "aids" | null;

const TILES: { flow: Exclude<Flow, null> | "aids-kind"; icon: typeof ListChecks; name: string; line: string }[] = [
  { flow: "quiz", icon: ListChecks, name: "Quiz", line: "Quick set, instant rationales" },
  { flow: "exam", icon: GraduationCap, name: "Mock exam", line: "Full simulation or drill" },
  { flow: "essay", icon: Feather, name: "Essay coach", line: "Prompts + rubric grading" },
  { flow: "flashcards", icon: Layers, name: "Flashcards", line: "Spaced, from your sources" },
];

const AID_TILES: { kind: GenerationKind; icon: typeof BookOpen; name: string }[] = [
  { kind: "study-guide", icon: BookOpen, name: "Study guide" },
  { kind: "brief", icon: Briefcase, name: "Briefing doc" },
  { kind: "faq", icon: HelpCircle, name: "FAQ" },
  { kind: "timeline", icon: History, name: "Timeline" },
];

const FLOW_TITLES: Record<string, string> = {
  quiz: "Quiz",
  exam: "Mock exam",
  essay: "Essay coach",
  flashcards: "Flashcards",
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
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <div className="label-mono">Studio</div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="rounded p-1 text-faded transition-colors hover:text-parchment"
            aria-label="Collapse studio"
          >
            <PanelRightClose size={14} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-2 gap-2.5">
          {TILES.map((t, i) => (
            <motion.button
              key={t.name}
              onClick={() => setFlow(t.flow as Flow)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SOFT, delay: 0.05 + i * 0.06 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition-colors duration-200 hover:border-brass/30 hover:bg-brass/[0.03]"
            >
              <t.icon size={16} className="text-brasspale/80 transition-transform duration-300 group-hover:-translate-y-0.5" />
              <div className="mt-2.5 text-[13.5px] font-medium text-parchment/95">{t.name}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-faded">{t.line}</div>
            </motion.button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {AID_TILES.map((t, i) => (
            <motion.button
              key={t.kind}
              onClick={() => openAid(t.kind)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SOFT, delay: 0.3 + i * 0.05 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-2.5 text-left transition-colors duration-200 hover:border-brass/25 hover:bg-brass/[0.03]"
            >
              <t.icon size={14} className="shrink-0 text-faded transition-colors duration-200" />
              <span className="truncate text-[12.5px] text-parchment/85">{t.name}</span>
            </motion.button>
          ))}
        </div>

        <div className="mt-7">
          <div className="label-mono mb-3">Saved work</div>
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {gens.map((g) => (
                <motion.button
                  key={g.id}
                  layout
                  onClick={() => setViewing(g)}
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -12, scale: 0.96, transition: { duration: 0.18 } }}
                  transition={SOFT}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-2.5 text-left transition-colors duration-200 hover:border-white/15 hover:bg-white/[0.03]"
                >
                  <FileText size={13} className="shrink-0 text-faded" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-parchment/90">{g.title}</span>
                    <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-faded/60">
                      {g.kind} · {timeAgo(g.createdAt)}
                    </span>
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
            {gens.length === 0 && (
              <p className="px-1 py-4 text-[12.5px] leading-relaxed text-faded">
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
        title={viewing?.title ?? ""}
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
    default:
      return <DocViewer payload={gen.payload as DocPayload} />;
  }
}
