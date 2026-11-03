import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AssessmentContent, AssessmentGraph } from "../../components/AssessmentContent";
import { assessmentGradingStem, assessmentOptionLabel } from "../../lib/assessmentContent";

import type {
  ExamBlueprint,
  ExamMode,
  ExamPayload,
  Generation,
  QuizQuestion,
  SolutionCheck,
} from "../../lib/types";
import { generateJSON, checkSolution, friendlyError } from "../../lib/llm";
import { useCallSettings } from "../../lib/settings";
import { scoreItems } from "../../lib/attempts";
import AttemptFollowUp from "./AttemptFollowUp";
import { saveGeneration } from "../../lib/db";
import { DUR, DRIFT_X, ENTER, EXIT, SOFT, SPRING, useCountUp } from "../fx";
import {
  GENERATOR_SYSTEM,
  ASSESSMENT_FORMAT_RULES,
  buildSourceBlock,
  sanitizeQuestions,
  fmtScore,
} from "./common";
import {
  SolutionBin,
  SolutionVerdictCard,
  AiCheckNote,
  type SolutionSubmission,
} from "./SolutionBin";
import { Field, inputCls, btnLamp, btnGhost, LampPulse, ErrorNote } from "../ui";
import { ArrowCounterClockwise, Check, GraduationCap, Minus, PencilSimpleLine, Timer, X } from "@phosphor-icons/react";
import { ICON } from "../../ui/iconScale";

/* ── PH PRC presets ───────────────────────────────────────── */

export const EXAM_PRESETS: { id: string; name: string; blurb: string; blueprint: ExamBlueprint }[] = [
  {
    id: "pnle",
    name: "PNLE",
    blurb: "Philippine Nurse Licensure Exam",
    blueprint: {
      preset: "pnle",
      title: "PNLE — Full Simulation",
      totalItems: 100,
      minutes: 120,
      difficulty: "mixed",
      sections: [
        { topic: "Medical-Surgical Nursing", items: 25 },
        { topic: "Community Health Nursing", items: 20 },
        { topic: "Maternal & Child Nursing", items: 20 },
        { topic: "Psychiatric Nursing", items: 15 },
        { topic: "Pharmacology", items: 10 },
        { topic: "Professional Adjustment & Jurisprudence", items: 10 },
      ],
    },
  },
  {
    id: "let",
    name: "LET",
    blurb: "Licensure Exam for Teachers",
    blueprint: {
      preset: "let",
      title: "LET — Full Simulation",
      totalItems: 150,
      minutes: 150,
      difficulty: "mixed",
      sections: [
        { topic: "Professional Education", items: 50 },
        { topic: "General Education", items: 50 },
        { topic: "Specialization", items: 50 },
      ],
    },
  },
  {
    id: "ce",
    name: "CE Board",
    blurb: "Civil Engineers Licensure Exam",
    blueprint: {
      preset: "ce",
      title: "Civil Engineering — Full Simulation",
      totalItems: 100,
      minutes: 120,
      difficulty: "mixed",
      sections: [
        { topic: "Mathematics & Surveying", items: 25 },
        { topic: "Hydraulics & Geotechnical", items: 25 },
        { topic: "Structural Engineering & Construction", items: 30 },
        { topic: "Transportation Engineering", items: 20 },
      ],
    },
  },
  {
    id: "cpa",
    name: "CPA Board",
    blurb: "Certified Public Accountant Licensure Exam",
    blueprint: {
      preset: "cpa",
      title: "CPA — Full Simulation",
      totalItems: 100,
      minutes: 120,
      difficulty: "mixed",
      sections: [
        { topic: "Financial Accounting & Reporting", items: 30 },
        { topic: "Auditing", items: 25 },
        { topic: "Taxation", items: 20 },
        { topic: "Management Services", items: 15 },
        { topic: "Regulatory Framework", items: 10 },
      ],
    },
  },
  {
    id: "custom",
    name: "Custom",
    blurb: "Model any exam, anywhere",
    blueprint: {
      preset: "custom",
      title: "Custom Exam",
      totalItems: 50,
      minutes: 60,
      difficulty: "mixed",
      sections: [{ topic: "Topic A", items: 25 }, { topic: "Topic B", items: 25 }],
    },
  },
];

