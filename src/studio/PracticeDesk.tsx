import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { CaretDown, PenNib, Presentation, X } from "@phosphor-icons/react";
import { db } from "../lib/db";
import { latestAttempts } from "../lib/attempts";
import { WORK_SAVED } from "../lib/activity";
import type { Attempt, Generation, GenerationKind, Source } from "../lib/types";
import { Button, IconButton } from "../ui";
import { ICON } from "../ui/iconScale";
import { Modal, btnGhost, btnLamp, timeAgo } from "./ui";
import ExportMenu from "./ExportMenu";
import ExamPlan from "./ExamPlan";
import StudyStanding from "./StudyStanding";
import { fmtScore } from "./generators/common";
import { ArtifactView, DOCUMENT_TOOLS, FLOW_TITLES, FlowForm, PRACTICE_TOOLS, type Flow } from "./practiceFlows";
import "./study-tools.css";
import "./practice-desk.css";

type Stage =
  | { type: "idle" }
  | { type: "setup"; flow: Flow; quizScope?: string; aidKind?: GenerationKind }
  | { type: "open"; gen: Generation };

const RECENT_SHOWN = 6;
const PRACTICE_KINDS = new Set<GenerationKind>(["quiz", "exam", "flashcards"]);

const RECENT_LABELS: Partial<Record<GenerationKind, string>> = {
  quiz: "Quiz",
  exam: "Mock exam",
  flashcards: "Flashcards",
};

/**
 * Practice mode: the study tools run in the middle of the desk instead of in
 * a dialog, with the tools on the left and the exam plan and weak topics on
 * the right. The notebook keeps it mounted while the student reads or chats,
 * so a sitting in progress is still there when they come back.
 */
