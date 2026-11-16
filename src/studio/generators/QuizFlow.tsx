import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { QuizConfig, QuizPayload, QuizQuestion, QuizFormat, Generation, SolutionCheck } from "../../lib/types";
import { scoreItems, typedAnswerMatches } from "../../lib/attempts";
import AttemptFollowUp from "./AttemptFollowUp";
import { generateJSON, checkSolution, friendlyError } from "../../lib/llm";
import { useCallSettings, useSettings } from "../../lib/settings";
import { saveGeneration } from "../../lib/db";
import { DUR, DRIFT_X, ENTER, EXIT, SOFT, useCountUp } from "../fx";
import { playSfx } from "../companion/sfx";
import { cueCompad } from "../../lib/activity";
import { InkMark } from "../../ui/InkMark";
import "./study-feedback.css";
import { GENERATOR_SYSTEM, ASSESSMENT_FORMAT_RULES, buildSourceBlock, sanitizeQuestions, solutionCredit, fmtScore } from "./common";
import { AssessmentContent, AssessmentGraph } from "../../components/AssessmentContent";
import { assessmentGradingStem, assessmentOptionLabel } from "../../lib/assessmentContent";
import {
  SolutionBin,
  SolutionVerdictCard,
  AiCheckNote,
  type SolutionSubmission,
} from "./SolutionBin";
import { Field, inputCls, btnLamp, btnGhost, LampPulse, ErrorNote } from "../ui";
import { ArrowCounterClockwise, Sparkle } from "@phosphor-icons/react";
import { ICON } from "../../ui/iconScale";

/* ── Configuration ────────────────────────────────────────── */

