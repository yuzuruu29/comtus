import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { QuizConfig, QuizPayload, QuizQuestion, QuizFormat, Generation, SolutionCheck } from "../../lib/types";
import { generateJSON, checkSolution, friendlyError } from "../../lib/llm";
import { useCallSettings, useSettings } from "../../lib/settings";
import { saveGeneration } from "../../lib/db";
import { SOFT, SPRING, useCountUp } from "../fx";
import { playSfx } from "../companion/sfx";
import { GENERATOR_SYSTEM, buildSourceBlock, sanitizeQuestions, solutionCredit, fmtScore } from "./common";
import {
  SolutionBin,
  SolutionVerdictCard,
  AiCheckNote,
  type SolutionSubmission,
} from "./SolutionBin";
import { Field, inputCls, btnLamp, btnGhost, LampPulse, ErrorNote } from "../ui";
import { ArrowCounterClockwise, Check, Sparkle, Trophy, X } from "@phosphor-icons/react";

/* ── Configuration ────────────────────────────────────────── */

export function QuizConfigForm({
  notebookId,
  defaultScope = "",
  onDone,
  onCancel,
}: {
  notebookId: string;
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
      const src = await buildSourceBlock(notebookId, scope || "key concepts and facts");
      if (!src.titles.length) throw new Error("Add at least one source first.");
      setStatus("Comtus is writing your quiz…");
      const raw = await generateJSON<QuizPayload>({
        ...cs,
        system: GENERATOR_SYSTEM,
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
              className={`rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                formats.includes(f)
                  ? "border-brass/50 bg-brass/[0.1] text-brasspale"
                  : "border-hairline text-muted hover:text-ink"
              }`}
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
          <Sparkle size={13} className="mr-1.5 inline" />
          {busy ? "Writing…" : "Write my quiz"}
        </button>
      </div>
    </div>
  );
}

/* ── Taker ────────────────────────────────────────────────── */

export function QuizTaker({
  payload,
  onRetake,
  onRegenerate,
}: {
  payload: QuizPayload;
  onRetake: () => void;
  onRegenerate?: () => void;
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
        stem: q.stem,
        expectedAnswer: q.answer,
        expectedApproach: q.rationale,
        studentFinalAnswer: typed[i].trim() || undefined,
        image: subs[i]!,
      });
      setChecks((c) => c.map((v, j) => (j === i ? result : v)));
      setChecked((c) => c.map((v, j) => (j === i ? true : v)));
      const isSolCorrect = result.verdict === "correct" || result.verdict === "partial";
      if (!isSolCorrect) {
        playSfx("wrong", sfxOn);
      }
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
    if (!ok) {
      playSfx("wrong", sfxOn);
    }
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

  if (finished) {
    return (
      <QuizResults
        payload={payload}
        score={score}
        picked={picked}
        typed={typed}
        checks={checks}
        onRetake={onRetake}
        onRegenerate={onRegenerate}
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
  score,
  picked,
  typed,
  checks,
  onRetake,
  onRegenerate,
}: {
  payload: QuizPayload;
  score: number;
  picked: (number | null)[];
  typed: string[];
  checks: (SolutionCheck | null)[];
  onRetake: () => void;
  onRegenerate?: () => void;
}) {
  const pct = Math.round((score / payload.questions.length) * 100);
  const shownPct = useCountUp(pct, 1000);
  const isMaster = pct >= 80;
  const byTopic = new Map<string, { c: number; t: number }>();
  payload.questions.forEach((qq, i) => {
    const t = byTopic.get(qq.topic) ?? { c: 0, t: 0 };
    t.t++;
    if (qq.format === "solution") {
      if (checks[i]) t.c += solutionCredit(checks[i]);
    } else if (isCorrect(qq, picked[i], typed[i])) t.c++;
    byTopic.set(qq.topic, t);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SOFT}
      className="space-y-6"
    >
      {isMaster && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING}
          className="flex items-center justify-center gap-2 rounded-2xl border border-brass/50 bg-gradient-to-r from-brass/[0.15] via-brass/[0.25] to-brass/[0.15] py-3 px-4 text-center shadow-[0_0_24px_rgba(227,176,75,0.2)]"
        >
          <Trophy size={18} className="text-brass" />
          <span className="font-display text-[15px] font-semibold text-brasspale">
            Strong pass — the lamp stays lit.
          </span>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay: 0.08 }}
        className="rounded-2xl border border-hairline bg-ink/[0.02] p-7 text-center"
      >
        <div className="label-mono">Result</div>
        <div className="mt-3 font-display text-[3.2rem] font-[420] leading-none text-lamp">
          {shownPct}%
        </div>
        <div className="mt-2 text-[13px] text-muted">
          {fmtScore(score)} of {payload.questions.length} correct · partially-correct solutions earn half credit
        </div>
      </motion.div>
      <div>
        <div className="label-mono mb-3">By topic</div>
        <div className="space-y-2.5">
          {[...byTopic.entries()].map(([topic, { c, t }], i) => (
            <div key={topic} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-[12.5px] text-ink/80">{topic}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-ink/[0.06]">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ ...SOFT, delay: 0.25 + i * 0.1 }}
                  className={`h-full origin-left rounded ${c / t >= 0.7 ? "bg-sage/70" : c / t >= 0.4 ? "bg-brass/80" : "bg-rust/80"}`}
                  style={{ width: `${(c / t) * 100}%` }}
                />
              </div>
                  <span className="font-mono text-[10.5px] text-muted">{fmtScore(c)}/{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <button className={btnGhost} onClick={onRetake}>
          <ArrowCounterClockwise size={13} className="mr-1.5 inline" /> Retake
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
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            Item {idx + 1} / {payload.questions.length} · {q.topic}
          </div>
        </div>
        <div className="whitespace-nowrap font-mono text-[11px] text-brasspale">{fmtScore(score)} correct</div>
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
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -26, transition: { duration: 0.16 } }}
          transition={SOFT}
          className="space-y-5"
        >
          <p className="text-[15px] font-medium leading-relaxed text-ink">{q.stem}</p>

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
                      transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={SOFT}
                    className={`rounded-xl border px-4 py-3 text-[13.5px] ${correct ? "border-sage/30 bg-sage/[0.06]" : "border-rust/30 bg-rust/[0.06]"}`}
                  >
                    <span className={correct ? "text-sage" : "text-rust"}>
                      {correct ? "Correct — " : "The answer: "}
                    </span>
                    <span className="text-ink/90">{q.answer}</span>
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
                    disabled={isChecked}
                    onClick={() => setPicked((p) => p.map((v, i) => (i === idx ? oi : v)))}
                    whileTap={{ scale: 0.985 }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13.5px] transition-colors duration-200 ${
                      state === "picked"
                        ? "border-brass/50 bg-brass/[0.08]"
                        : state === "answer"
                          ? "border-sage/40 bg-sage/[0.07]"
                          : state === "wrong"
                            ? "border-rust/40 bg-rust/[0.07]"
                            : "border-hairline bg-ink/[0.02] hover:border-hairline-strong"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline-strong font-mono text-[10.5px] text-muted">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="flex-1 text-ink/90">{opt}</span>
                    <AnimatePresence>
                      {state === "answer" && (
                        <motion.span
                          key="ok"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={SPRING}
                          className="shrink-0"
                        >
                          <Check size={15} className="text-sage" />
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
                          <X size={15} className="text-rust" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          )}

          <AnimatePresence>
            {isChecked && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SOFT}
                className="rounded-xl border border-moon/15 bg-moon/[0.05] px-4 py-3.5"
              >
                <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-moon/80">
                  Why{q.sourceHint ? ` · ${q.sourceHint}` : ""}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink/85">{q.rationale}</p>
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
  if (q.format === "identification") {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    return norm(typed) === norm(q.answer) || (norm(typed).length > 3 && norm(q.answer).includes(norm(typed)));
  }
  return picked === q.answerIndex;
}
