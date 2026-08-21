import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, X, RotateCcw, Timer, GraduationCap, PencilLine } from "lucide-react";
import type {
  ExamBlueprint,
  ExamMode,
  ExamPayload,
  Generation,
  QuizQuestion,
} from "../../lib/types";
import { generateJSON, friendlyError } from "../../lib/llm";
import { useCallSettings } from "../../lib/settings";
import { saveGeneration } from "../../lib/db";
import { SOFT, SPRING, useCountUp } from "../fx";
import { GENERATOR_SYSTEM, buildSourceBlock, sanitizeQuestions } from "./common";
import { Field, inputCls, btnLamp, btnGhost, LampPulse, ErrorNote } from "../ui";

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
  onDone,
  onCancel,
}: {
  notebookId: string;
  onDone: (gen: Generation) => void;
  onCancel: () => void;
}) {
  const cs = useCallSettings();
  const [presetId, setPresetId] = useState("pnle");
  const [blueprint, setBlueprint] = useState<ExamBlueprint>(EXAM_PRESETS[0].blueprint);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const pickPreset = (id: string) => {
    setPresetId(id);
    setBlueprint(structuredClone(EXAM_PRESETS.find((p) => p.id === id)!.blueprint));
  };

  const total = blueprint.sections.reduce((s, x) => s + (x.items || 0), 0);

  const generate = async () => {
    setError("");
    setBusy(true);
    setStatus("Reading your sources…");
    try {
      if (total < 5) throw new Error("A blueprint needs at least 5 items.");
      const scope = blueprint.sections.map((s) => s.topic).join("; ");
      const src = await buildSourceBlock(notebookId, scope);
      if (!src.titles.length) throw new Error("Add at least one source first.");
      setStatus(`Writing ${total} items across ${blueprint.sections.length} sections…`);
      const questions = await generateJSON<QuizQuestion[]>({
        ...cs,
        system: GENERATOR_SYSTEM,
        user: `Write a full board-exam simulation from these sources.

Sources:
${src.block}

Exam blueprint — follow the section/item distribution EXACTLY:
${blueprint.sections.map((s) => `- ${s.topic}: ${s.items} items`).join("\n")}
Total: ${total} items, all multiple choice (4 options each).
Difficulty: ${blueprint.difficulty}${blueprint.difficulty === "mixed" ? " (30% easy, 50% moderate, 20% hard)" : ""}.
Style: board-exam voice — clinical vignettes or scenario stems where the subject allows; otherwise precise recall items. Every item answerable from the sources.

JSON shape: an array of
{"format":"mcq","topic":"<section topic exactly as above>","difficulty":"easy"|"moderate"|"hard","stem":"...","options":["A","B","C","D"],"answerIndex":0,"answer":"<option text>","rationale":"why, teaching the concept","sourceHint":"source title"}`,
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
              className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                presetId === p.id
                  ? "border-brass/50 bg-brass/[0.08]"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <div className="font-mono text-[11px] font-medium tracking-[0.1em] text-brasspale">
                {p.name}
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-faded">{p.blurb}</div>
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-faded transition-colors hover:text-rust active:scale-95"
                aria-label="Remove section"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setBlueprint((b) => ({ ...b, sections: [...b.sections, { topic: "New topic", items: 10 }] }))
            }
            className="flex min-h-[40px] items-center text-[12.5px] font-medium text-faded transition-colors hover:text-brasspale active:scale-95"
          >
            + Add section
          </button>
        </div>
      </Field>

      {status && <LampPulse label={status} />}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-3">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnLamp} onClick={generate} disabled={busy}>
          <GraduationCap size={14} className="mr-1.5 inline" />
          {busy ? "Setting the papers…" : `Generate ${total}-item exam`}
        </button>
      </div>
    </div>
  );
}

/* ── Runner ───────────────────────────────────────────────── */

export function ExamRunner({
  payload,
  onExit,
}: {
  payload: ExamPayload;
  onExit?: () => void;
}) {
  const [mode, setMode] = useState<ExamMode | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => payload.questions.map(() => null));
  const [revealed, setRevealed] = useState<boolean[]>(() => payload.questions.map(() => false));
  const [finished, setFinished] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(payload.blueprint.minutes * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const qs = payload.questions;
  const correctCount = useMemo(
    () => qs.reduce((n, q, i) => n + (answers[i] === q.answerIndex ? 1 : 0), 0),
    [qs, answers],
  );

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

  if (!mode) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
          <div className="font-display text-[1.5rem] font-[430] text-parchment">{payload.blueprint.title}</div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-faded">
            {payload.blueprint.totalItems} items · {payload.blueprint.minutes} minutes · shaded scoring
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => setMode("simulated")}
            className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-5 text-left transition-colors hover:border-brass/40 hover:bg-brass/[0.04]"
          >
            <Timer size={17} className="text-brasspale" />
            <div className="mt-3 font-display text-[1.1rem] font-[440] text-parchment">Simulated</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-faded">
              Clock runs, answers stay hidden until you submit — the dress rehearsal.
            </p>
          </button>
          <button
            onClick={() => setMode("drill")}
            className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-5 text-left transition-colors hover:border-brass/40 hover:bg-brass/[0.04]"
          >
            <PencilLine size={17} className="text-brasspale" />
            <div className="mt-3 font-display text-[1.1rem] font-[440] text-parchment">Drill</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-faded">
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
        correctCount={correctCount}
        onExit={onExit}
        onRetake={() => {
          setMode(null);
          setAnswers(qs.map(() => null));
          setRevealed(qs.map(() => false));
          setFinished(false);
          setIdx(0);
          setSecondsLeft(payload.blueprint.minutes * 60);
        }}
      />
    );
  }

  const q = qs[idx];
  const answeredCount = answers.filter((a) => a !== null).length;
  const showRationale = mode === "drill" && revealed[idx];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faded">
          Item {idx + 1} / {qs.length} · {q.topic}
        </div>
        {mode === "simulated" ? (
          <div className="font-mono text-[11.5px] tabular-nums text-brasspale">
            {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </div>
        ) : (
          <div className="font-mono text-[11px] text-brasspale">{answeredCount} answered</div>
        )}
      </div>
      <div className="h-1 overflow-hidden rounded bg-white/[0.06]">
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
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -26, transition: { duration: 0.16 } }}
          transition={SOFT}
          className="space-y-5"
        >
          <p className="text-[15px] font-medium leading-relaxed text-parchment">{q.stem}</p>
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
                  onClick={() => setAnswers((a) => a.map((v, i) => (i === idx ? oi : v)))}
                  whileTap={{ scale: 0.985 }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13.5px] transition-colors duration-200 ${
                    state === "picked"
                      ? "border-brass/50 bg-brass/[0.08]"
                      : state === "answer"
                        ? "border-sage/40 bg-sage/[0.07]"
                        : state === "wrong"
                          ? "border-rust/40 bg-rust/[0.07]"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[10.5px] text-faded">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <span className="flex-1 text-parchment/90">{opt}</span>
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

          <AnimatePresence>
            {showRationale && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SOFT}
                className="rounded-xl border border-moon/15 bg-moon/[0.05] px-4 py-3.5"
              >
                <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-moon/80">Why</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-parchment/85">{q.rationale}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between pt-1">
            <button className={btnGhost} onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              Back
            </button>
            <div className="flex gap-2">
              {mode === "drill" && !revealed[idx] && (
                <button
                  className={btnGhost}
                  onClick={() => setRevealed((r) => r.map((v, i) => (i === idx ? true : v)))}
                  disabled={answers[idx] === null}
                >
                  Check
                </button>
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
        <div className="flex flex-wrap justify-center gap-2 border-t border-white/[0.06] pt-4 sm:gap-1.5">
          {qs.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[10.5px] transition-all active:scale-90 sm:h-7 sm:w-7 sm:text-[9.5px] ${
                i === idx
                  ? "bg-brass/25 text-brasspale ring-1 ring-brass/40"
                  : answers[i] !== null
                    ? "bg-white/[0.09] text-parchment/80"
                    : "bg-white/[0.03] text-faded/60"
              }`}
            >
              {i + 1}
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
  correctCount,
  onExit,
  onRetake,
}: {
  title: string;
  questions: QuizQuestion[];
  answers: (number | null)[];
  correctCount: number;
  onExit?: () => void;
  onRetake: () => void;
}) {
  const pct = Math.round((correctCount / questions.length) * 100);
  const shownPct = useCountUp(pct, 1100);
  const byTopic = new Map<string, { c: number; t: number }>();
  questions.forEach((q, i) => {
    const t = byTopic.get(q.topic) ?? { c: 0, t: 0 };
    t.t++;
    if (answers[i] === q.answerIndex) t.c++;
    byTopic.set(q.topic, t);
  });
  const verdict =
    pct >= 75 ? "Passing pace." : pct >= 60 ? "Getting close — drill the weak sections." : "The lamp stays on. Review, then retake.";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SOFT}
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay: 0.08 }}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 text-center"
      >
        <div className="label-mono">{title} — Result</div>
        <div className={`mt-3 font-display text-[2.8rem] font-[420] leading-none sm:text-[3.4rem] ${pct >= 75 ? "text-sage" : "text-lamp"}`}>
          {shownPct}%
        </div>
        <div className="mt-2 text-[13px] text-faded">
          {correctCount} of {questions.length} correct · {verdict}
        </div>
      </motion.div>
      <div>
        <div className="label-mono mb-3">By section</div>
        <div className="space-y-2.5">
          {[...byTopic.entries()].map(([topic, { c, t }], i) => (
            <div key={topic} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-[12px] text-parchment/80 sm:w-44 sm:text-[12.5px]">{topic}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/[0.06]">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ ...SOFT, delay: 0.25 + i * 0.1 }}
                  className={`h-full origin-left rounded ${c / t >= 0.75 ? "bg-sage/70" : c / t >= 0.5 ? "bg-brass/80" : "bg-rust/80"}`}
                  style={{ width: `${(c / t) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right font-mono text-[10.5px] text-faded">{c}/{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="label-mono mb-3">Review — every item, with its rationale</div>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const ok = answers[i] === q.answerIndex;
            return (
              <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? "bg-sage/15 text-sage" : "bg-rust/15 text-rust"}`}>
                    {ok ? <Check size={11} /> : <X size={11} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium leading-relaxed text-parchment/90">{q.stem}</p>
                    {!ok && (
                      <p className="mt-1.5 text-[12px] text-faded">
                        Yours: {answers[i] !== null ? q.options[answers[i]!] : "— skipped"} · Key:{" "}
                        <span className="text-sage">{q.options[q.answerIndex]}</span>
                      </p>
                    )}
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-parchment/70">{q.rationale}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        {onExit && <button className={btnGhost} onClick={onExit}>Done</button>}
        <button className={btnLamp} onClick={onRetake}>
          <RotateCcw size={13} className="mr-1.5 inline" /> Retake
        </button>
      </div>
    </motion.div>
  );
}