export function QuizConfigForm({
  notebookId,
  sourceIds,
  defaultScope = "",
  onDone,
  onCancel,
}: {
  notebookId: string;
  sourceIds?: string[];
  defaultScope?: string;
  onDone: (gen: Generation) => void;
  onCancel: () => void;
}) {
  const cs = useCallSettings();
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<QuizConfig["difficulty"]>("mixed");
  const [scope, setScope] = useState(defaultScope);
  const [formats, setFormats] = useState<QuizFormat[]>([
    "mcq",
    "truefalse",
    "identification",
    "solution",
  ]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const toggleFormat = (f: QuizFormat) =>
    setFormats((fs) => (fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]));

  const generate = async () => {
    setError("");
    setBusy(true);
    setStatus("Reading your sources…");
    try {
      const src = await buildSourceBlock(notebookId, scope || "key concepts and facts", sourceIds);
      if (!src.titles.length) throw new Error("Add at least one source first.");
      setStatus("Comtus is writing your quiz…");
      const raw = await generateJSON<QuizPayload>({
        ...cs,
        system: GENERATOR_SYSTEM + ASSESSMENT_FORMAT_RULES,
        user: `Write a quiz from these sources.

Sources:
${src.block}

Quiz spec:
- ${count} items
- Formats allowed: ${formats.join(", ")} (mix them; MCQ should dominate if all allowed)
- Difficulty: ${difficulty}${difficulty === "mixed" ? " (roughly 30% easy, 50% moderate, 20% hard)" : ""}
- Topic scope: ${scope || "the entire notebook, spread across its main topics"}

JSON shape:
{"questions":[{"format":"mcq"|"truefalse"|"identification"|"solution","topic":"string","difficulty":"easy"|"moderate"|"hard","stem":"question text","options":["..."],"answerIndex":0,"answer":"exact short answer","rationale":"why, teaching the concept","sourceHint":"source title it came from"}]}

Constraints: MCQ always has exactly 4 options; truefalse has options ["True","False"] and answerIndex 0 or 1; identification has options: [] and a concise answer in "answer"; solution items are problem-solving questions the student answers ON PAPER and submits as a photo — give them options: [], the precise final answer (with units) in "answer", the concise worked method in "rationale", and a stem that asks for the working to be shown. Include solution items ONLY where the sources genuinely support computation or quantitative reasoning. Every item must be answerable from the sources alone.`,
        onStatus: setStatus,
      });
      const payload: QuizPayload = {
        questions: sanitizeQuestions(raw.questions),
        config: {
          count,
          formats,
          difficulty,
          scope: scope.trim() || "entire notebook",
        },
      };
      if (!payload.questions?.length) throw new Error("The quiz came back empty — try widening the scope.");
      const gen: Generation = {
        id: `${Date.now().toString(36)}-q`,
        notebookId,
        kind: "quiz",
        title: `Quiz · ${count} items${scope ? ` · ${scope}` : ""}`,
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
      <div className="grid grid-cols-2 gap-4">
        <Field label="Items">
          <select value={count} onChange={(e) => setCount(+e.target.value)} className={inputCls}>
            {[5, 10, 15, 20, 30, 40, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Field>
        <Field label="Difficulty">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as QuizConfig["difficulty"])}
            className={inputCls}
          >
            {["mixed", "easy", "moderate", "hard"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Formats">
        <div className="flex flex-wrap gap-2">
          {(["mcq", "truefalse", "identification", "solution"] as const).map((f) => (
            <button
              key={f}
              onClick={() => toggleFormat(f)}
              aria-pressed={formats.includes(f)}
              className={btnGhost}
            >
              {f === "mcq"
                ? "multiple choice"
                : f === "truefalse"
                  ? "true / false"
                  : f === "identification"
                    ? "identification"
                    : "problem solving"}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Topic scope" hint="Empty = the whole notebook.">
        <input
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="e.g. fluid & electrolytes, chapters 3–5"
          className={inputCls}
        />
      </Field>
      {status && <LampPulse label={status} />}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-3">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnLamp} onClick={generate} disabled={busy || formats.length === 0}>
          <Sparkle size={ICON.sm} className="mr-1.5 inline" />
          {busy ? "Writing…" : "Write my quiz"}
        </button>
      </div>
    </div>
  );
}

/* ── Taker ────────────────────────────────────────────────── */

interface QuizRunSpec {
  key: number;
  questions: QuizQuestion[];
  scope: "full" | "misses";
}

/** A quiz sitting. Retakes — of everything, or of only what was missed —
 *  start a fresh run in place. With `gen`, each finished run is saved. */
export function QuizTaker({
  payload,
  gen,
  onRegenerate,
  onOpenGeneration,
  onActiveChange,
}: {
  payload: QuizPayload;
  gen?: Generation;
  onRegenerate?: () => void;
  onOpenGeneration?: (gen: Generation) => void;
  /** True while answered work is unfinished, so the host can confirm
   *  before a dismissal throws it away. */
  onActiveChange?: (active: boolean) => void;
}) {
  const [run, setRun] = useState<QuizRunSpec>({ key: 0, questions: payload.questions, scope: "full" });
  return (
    <QuizRun
      key={run.key}
      payload={{ ...payload, questions: run.questions }}
      scope={run.scope}
      gen={gen}
      onActiveChange={onActiveChange}
      onRetake={() => setRun((r) => ({ key: r.key + 1, questions: payload.questions, scope: "full" }))}
      onRetakeMisses={(missed) => setRun((r) => ({ key: r.key + 1, questions: missed, scope: "misses" }))}
      onRegenerate={onRegenerate}
      onOpenGeneration={onOpenGeneration}
    />
  );
}

function QuizRun({
  payload,
  scope,
  gen,
  onRetake,
  onRetakeMisses,
  onRegenerate,
  onOpenGeneration,
  onActiveChange,
}: {
  payload: QuizPayload;
  scope: "full" | "misses";
  gen?: Generation;
  onRetake: () => void;
  onRetakeMisses: (missed: QuizQuestion[]) => void;
  onRegenerate?: () => void;
  onOpenGeneration?: (gen: Generation) => void;
  onActiveChange?: (active: boolean) => void;
}) {
  const cs = useCallSettings();
  const sfxOn = useSettings((s) => s.companionSfx !== false);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(() => payload.questions.map(() => null));
  const [typed, setTyped] = useState<string[]>(() => payload.questions.map(() => ""));
  const [checked, setChecked] = useState<boolean[]>(() => payload.questions.map(() => false));
  const [subs, setSubs] = useState<(SolutionSubmission | null)[]>(() =>
    payload.questions.map(() => null),
  );
  const [checks, setChecks] = useState<(SolutionCheck | null)[]>(() =>
    payload.questions.map(() => null),
  );
  const [checkingIdx, setCheckingIdx] = useState<number | null>(null);
  const [checkErrors, setCheckErrors] = useState<string[]>(() => payload.questions.map(() => ""));
  const [finished, setFinished] = useState(false);

  /** Grade one submitted photo with the active model and record the verdict. */
  const runSolutionCheck = async (i: number) => {
    const q = payload.questions[i];
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
      setChecked((c) => c.map((v, j) => (j === i ? true : v)));
      const isSolCorrect = result.verdict === "correct" || result.verdict === "partial";
      playSfx(isSolCorrect ? "lampClick" : "wrong", sfxOn);
      cueCompad(isSolCorrect ? "correct" : "miss");
    } catch (e) {
      setCheckErrors((errs) => errs.map((v, j) => (j === i ? friendlyError(e) : v)));
    } finally {
      setCheckingIdx(null);
    }
  };

  const handleCheckAnswer = (qIndex: number) => {
    const q = payload.questions[qIndex];
    setChecked((c) => c.map((v, i) => (i === qIndex ? true : v)));
    const ok = isCorrect(q, picked[qIndex], typed[qIndex]);
    playSfx(ok ? "lampClick" : "wrong", sfxOn);
    cueCompad(ok ? "correct" : "miss");
  };

  // Only checked items count — an unchecked pick must not leak correctness.
  // Drawn solutions earn full/half/none from the AI verdict.
  const score = useMemo(() => {
    let total = 0;
    payload.questions.forEach((qq, i) => {
      if (!checked[i]) return;
      total += qq.format === "solution" ? solutionCredit(checks[i]) : isCorrect(qq, picked[i], typed[i]) ? 1 : 0;
    });
    return total;
  }, [payload.questions, picked, typed, checked, checks]);

  const active = !finished && (picked.some((p) => p !== null) || typed.some((t) => t.trim() !== "") || subs.some(Boolean));
  useEffect(() => {
    onActiveChange?.(active);
    return () => onActiveChange?.(false);
  }, [active, onActiveChange]);

  if (finished) {
    return (
      <QuizResults
        payload={payload}
        scope={scope}
        gen={gen}
        picked={picked}
        typed={typed}
        checks={checks}
        onRetake={onRetake}
        onRetakeMisses={onRetakeMisses}
        onRegenerate={onRegenerate}
        onOpenGeneration={onOpenGeneration}
      />
    );
  }

  return (
    <QuizQuestionView
      payload={payload}
      idx={idx}
      setIdx={setIdx}
      picked={picked}
      setPicked={setPicked}
      typed={typed}
      setTyped={setTyped}
      checked={checked}
      onCheckAnswer={handleCheckAnswer}
      subs={subs}
      setSubs={setSubs}
      checks={checks}
      checkingIdx={checkingIdx}
      checkErrors={checkErrors}
      onRunCheck={runSolutionCheck}
      score={score}
      onFinish={() => setFinished(true)}
    />
  );
}

/* ── Results — score counts up, topic bars grow on springs ── */

function QuizResults({
  payload,
  scope,
  gen,
  picked,
  typed,
  checks,
  onRetake,
  onRetakeMisses,
  onRegenerate,
  onOpenGeneration,
}: {
  payload: QuizPayload;
  scope: "full" | "misses";
  gen?: Generation;
  picked: (number | null)[];
  typed: string[];
  checks: (SolutionCheck | null)[];
  onRetake: () => void;
  onRetakeMisses: (missed: QuizQuestion[]) => void;
  onRegenerate?: () => void;
  onOpenGeneration?: (gen: Generation) => void;
}) {
  // Answers are final once results show; score them once.
  const [items] = useState(() =>
    scoreItems(
      payload.questions,
      payload.questions.map((_, i) => ({ picked: picked[i], typed: typed[i], check: checks[i] })),
    ),
  );
  const score = items.reduce((s, it) => s + it.credit, 0);
  const pct = Math.round((score / payload.questions.length) * 100);
  const shownPct = useCountUp(pct, DUR.settle);
  const isMaster = pct >= 80;
  useEffect(() => {
    cueCompad(isMaster ? "passed" : "finished");
  }, [isMaster]);
  const byTopic = new Map<string, { c: number; t: number }>();
  items.forEach((it) => {
    const t = byTopic.get(it.topic) ?? { c: 0, t: 0 };
    t.t++;
    t.c += it.credit;
    byTopic.set(it.topic, t);
  });

  return (
    <motion.div
      initial={ENTER.initial}
      animate={ENTER.animate}
      transition={SOFT}
      className="space-y-6"
    >
      {isMaster && (
        <motion.div
          initial={ENTER.initial}
          animate={ENTER.animate}
          transition={SOFT}
          className="quiz-pass"
        >
          <span className="quiz-pass-seal" aria-hidden>
            <InkMark kind="check" />
          </span>
          <span className="font-display text-lead font-semibold text-brass">
            Strong pass — the lamp stays lit.
          </span>
        </motion.div>
      )}

      <motion.div
        initial={ENTER.initial}
        animate={ENTER.animate}
        transition={{ ...SOFT, delay: 0.08 }}
        className="rounded-[var(--radius-dialog)] border border-hairline bg-ink/[0.02] p-7 text-center"
      >
        <div className="field-label">{scope === "misses" ? "Retake of missed items" : "Result"}</div>
        <div className="quiz-score">
          <svg className="quiz-score-ring" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle cx="60" cy="60" r="53" className="quiz-score-track" />
            <circle
              cx="60"
              cy="60"
              r="53"
              pathLength={100}
              className="quiz-score-arc"
              data-band={pct >= 70 ? "strong" : pct >= 40 ? "middle" : "low"}
              style={{ strokeDashoffset: 100 - pct }}
            />
          </svg>
          <div className="font-display text-[3.2rem] font-[420] leading-none text-lamp">
            {shownPct}%
          </div>
        </div>
        <div className="mt-2 text-small text-muted">
          <span>{fmtScore(score)} of {payload.questions.length} correct</span>
          {payload.questions.some((q) => q.format === "solution") && (
            <span className="mt-0.5 block text-label">Partially-correct solutions earn half credit.</span>
          )}
        </div>
      </motion.div>
      <div>
        <div className="field-label mb-3">By topic</div>
        <div className="space-y-2.5">
          {[...byTopic.entries()].map(([topic, { c, t }], i) => (
            <div key={topic} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-small text-ink/80">{topic}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-ink/[0.06]">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ ...SOFT, delay: 0.25 + i * 0.1 }}
                  className={`h-full origin-left rounded ${c / t >= 0.7 ? "bg-sage/70" : c / t >= 0.4 ? "bg-brass/80" : "bg-rust/80"}`}
                  style={{ width: `${(c / t) * 100}%` }}
                />
              </div>
                  <span className="font-mono text-label text-muted">{fmtScore(c)}/{t}</span>
            </div>
          ))}
        </div>
      </div>
      <AttemptFollowUp
        gen={gen}
        kind="quiz"
        scope={scope}
        questions={payload.questions}
        items={items}
        onRetakeMisses={onRetakeMisses}
        onOpenGeneration={onOpenGeneration}
      />
      <div className="flex flex-wrap justify-end gap-3">
        <button className={btnGhost} onClick={onRetake}>
          <ArrowCounterClockwise size={ICON.sm} className="mr-1.5 inline" />
          {scope === "misses" ? "Retake the whole quiz" : "Retake"}
        </button>
        {onRegenerate && (
          <button className={btnLamp} onClick={onRegenerate}>New quiz</button>
        )}
      </div>
    </motion.div>
  );
}

/* ── Question view — turns like a page between items ──────── */

function QuizQuestionView({
  payload,
  idx,
  setIdx,
  picked,
  setPicked,
  typed,
  setTyped,
  checked,
  onCheckAnswer,
  subs,
  setSubs,
  checks,
  checkingIdx,
  checkErrors,
  onRunCheck,
  score,
  onFinish,
}: {
  payload: QuizPayload;
  idx: number;
  setIdx: (fn: (i: number) => number) => void;
  picked: (number | null)[];
  setPicked: (fn: (p: (number | null)[]) => (number | null)[]) => void;
  typed: string[];
  setTyped: (fn: (t: string[]) => string[]) => void;
  checked: boolean[];
  onCheckAnswer: (i: number) => void;
  subs: (SolutionSubmission | null)[];
  setSubs: (fn: (s: (SolutionSubmission | null)[]) => (SolutionSubmission | null)[]) => void;
  checks: (SolutionCheck | null)[];
  checkingIdx: number | null;
  checkErrors: string[];
  onRunCheck: (i: number) => Promise<void>;
  score: number;
  onFinish: () => void;
}) {
  const q = payload.questions[idx];
  const isLast = idx === payload.questions.length - 1;
  const isChecked = checked[idx];
  const isSolution = q.format === "solution";
  const checking = checkingIdx === idx;
  const correct = isCorrect(q, picked[idx], typed[idx]);
  const check = () => onCheckAnswer(idx);
  const next = () => (isLast ? onFinish() : setIdx((i) => i + 1));

  return (
    <div className="space-y-5 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-x-3 text-label font-medium text-muted">
            <span className="tabular-nums text-ink/80">Item {idx + 1} of {payload.questions.length}</span>
            <span>{q.topic}</span>
          </div>
        </div>
        <div className="whitespace-nowrap text-label tabular-nums text-brass">{fmtScore(score)} correct</div>
      </div>
      <div className="h-1 overflow-hidden rounded bg-ink/[0.06]">
        <motion.div
          className="h-full grad-lamp"
          initial={false}
          animate={{ width: `${((idx + 1) / payload.questions.length) * 100}%` }}
          transition={SOFT}
        />
      </div>

      <AnimatePresence initial={false}>
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: DRIFT_X }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -DRIFT_X, transition: EXIT }}
          transition={SOFT}
          className="space-y-5"
        >
          <AssessmentContent className="assessment-stem">{q.stem}</AssessmentContent>
          {q.graph && <AssessmentGraph graph={q.graph} />}

          {isSolution ? (
            <div className="space-y-3">
              <SolutionBin
                submission={subs[idx]}
                readOnly={isChecked || checking}
                onChange={(s) => setSubs((ss) => ss.map((v, i) => (i === idx ? s : v)))}
              />
              <input
                value={typed[idx]}
                disabled={isChecked}
                onChange={(e) => setTyped((t) => t.map((v, i) => (i === idx ? e.target.value : v)))}
                placeholder="Final answer (optional)"
                className={inputCls}
              />
              <AiCheckNote />
              {checkErrors[idx] && <ErrorNote>{checkErrors[idx]}</ErrorNote>}
              {checking && (
                <div className="space-y-2">
                  <LampPulse label="Reading your working…" />
                  <div className="h-1 overflow-hidden rounded bg-ink/[0.06]">
                    <motion.div
                      className="h-full w-1/3 grad-lamp"
                      animate={{ x: ["-100%", "300%"] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
                    />
                  </div>
                </div>
              )}
              <AnimatePresence>
                {isChecked && checks[idx] && (
                  <SolutionVerdictCard check={checks[idx]!} />
                )}
              </AnimatePresence>
            </div>
          ) : q.format === "identification" ? (
            <div className="space-y-3">
              <input
                value={typed[idx]}
                disabled={isChecked}
                onChange={(e) => setTyped((t) => t.map((v, i) => (i === idx ? e.target.value : v)))}
                placeholder="Type your answer…"
                className={inputCls}
              />
              <AnimatePresence>
                {isChecked && (
                  <motion.div
                    initial={ENTER.initial}
                    animate={ENTER.animate}
                    exit={{ opacity: 0 }}
                    transition={SOFT}
                    className={`flex items-start gap-2 rounded-[var(--radius-dialog)] border px-4 py-3 text-body ${correct ? "border-sage/30 bg-sage/[0.06]" : "border-rust/30 bg-rust/[0.06]"}`}
                  >
                    <InkMark kind={correct ? "check" : "cross"} className={`mt-0.5 shrink-0 ${correct ? "text-sage" : "text-rust"}`} />
                    <span className="min-w-0">
                    <span className={correct ? "text-sage" : "text-rust"}>
                      {correct ? "Correct — " : "The answer: "}
                    </span>
                    <AssessmentContent inline className="text-ink/90">{q.answer}</AssessmentContent>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isPicked = picked[idx] === oi;
                const isAnswer = q.answerIndex === oi;
                const state = !isChecked
                  ? isPicked
                    ? "picked"
                    : "idle"
                  : isAnswer
                    ? "answer"
                    : isPicked
                      ? "wrong"
                      : "idle";
                return (
                  <motion.button
                    key={oi}
                    aria-label={assessmentOptionLabel(opt, oi)}
                    disabled={isChecked}
                    onClick={() => setPicked((p) => p.map((v, i) => (i === idx ? oi : v)))}
                    whileTap={{ scale: 0.985 }}
                    data-state={state}
                    className={`quiz-option flex w-full items-center gap-3 rounded-[var(--radius-dialog)] border px-4 py-3 text-left text-body transition-colors duration-med ${
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
                    {state === "answer" && <InkMark kind="check" className="shrink-0 text-sage" />}
                    {state === "wrong" && <InkMark kind="cross" className="shrink-0 text-rust" />}
                  </motion.button>
                );
              })}
            </div>
          )}

          <AnimatePresence>
            {isChecked && (
              <motion.div
                initial={ENTER.initial}
                animate={ENTER.animate}
                exit={{ opacity: 0 }}
                transition={SOFT}
                className="rounded-[var(--radius-dialog)] border border-moon/15 bg-moon/[0.05] px-4 py-3.5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-small font-semibold text-moon">Why</span>
                  {q.sourceHint && <span className="text-label text-muted">{q.sourceHint}</span>}
                </div>
                <AssessmentContent className="mt-1.5 text-small leading-relaxed text-ink/85">{q.rationale}</AssessmentContent>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between pt-1">
            <button className={btnGhost} onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              Back
            </button>
            {!isChecked ? (
              isSolution ? (
                <button
                  className={btnLamp}
                  onClick={() => void onRunCheck(idx)}
                  disabled={checking || (!subs[idx] && !typed[idx].trim())}
                >
                  {checking ? "Checking…" : "Check my solution"}
                </button>
              ) : (
                <button
                  className={btnLamp}
                  onClick={check}
                  disabled={q.format === "identification" ? !typed[idx].trim() : picked[idx] === null}
                >
                  Check answer
                </button>
              )
            ) : (
              <button className={btnLamp} onClick={next}>
                {isLast ? "See results" : "Next item"}
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function isCorrect(q: QuizQuestion, picked: number | null, typed: string): boolean {
  if (q.format === "identification") return typedAnswerMatches(typed, q.answer);
  return picked === q.answerIndex;
}