export default function PracticeDesk({
  notebookId,
  sourcesVersion,
  onOpenSettings,
}: {
  notebookId: string;
  sourcesVersion: number;
  onOpenSettings?: () => void;
}) {
  const sourcesNoteId = useId();
  const recentId = useId();
  const [sources, setSources] = useState<Pick<Source, "id" | "title">[]>([]);
  // Held as exclusions so a source added later starts included.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<Generation[]>([]);
  const [lastAttempts, setLastAttempts] = useState<Map<string, Attempt>>(new Map());
  const [version, setVersion] = useState(0);
  const [stage, setStage] = useState<Stage>({ type: "idle" });
  const [sitting, setSitting] = useState(false);
  const [pendingStage, setPendingStage] = useState<Stage | null>(null);

  useEffect(() => {
    let current = true;
    void db.sources
      .where("notebookId")
      .equals(notebookId)
      .sortBy("addedAt")
      .then((rows) => {
        if (current) setSources(rows.map(({ id, title }) => ({ id, title })));
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [notebookId, sourcesVersion]);

  const refresh = useCallback(async () => {
    const rows = await db.generations.where("notebookId").equals(notebookId).reverse().sortBy("createdAt");
    setRecent(rows.filter((g) => PRACTICE_KINDS.has(g.kind)).slice(0, RECENT_SHOWN));
    setLastAttempts(await latestAttempts(notebookId).catch(() => new Map<string, Attempt>()));
    setVersion((v) => v + 1);
  }, [notebookId]);

  useEffect(() => {
    void refresh();
    const onSaved = (event: Event) => {
      if ((event as CustomEvent<string>).detail === notebookId) void refresh();
    };
    window.addEventListener(WORK_SAVED, onSaved);
    return () => window.removeEventListener(WORK_SAVED, onSaved);
  }, [notebookId, refresh]);

  const included = useMemo(() => sources.filter((s) => !excluded.has(s.id)), [excluded, sources]);
  // Undefined means "the whole notebook", which also covers sources the list
  // has not loaded yet.
  const sourceIds = included.length === sources.length ? undefined : included.map((s) => s.id);

  /** A quiz or exam with answers in it asks before it is put away. */
  const go = (next: Stage) => {
    if (sitting) setPendingStage(next);
    else setStage(next);
  };
  const leave = () => {
    const next = pendingStage ?? { type: "idle" };
    setPendingStage(null);
    setSitting(false);
    setStage(next);
    void refresh();
  };
  const close = () => {
    go({ type: "idle" });
    void refresh();
  };

  const openFlow = (flow: Flow, extra: Omit<Extract<Stage, { type: "setup" }>, "type" | "flow"> = {}) =>
    go({ type: "setup", flow, ...extra });
  const open = (gen: Generation) => go({ type: "open", gen });

  const activeFlow = stage.type === "setup" ? stage.flow : null;
  const activeKind = stage.type === "setup" ? stage.aidKind : stage.type === "open" ? stage.gen.kind : undefined;

  const toggleSource = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="practice-desk" data-stage={stage.type}>
      <aside className="practice-rail scroll-thin" aria-label="Practice tools">
        <h2 className="practice-rail-title">Practice with</h2>
        <div className="practice-rail-tools">
          {PRACTICE_TOOLS.map((tool) => (
            <button
              key={tool.flow}
              type="button"
              className="practice-rail-tool rule-bookmark"
              aria-current={activeFlow === tool.flow || activeKind === tool.flow ? "true" : undefined}
              data-active={activeFlow === tool.flow || activeKind === tool.flow ? "true" : undefined}
              onClick={() => openFlow(tool.flow)}
            >
              <tool.icon size={ICON.lg} aria-hidden="true" />
              <span>
                <strong>{tool.name}</strong>
                <small>{tool.line}</small>
              </span>
            </button>
          ))}
        </div>

        <details className="practice-rail-more">
          <summary>
            More ways to study
            <CaretDown size={ICON.sm} aria-hidden="true" />
          </summary>
          <div className="practice-rail-more-list">
            {DOCUMENT_TOOLS.map((tool) => (
              <Button
                key={tool.kind}
                variant="ghost"
                size="sm"
                aria-current={activeFlow === "aids" && activeKind === tool.kind ? "true" : undefined}
                onClick={() => openFlow("aids", { aidKind: tool.kind })}
              >
                <tool.icon size={ICON.md} aria-hidden="true" />
                {tool.name}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => openFlow("essay")}>
              <PenNib size={ICON.md} aria-hidden="true" />
              Essay coach
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openFlow("presentation")}>
              <Presentation size={ICON.md} aria-hidden="true" />
              Slides & deck
            </Button>
          </div>
        </details>

        {sources.length > 1 && (
          <fieldset className="practice-sources" aria-describedby={included.length === 0 ? sourcesNoteId : undefined}>
            <legend>Questions come from</legend>
            {sources.map((source) => (
              <label key={source.id}>
                <input type="checkbox" checked={!excluded.has(source.id)} onChange={() => toggleSource(source.id)} />
                <span>{source.title}</span>
              </label>
            ))}
            {included.length === 0 && (
              <p id={sourcesNoteId} className="practice-sources-note">
                Tick at least one source to practice from.
              </p>
            )}
          </fieldset>
        )}

        {recent.length > 0 && (
          <section className="practice-recent" aria-labelledby={recentId}>
            <h3 id={recentId}>Pick up again</h3>
            <ul>
              {recent.map((gen) => {
                const attempt = lastAttempts.get(gen.id);
                return (
                  <li key={gen.id}>
                    <button
                      type="button"
                      aria-current={stage.type === "open" && stage.gen.id === gen.id ? "true" : undefined}
                      onClick={() => open(gen)}
                    >
                      <strong>{gen.title}</strong>
                      <small>
                        <span>{RECENT_LABELS[gen.kind]}</span>
                        <span>{timeAgo(gen.createdAt)}</span>
                        {attempt && (
                          <span className="practice-recent-score">
                            Last {fmtScore(attempt.score)}/{attempt.total}
                          </span>
                        )}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </aside>

      <main className="practice-stage scroll-thin" aria-label="Practice">
        {stage.type === "idle" && (
          <section className="practice-sheet practice-welcome">
            <h1>Practice what you read.</h1>
            <p>
              {sources.length === 0
                ? "Add a source in Understand first. Every question here is written from your own material."
                : "A short quiz is a good start: it shows what stuck and what needs another look."}
            </p>
            {sources.length > 0 && (
              <div className="practice-welcome-actions">
                <Button onClick={() => openFlow("quiz")}>Start a quiz</Button>
                <Button variant="secondary" onClick={() => openFlow("flashcards")}>
                  Make flashcards
                </Button>
              </div>
            )}
          </section>
        )}

        {stage.type === "setup" && (
          <section className="practice-sheet" aria-label={FLOW_TITLES[stage.flow]}>
            <header className="practice-sheet-head">
              <h1>{FLOW_TITLES[stage.flow]}</h1>
              <IconButton size="sm" aria-label="Close" onClick={close}>
                <X size={ICON.md} aria-hidden="true" />
              </IconButton>
            </header>
            <FlowForm
              key={`${stage.flow}:${stage.aidKind ?? ""}:${stage.quizScope ?? ""}`}
              flow={stage.flow}
              notebookId={notebookId}
              sourceIds={sourceIds}
              quizScope={stage.quizScope}
              aidKind={stage.aidKind}
              onDone={(gen) => {
                setStage({ type: "open", gen });
                void refresh();
              }}
              onCancel={close}
              onOpenSettings={onOpenSettings}
            />
          </section>
        )}

        {stage.type === "open" && (
          <section className="practice-sheet" aria-label={stage.gen.title}>
            <header className="practice-sheet-head">
              <h1>{stage.gen.title}</h1>
              <div className="practice-sheet-actions">
                <ExportMenu gen={stage.gen} />
                <IconButton size="sm" aria-label="Close" onClick={close}>
                  <X size={ICON.md} aria-hidden="true" />
                </IconButton>
              </div>
            </header>
            <ArtifactView
              key={stage.gen.id}
              gen={stage.gen}
              notebookId={notebookId}
              onClose={() => {
                setSitting(false);
                setStage({ type: "idle" });
                void refresh();
              }}
              onNewQuiz={() => {
                setSitting(false);
                setStage({ type: "setup", flow: "quiz" });
              }}
              onOpenGeneration={(gen) => {
                setSitting(false);
                setStage({ type: "open", gen });
                void refresh();
              }}
              onSittingChange={setSitting}
            />
          </section>
        )}
      </main>

      <aside className="practice-side scroll-thin" aria-label="Your progress">
        <ExamPlan
          notebookId={notebookId}
          version={version}
          onOpenDeck={open}
          onPractice={(topic) => openFlow("quiz", { quizScope: topic ?? "" })}
          onMockExam={() => openFlow("exam")}
        />
        <StudyStanding notebookId={notebookId} version={version} onPractice={(topic) => openFlow("quiz", { quizScope: topic })} />
      </aside>

      <Modal open={pendingStage !== null} onClose={() => setPendingStage(null)} title="Leave this sitting?">
        <p className="text-body leading-relaxed text-muted">
          Your answers, any solution photos and the timer will be lost. Saved results are not affected.
        </p>
        <div className="flex justify-end gap-3 pt-5">
          <button className={btnGhost} onClick={leave}>
            Leave
          </button>
          <button data-autofocus className={btnLamp} onClick={() => setPendingStage(null)}>
            Keep going
          </button>
        </div>
      </Modal>
    </div>
  );
}