/* ── Preset picker + blueprint editor ─────────────────────── */

export function ExamConfigForm({
  notebookId,
  sourceIds,
  onDone,
  onCancel,
}: {
  notebookId: string;
  sourceIds?: string[];
  onDone: (gen: Generation) => void;
  onCancel: () => void;
}) {
  const cs = useCallSettings();
  const [presetId, setPresetId] = useState("pnle");
  const [blueprint, setBlueprint] = useState<ExamBlueprint>(EXAM_PRESETS[0].blueprint);
  const [withSolutions, setWithSolutions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const pickPreset = (id: string) => {
    setPresetId(id);
    setBlueprint(structuredClone(EXAM_PRESETS.find((p) => p.id === id)!.blueprint));
  };

  const total = blueprint.sections.reduce((s, x) => s + (x.items || 0), 0);
  const solCount = Math.min(8, Math.max(1, Math.round(total * 0.2)));

  const generate = async () => {
    setError("");
    setBusy(true);
    setStatus("Reading your sources…");
    try {
      if (total < 5) throw new Error("A blueprint needs at least 5 items.");
      const scope = blueprint.sections.map((s) => s.topic).join("; ");
      const src = await buildSourceBlock(notebookId, scope, sourceIds);
      if (!src.titles.length) throw new Error("Add at least one source first.");
      setStatus(`Writing ${total} items across ${blueprint.sections.length} sections…`);
      const questions = await generateJSON<QuizQuestion[]>({
        ...cs,
        system: GENERATOR_SYSTEM + ASSESSMENT_FORMAT_RULES,
        user: `Write a full board-exam simulation from these sources.

Sources:
${src.block}

Exam blueprint — follow the section/item distribution EXACTLY:
${blueprint.sections.map((s) => `- ${s.topic}: ${s.items} items`).join("\n")}
Total: ${total} items.${
          withSolutions
            ? ` Of these, exactly ${solCount} are problem-solving items ("solution" format), placed in the sections whose sources support computation — mathematics, surveying calculations, dosage math, financial figures. The student solves these on paper and submits a photo of their handwritten working. The remaining ${total - solCount} items are multiple choice (4 options each).`
            : " All items are multiple choice (4 options each)."
        }
Difficulty: ${blueprint.difficulty}${blueprint.difficulty === "mixed" ? " (30% easy, 50% moderate, 20% hard)" : ""}.
Style: board-exam voice — clinical vignettes or scenario stems where the subject allows; otherwise precise recall items. Every item answerable from the sources.

JSON shape: an array of
{"format":"mcq"|"solution","topic":"<section topic exactly as above>","difficulty":"easy"|"moderate"|"hard","stem":"...","options":["A","B","C","D"],"answerIndex":0,"answer":"<option text>","rationale":"why, teaching the concept","sourceHint":"source title"}

Constraints: MCQ items have exactly 4 options with answerIndex pointing at the key. Solution items have options: [] and answerIndex 0, carry the precise final answer WITH UNITS in "answer", and numbered worked steps in "rationale"; their stems should ask the student to show their working on paper. Solution items may exist ONLY if the sources genuinely support computation${withSolutions ? "" : " — for this exam, write none: every item must be mcq"}.`,
        onStatus: setStatus,
      });
      if (!Array.isArray(questions) || questions.length === 0)
        throw new Error("The exam came back empty — check that sources cover the blueprint topics.");
      const clean = sanitizeQuestions(questions);
      if (clean.length === 0)
        throw new Error("The exam items were malformed — try generating again.");
      const payload: ExamPayload = { blueprint: { ...blueprint, totalItems: total }, questions: clean };
      const gen: Generation = {
        id: `${Date.now().toString(36)}-e`,
        notebookId,
        kind: "exam",
        title: blueprint.title,
        payload,
        createdAt: Date.now(),
      };
      await saveGeneration(gen);
      onDone(gen);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <div className="space-y-5">
      <Field label="Preset">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EXAM_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => pickPreset(p.id)}
              aria-pressed={presetId === p.id}
              className={`rounded-[var(--radius-dialog)] border px-3.5 py-3 text-left transition-colors ${
                presetId === p.id
                  ? "border-brass/50 bg-brass/[0.08]"
                  : "border-hairline bg-ink/[0.02] hover:border-hairline-strong"
              }`}
            >
              <div className="text-body font-medium text-brass">
                {p.name}
              </div>
              <div className="mt-1 text-label leading-snug text-muted">{p.blurb}</div>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Field label="Exam title">
          <input
            value={blueprint.title}
            onChange={(e) => setBlueprint((b) => ({ ...b, title: e.target.value }))}
            className={inputCls}
          />
        </Field>
        <Field label="Time limit (minutes)">
          <input
            type="number"
            min={5}
            max={480}
            value={blueprint.minutes}
            onChange={(e) =>
              setBlueprint((b) => ({ ...b, minutes: Math.max(5, Math.min(480, +e.target.value || 5)) }))
            }
            className={inputCls}
          />
        </Field>
      </div>

      <Field label={`Sections — ${total} items total`}>
        <div className="space-y-2">
          {blueprint.sections.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={s.topic}
                onChange={(e) =>
                  setBlueprint((b) => ({
                    ...b,
                    sections: b.sections.map((x, xi) => (xi === i ? { ...x, topic: e.target.value } : x)),
                  }))
                }
                className={inputCls + " flex-1"}
              />
              <input
                type="number"
                min={0}
                value={s.items}
                onChange={(e) =>
                  setBlueprint((b) => ({
                    ...b,
                    sections: b.sections.map((x, xi) => (xi === i ? { ...x, items: +e.target.value } : x)),
                  }))
                }
                className={inputCls + " w-20!"}
              />
              <button
                onClick={() => setBlueprint((b) => ({ ...b, sections: b.sections.filter((_, xi) => xi !== i) }))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-field)] text-muted transition-colors hover:text-rust active:scale-95"
                aria-label="Remove section"
              >
                <X size={ICON.md} />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setBlueprint((b) => ({ ...b, sections: [...b.sections, { topic: "New topic", items: 10 }] }))
            }
            className="flex min-h-[40px] items-center text-small font-medium text-muted transition-colors hover:text-brass active:scale-95"
          >
            + Add section
          </button>
        </div>
      </Field>

      <Field label="Problem-solving items">
        <button
          onClick={() => setWithSolutions((v) => !v)}
          role="switch"
          aria-checked={withSolutions}
          className={`flex w-full items-center justify-between gap-4 rounded-[var(--radius-dialog)] border px-4 py-3.5 text-left transition-colors ${
            withSolutions ? "border-brass/40 bg-brass/[0.05]" : "border-hairline bg-ink/[0.02] hover:border-hairline-strong"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-small font-medium text-ink">
              Handwritten solutions{withSolutions && <span className="ml-2 text-label font-medium tabular-nums text-brass">{solCount} items</span>}
            </span>
            <span className="mt-0.5 block text-label leading-snug text-muted">
              A fifth of the exam becomes computation problems you solve on paper — submit a photo of your working and AI grades it.
            </span>
          </span>
          <span
            className={`relative h-6 w-10 shrink-0 rounded-[var(--radius-pill)] transition-colors ${
              withSolutions ? "bg-brass/70" : "bg-ink/15"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-[var(--radius-pill)] bg-surface shadow transition-all ${
                withSolutions ? "left-[18px]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </Field>

      {status && <LampPulse label={status} />}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-3">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnLamp} onClick={generate} disabled={busy}>
          <GraduationCap size={ICON.sm} className="mr-1.5 inline" />
          {busy ? "Setting the papers…" : `Generate ${total}-item exam`}
        </button>
      </div>
    </div>
  );
}

/* ── Runner ───────────────────────────────────────────────── */

interface ExamRunSpec {
  key: number;
  payload: ExamPayload;
  scope: "full" | "misses";
}

/** Only the missed items, on a clock scaled to their share of the exam. */
function missesExam(payload: ExamPayload, missed: QuizQuestion[]): ExamPayload {
  const { blueprint } = payload;
  const share = missed.length / Math.max(1, payload.questions.length);
  return {
    questions: missed,
    blueprint: {
      ...blueprint,
      title: `${blueprint.title} · missed items`,
      totalItems: missed.length,
      minutes: Math.max(5, Math.round(blueprint.minutes * share)),
    },
  };
}

/** An exam sitting. Retakes start a fresh run in place; with `gen`, each
 *  graded run is saved as an attempt. */
export function ExamRunner({
  payload,
  gen,
  onExit,
  onOpenGeneration,
  onActiveChange,
}: {
  payload: ExamPayload;
  gen?: Generation;
  onExit?: () => void;
  onOpenGeneration?: (gen: Generation) => void;
  /** True while a sitting has started and not finished, so the host can
   *  confirm before a dismissal throws the answers and clock away. */
  onActiveChange?: (active: boolean) => void;
}) {
  const [run, setRun] = useState<ExamRunSpec>({ key: 0, payload, scope: "full" });
  return (
    <ExamSitting
      key={run.key}
      payload={run.payload}
      scope={run.scope}
      gen={gen}
      onExit={onExit}
      onOpenGeneration={onOpenGeneration}
      onActiveChange={onActiveChange}
      onRetake={() => setRun((r) => ({ key: r.key + 1, payload, scope: "full" }))}
      onRetakeMisses={(missed) =>
        setRun((r) => ({ key: r.key + 1, payload: missesExam(payload, missed), scope: "misses" }))
      }
    />
  );
}

function ExamSitting({
  payload,
  scope,
  gen,
  onExit,
  onOpenGeneration,
  onRetake,
  onRetakeMisses,
  onActiveChange,
}: {
  payload: ExamPayload;
  scope: "full" | "misses";
  gen?: Generation;
  onExit?: () => void;
  onOpenGeneration?: (gen: Generation) => void;
  onRetake: () => void;
  onRetakeMisses: (missed: QuizQuestion[]) => void;
  onActiveChange?: (active: boolean) => void;
}) {
  const cs = useCallSettings();
  const [mode, setMode] = useState<ExamMode | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => payload.questions.map(() => null));
  const [typed, setTyped] = useState<string[]>(() => payload.questions.map(() => ""));
  const [subs, setSubs] = useState<(SolutionSubmission | null)[]>(() =>
    payload.questions.map(() => null),
  );
  const [checks, setChecks] = useState<(SolutionCheck | null)[]>(() => payload.questions.map(() => null));
  const [checkErrors, setCheckErrors] = useState<string[]>(() => payload.questions.map(() => ""));
  const [checkingIdx, setCheckingIdx] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>(() => payload.questions.map(() => false));
  const [finished, setFinished] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(payload.blueprint.minutes * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const qs = payload.questions;

  const isWorked = (i: number) =>
    qs[i].format === "solution" ? !!subs[i] || !!checks[i] : answers[i] !== null;

  /** Grade one submitted photo — drill mode checks inline; simulated mode
   *  defers everything to the results screen so nothing leaks mid-exam. */
  const runSolutionCheck = async (i: number) => {
    const q = qs[i];
    if (!subs[i]) return;
    setCheckingIdx(i);
    setCheckErrors((errs) => errs.map((v, j) => (j === i ? "" : v)));
    try {
      const result = await checkSolution({
        ...cs,
        stem: assessmentGradingStem(q),
        expectedAnswer: q.answer,
        expectedApproach: q.rationale,
        studentFinalAnswer: typed[i].trim() || undefined,
        image: subs[i]!,
      });
      setChecks((c) => c.map((v, j) => (j === i ? result : v)));
      setRevealed((r) => r.map((v, j) => (j === i ? true : v)));
    } catch (e) {
      setCheckErrors((errs) => errs.map((v, j) => (j === i ? friendlyError(e) : v)));
    } finally {
      setCheckingIdx(null);
    }
  };

  useEffect(() => {
    if (mode !== "simulated" || finished) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          setFinished(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, finished]);

  const active = mode !== null && !finished;
  useEffect(() => {
    onActiveChange?.(active);
    return () => onActiveChange?.(false);
  }, [active, onActiveChange]);

  if (!mode) {
    return (
      <div className="space-y-6">
        <div className="rounded-[var(--radius-dialog)] border border-hairline bg-ink/[0.02] p-6 text-center">
          <div className="font-display text-[1.5rem] font-[430] text-ink">{payload.blueprint.title}</div>
          <div className="mt-2 text-label font-medium text-muted">
            {payload.blueprint.totalItems} items, {payload.blueprint.minutes} minutes, shaded scoring
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => setMode("simulated")}
            className="rounded-[var(--radius-dialog)] border border-hairline bg-ink/[0.02] p-5 text-left transition-colors hover:border-brass/40 hover:bg-brass/[0.04]"
          >
            <Timer size={ICON.lg} className="text-brass" />
            <div className="mt-3 font-display text-[1.1rem] font-[440] text-ink">Simulated</div>
            <p className="mt-1.5 text-small leading-relaxed text-muted">
              Clock runs, answers stay hidden until you submit — the dress rehearsal.
            </p>
          </button>
          <button
            onClick={() => setMode("drill")}
            className="rounded-[var(--radius-dialog)] border border-hairline bg-ink/[0.02] p-5 text-left transition-colors hover:border-brass/40 hover:bg-brass/[0.04]"
          >
            <PencilSimpleLine size={ICON.lg} className="text-brass" />
            <div className="mt-3 font-display text-[1.1rem] font-[440] text-ink">Drill</div>
            <p className="mt-1.5 text-small leading-relaxed text-muted">
              Every answer explained the moment you commit — for learning, not timing.
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <ExamResults
        title={payload.blueprint.title}
        questions={qs}
        answers={answers}
        subs={subs}
        checks={checks}
        setChecks={setChecks}
        callSettings={cs}
        typed={typed}
        scope={scope}
        gen={gen}
        onExit={onExit}
        onRetake={onRetake}
        onRetakeMisses={onRetakeMisses}
        onOpenGeneration={onOpenGeneration}
      />
    );
  }

  const q = qs[idx];
  const isSolution = q.format === "solution";
  const checking = checkingIdx === idx;
  const answeredCount = qs.reduce((n, _, i) => n + (isWorked(i) ? 1 : 0), 0);
  const showRationale = mode === "drill" && revealed[idx];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-x-3 text-label font-medium text-muted">
          <span className="tabular-nums text-ink/80">Item {idx + 1} of {qs.length}</span>
          <span>{q.topic}</span>
          {isSolution && <span>Problem solving</span>}
        </div>
        {mode === "simulated" ? (
          <div className="font-mono text-label tabular-nums text-brass">
            {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </div>
        ) : (
          <div className="text-label tabular-nums text-brass">{answeredCount} answered</div>
        )}
      </div>
      <div className="h-1 overflow-hidden rounded bg-ink/[0.06]">
        <motion.div
          className="h-full grad-lamp"
          initial={false}
          animate={{ width: `${((idx + 1) / qs.length) * 100}%` }}
          transition={SOFT}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: DRIFT_X }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -DRIFT_X, transition: EXIT }}
          transition={SOFT}
          className="space-y-5"
        >
          <AssessmentContent className="text-lead font-medium leading-relaxed text-ink">{q.stem}</AssessmentContent>
          {q.graph && <AssessmentGraph graph={q.graph} />}

          {isSolution ? (
            <div className="space-y-3">
              <SolutionBin
                submission={subs[idx]}
                readOnly={revealed[idx] || checking}
                onChange={(s) => setSubs((ss) => ss.map((v, i) => (i === idx ? s : v)))}
              />
              <input
                value={typed[idx]}
                disabled={revealed[idx]}
                onChange={(e) => setTyped((t) => t.map((v, i) => (i === idx ? e.target.value : v)))}
                placeholder="Final answer (optional)"
                className={inputCls}
              />
              {mode === "drill" && (
                <>
                  <AiCheckNote />
                  {checkErrors[idx] && <ErrorNote>{checkErrors[idx]}</ErrorNote>}
                  {checking && <LampPulse label="Reading your working…" />}
                  <AnimatePresence>
                    {revealed[idx] && checks[idx] && (
                      <SolutionVerdictCard check={checks[idx]!} />
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
              const isPicked = answers[idx] === oi;
              const isAnswer = q.answerIndex === oi;
              const state = !showRationale
                ? isPicked ? "picked" : "idle"
                : isAnswer ? "answer" : isPicked ? "wrong" : "idle";
              return (
                <motion.button
                  key={oi}
                  aria-label={assessmentOptionLabel(opt, oi)}
                  onClick={() => setAnswers((a) => a.map((v, i) => (i === idx ? oi : v)))}
                  whileTap={{ scale: 0.985 }}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius-dialog)] border px-4 py-3 text-left text-body transition-colors duration-med ${
                    state === "picked"
                      ? "border-brass/50 bg-brass/[0.08]"
                      : state === "answer"
                        ? "border-sage/40 bg-sage/[0.07]"
                        : state === "wrong"
                          ? "border-rust/40 bg-rust/[0.07]"
                          : "border-hairline bg-ink/[0.02] hover:border-hairline-strong"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-hairline-strong font-mono text-label text-muted">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <AssessmentContent inline className="min-w-0 flex-1 text-ink/90">{opt}</AssessmentContent>
                  <AnimatePresence>
                    {state === "answer" && (
                      <motion.span
                        key="ok"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={SPRING}
                        className="shrink-0"
                      >
                        <Check size={ICON.md} className="text-sage" />
                      </motion.span>
                    )}
                    {state === "wrong" && (
                      <motion.span
                        key="no"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1, x: [0, -3, 3, -2, 0] }}
                        transition={SPRING}
                        className="shrink-0"
                      >
                        <X size={ICON.md} className="text-rust" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
              })}
            </div>
          )}

          <AnimatePresence>
            {showRationale && (
              <motion.div
                initial={ENTER.initial}
                animate={ENTER.animate}
                exit={{ opacity: 0 }}
                transition={SOFT}
                className="rounded-[var(--radius-dialog)] border border-moon/15 bg-moon/[0.05] px-4 py-3.5"
              >
                <div className="text-small font-semibold text-moon">Why</div>
                <AssessmentContent className="mt-1.5 text-small leading-relaxed text-ink/85">{q.rationale}</AssessmentContent>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between pt-1">
            <button className={btnGhost} onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              Back
            </button>
            <div className="flex gap-2">
              {mode === "drill" && !revealed[idx] && (
                isSolution ? (
                  <button
                    className={btnGhost}
                    onClick={() => void runSolutionCheck(idx)}
                    disabled={checking || (!subs[idx] && !typed[idx].trim())}
                  >
                    {checking ? "Checking…" : "Check solution"}
                  </button>
                ) : (
                  <button
                    className={btnGhost}
                    onClick={() => setRevealed((r) => r.map((v, i) => (i === idx ? true : v)))}
                    disabled={answers[idx] === null}
                  >
                    Check
                  </button>
                )
              )}
              {idx === qs.length - 1 ? (
                <button className={btnLamp} onClick={() => setFinished(true)}>
                  Submit exam
                </button>
              ) : (
                <button className={btnLamp} onClick={() => setIdx((i) => i + 1)}>
                  Next
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {mode === "simulated" && (
        <div className="flex flex-wrap justify-center gap-2 border-t border-hairline pt-4 sm:gap-1.5">
          {qs.map((qq, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              title={`Item ${i + 1}${qq.format === "solution" ? " · photo submission" : ""}`}
              className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-field)] font-mono text-label transition-all active:scale-90 sm:h-7 sm:w-7 ${
                i === idx
                  ? "bg-brass/25 text-brass ring-1 ring-brass/40"
                  : isWorked(i)
                    ? "bg-white/[0.09] text-ink/80"
                    : "bg-ink/[0.03] text-muted"
              }`}
            >
              {qq.format === "solution" ? <PencilSimpleLine size={ICON.xs} /> : i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Results — count-up score, spring section bars, review ── */

function ExamResults({
  title,
  questions,
  answers,
  subs,
  checks,
  setChecks,
  callSettings,
  typed,
  scope,
  gen,
  onExit,
  onRetake,
  onRetakeMisses,
  onOpenGeneration,
}: {
  title: string;
  questions: QuizQuestion[];
  answers: (number | null)[];
  subs: (SolutionSubmission | null)[];
  checks: (SolutionCheck | null)[];
  setChecks: (fn: (c: (SolutionCheck | null)[]) => (SolutionCheck | null)[]) => void;
  callSettings: ReturnType<typeof useCallSettings>;
  typed: string[];
  scope: "full" | "misses";
  gen?: Generation;
  onExit?: () => void;
  onRetake: () => void;
  onRetakeMisses: (missed: QuizQuestion[]) => void;
  onOpenGeneration?: (gen: Generation) => void;
}) {
  // Simulated runs defer AI grading until now — grade each submitted
  // photo sequentially so the pass token spends gently and progress is
  // visible. The attempt is saved once grading settles.
  const [grading, setGrading] = useState(false);
  const [progress, setProgress] = useState("");
  const [graded, setGraded] = useState(
    () => !questions.some((q, i) => q.format === "solution" && subs[i] && !checks[i]),
  );

  useEffect(() => {
    const pending = questions
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) => q.format === "solution" && subs[i] && !checks[i]);
    if (!pending.length) return;
    let cancelled = false;
    void (async () => {
      setGrading(true);
      for (let k = 0; k < pending.length; k++) {
        if (cancelled) return;
        const { q, i } = pending[k];
        setProgress(`Checking solution ${k + 1} of ${pending.length}…`);
        try {
          const result = await checkSolution({
            ...callSettings,
            stem: assessmentGradingStem(q),
            expectedAnswer: q.answer,
            expectedApproach: q.rationale,
            studentFinalAnswer: typed[i]?.trim() || undefined,
            image: subs[i]!,
          });
          if (cancelled) return;
          setChecks((c) => c.map((v, j) => (j === i ? result : v)));
        } catch {
          if (cancelled) return;
          // Left unchecked — its review row explains what to do.
        }
      }
      if (!cancelled) {
        setGrading(false);
        setProgress("");
        setGraded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Grade once per submission; re-runs come from an explicit Retake.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSolutions = questions.some((q) => q.format === "solution");
  const items = useMemo(
    () =>
      scoreItems(
        questions,
        questions.map((_, i) => ({ picked: answers[i], typed: typed[i] ?? "", check: checks[i] })),
      ),
    [questions, answers, typed, checks],
  );
  const earned = items.reduce((n, it) => n + it.credit, 0);
  const pct = Math.round((earned / questions.length) * 100);
  const shownPct = useCountUp(pct, DUR.settle);
  const byTopic = new Map<string, { c: number; t: number }>();
  items.forEach((it) => {
    const t = byTopic.get(it.topic) ?? { c: 0, t: 0 };
    t.t++;
    t.c += it.credit;
    byTopic.set(it.topic, t);
  });
  const verdict =
    pct >= 75 ? "Passing pace." : pct >= 60 ? "Getting close — drill the weak sections." : "The lamp stays on. Review, then retake.";

  return (
    <motion.div
      initial={ENTER.initial}
      animate={ENTER.animate}
      transition={SOFT}
      className="space-y-6"
    >
      <motion.div
        initial={ENTER.initial}
        animate={ENTER.animate}
        transition={{ ...SOFT, delay: 0.08 }}
        className="rounded-[var(--radius-dialog)] border border-hairline bg-ink/[0.02] p-7 text-center"
      >
        <div className="field-label">{title} — {scope === "misses" ? "Retake of missed items" : "Result"}</div>
        <div className={`mt-3 font-display text-[2.8rem] font-[420] leading-none sm:text-[3.4rem] ${pct >= 75 ? "text-sage" : "text-lamp"}`}>
          {shownPct}%
        </div>
        <div className="mt-2 text-small text-muted">
          {fmtScore(earned)} of {questions.length}
          {hasSolutions ? " · partially-correct solutions earn half credit" : " correct"} · {verdict}
        </div>
        {hasSolutions && <AiCheckNote className="mx-auto mt-3 max-w-sm" />}
      </motion.div>
      {(grading || progress) && <LampPulse label={progress || "Checking your solutions…"} />}
      <div>
        <div className="field-label mb-3">By section</div>
        <div className="space-y-2.5">
          {[...byTopic.entries()].map(([topic, { c, t }], i) => (
            <div key={topic} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-small text-ink/80 sm:w-44">{topic}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-ink/[0.06]">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ ...SOFT, delay: 0.25 + i * 0.1 }}
                  className={`h-full origin-left rounded ${c / t >= 0.75 ? "bg-sage/70" : c / t >= 0.5 ? "bg-brass/80" : "bg-rust/80"}`}
                  style={{ width: `${(c / t) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right font-mono text-label text-muted">{fmtScore(c)}/{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="field-label mb-3">Review — every item, with its rationale</div>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const isSol = q.format === "solution";
            const chk = isSol ? checks[i] : null;
            const credit = items[i].credit;
            return (
              <div key={i} className="rounded-[var(--radius-dialog)] border border-hairline bg-ink/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] ${
                      credit >= 1
                        ? "bg-sage/15 text-sage"
                        : credit > 0
                          ? "bg-brass/15 text-brass"
                          : "bg-rust/15 text-rust"
                    }`}
                  >
                    {credit >= 1 ? (
                      <Check size={ICON.xs} />
                    ) : credit > 0 ? (
                      <Minus size={ICON.xs} />
                    ) : (
                      <X size={ICON.xs} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <AssessmentContent className="text-body font-medium leading-relaxed text-ink/90">{q.stem}</AssessmentContent>
                    {q.graph && <AssessmentGraph graph={q.graph} />}
                    {isSol ? (
                      <>
                        {chk ? (
                          <div className="mt-2">
                            <SolutionVerdictCard check={chk} />
                          </div>
                        ) : subs[i] ? (
                          <p className="mt-1.5 text-small text-muted">
                            This photo couldn't be checked — switch to a vision-capable model in Settings, then retake to grade it.
                          </p>
                        ) : (
                          <p className="mt-1.5 text-small text-muted">No solution submitted — skipped.</p>
                        )}
                        <p className="mt-1.5 text-small text-muted">
                          Key: <AssessmentContent inline className="text-sage">{q.answer}</AssessmentContent>
                        </p>
                      </>
                    ) : (
                      credit === 0 && (
                        <p className="mt-1.5 text-small text-muted">
                          Yours: <AssessmentContent inline>{answers[i] !== null ? q.options[answers[i]!] : "— skipped"}</AssessmentContent> · Key:{" "}
                          <AssessmentContent inline className="text-sage">{q.options[q.answerIndex]}</AssessmentContent>
                        </p>
                      )
                    )}
                    <AssessmentContent className="mt-1.5 text-small leading-relaxed text-ink/70">{q.rationale}</AssessmentContent>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <AttemptFollowUp
        gen={gen}
        kind="exam"
        scope={scope}
        questions={questions}
        items={items}
        ready={graded}
        onRetakeMisses={onRetakeMisses}
        onOpenGeneration={onOpenGeneration}
      />
      <div className="flex justify-end gap-3">
        {onExit && <button className={btnGhost} onClick={onExit}>Done</button>}
        <button className={btnLamp} onClick={onRetake}>
          <ArrowCounterClockwise size={ICON.sm} className="mr-1.5 inline" />
          {scope === "misses" ? "Retake the whole exam" : "Retake"}
        </button>
      </div>
    </motion.div>
  );
}
