import { useState } from "react";

import type { EssayReviewPayload, Generation, RubricCriterion } from "../../lib/types";
import { RUBRICS } from "../../lib/types";
import { generateJSON, friendlyError } from "../../lib/llm";
import { useCallSettings } from "../../lib/settings";
import { saveGeneration } from "../../lib/db";
import { GENERATOR_SYSTEM, buildSourceBlock, sanitizeReview } from "./common";
import { Field, inputCls, btnLamp, btnGhost, LampPulse, ErrorNote } from "../ui";
import { Feather, ListChecks, PencilSimpleLine } from "@phosphor-icons/react";

interface PromptIdea {
  title: string;
  prompt: string;
  guidance: string;
}

/* ── Step 1: prompt ───────────────────────────────────────── */

export function EssayConfigForm({
  notebookId,
  onDone,
  onCancel,
}: {
  notebookId: string;
  onDone: (gen: Generation) => void;
  onCancel: () => void;
}) {
  const cs = useCallSettings();
  const [ideas, setIdeas] = useState<PromptIdea[] | null>(null);
  const [chosen, setChosen] = useState<PromptIdea | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [essay, setEssay] = useState("");
  const [rubricId, setRubricId] = useState(RUBRICS[0].id);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const rubric = RUBRICS.find((r) => r.id === rubricId)!;
  const words = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  const thinkUp = async () => {
    setError("");
    setBusy(true);
    setStatus("Reading your sources for essay-worthy tensions…");
    try {
      const src = await buildSourceBlock(notebookId, "central themes, arguments, debates");
      if (!src.titles.length) throw new Error("Add at least one source first.");
      const out = await generateJSON<{ prompts: PromptIdea[] }>({
        ...cs,
        system: GENERATOR_SYSTEM,
        user: `From these sources, design 3 essay prompts a lecturer would set — each probing analysis, not recall.

Sources:
${src.block}

JSON shape: {"prompts":[{"title":"short name","prompt":"the essay question itself","guidance":"2–3 sentences on what a strong answer must do"}]}`,
        onStatus: setStatus,
      });
      setIdeas(out.prompts);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const grade = async () => {
    if (!chosen && !customPrompt.trim()) return;
    setError("");
    setBusy(true);
    setStatus("Reading your essay the way an examiner would…");
    try {
      const promptText = chosen ? chosen.prompt : customPrompt.trim();
      const src = await buildSourceBlock(notebookId, promptText);
      const criteriaText = rubric.criteria.map(([n, max]) => `- ${n} (max ${max})`).join("\n");
      const review = sanitizeReview(
        await generateJSON<unknown>({
        ...cs,
        system: GENERATOR_SYSTEM,
        user: `Grade this essay like a demanding but fair professor. Use the sources to check factual grounding.

Sources:
${src.block}

ESSAY PROMPT:
${promptText}

RUBRIC — score each criterion strictly within its max:
${criteriaText}

ESSAY:
"""
${essay}
"""

JSON shape:
{"prompt":${JSON.stringify(promptText)},"rubricName":${JSON.stringify(rubric.name)},"overall":<sum of criterion scores>,"overallMax":<sum of maxima>,"criteria":[{"name":"exact criterion name","score":<n>,"max":<max>,"comment":"2–3 sentences: what earned the score, what was missing"}],"strengths":["2–4 specifics"],"improvements":["2–4 concrete, prioritized actions"],"reasoning":"one honest paragraph of the grader's overall judgment, including whether the essay stays grounded in the sources"}`,
        onStatus: setStatus,
      }),
        rubric.criteria.reduce((s, [, max]) => s + max, 0),
      );
      const gen: Generation = {
        id: `${Date.now().toString(36)}-r`,
        notebookId,
        kind: "essay-review",
        title: `Essay · ${(chosen?.title ?? (customPrompt.trim() || "Custom prompt")).slice(0, 60)}`,
        payload: review,
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
      {!ideas && !chosen && (
        <>
          <button
            onClick={thinkUp}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-xl border border-brass/25 bg-brass/[0.05] px-4 py-3.5 text-left transition-colors hover:bg-brass/[0.09] disabled:opacity-50"
          >
            <Feather size={16} className="shrink-0 text-brasspale" />
            <span className="text-[13.5px] text-ink/90">
              {busy ? status || "Thinking of prompts…" : "Set three prompts from my sources"}
            </span>
          </button>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="label-mono !text-[9.5px]">or bring your own</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <Field label="Your own prompt">
            <input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Paste the essay question here…"
              className={inputCls}
            />
          </Field>
          {customPrompt.trim() && (
            <>
              <Field label="Rubric">
                <select value={rubricId} onChange={(e) => setRubricId(e.target.value)} className={inputCls}>
                  {RUBRICS.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Your essay" hint={`${words} words`}>
                <textarea
                  value={essay}
                  onChange={(e) => setEssay(e.target.value)}
                  rows={5}
                  placeholder="Write, or paste your draft…"
                  className={inputCls + " min-h-[120px] resize-none leading-relaxed sm:rows-10"}
                />
              </Field>
            </>
          )}
          {busy && !status && <LampPulse label="Working…" />}
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between sm:gap-3">
            <button className={btnGhost} onClick={onCancel}>Cancel</button>
            {customPrompt.trim() && essay.trim().length > 80 && (
              <button className={btnLamp} onClick={grade} disabled={busy}>
                <ListChecks size={14} className="mr-1.5 inline" />
                {busy ? "Grading…" : "Grade with reasoning"}
              </button>
            )}
          </div>
        </>
      )}

      {ideas && !chosen && (
        <div className="space-y-3">
          <div className="label-mono">Choose a prompt</div>
          {ideas.map((p) => (
            <button
              key={p.title}
              onClick={() => setChosen(p)}
              className="w-full rounded-xl border border-hairline bg-ink/[0.02] p-4 text-left transition-colors hover:border-brass/40 active:scale-[0.99]"
            >
              <div className="font-display text-[1.05rem] font-[440] text-ink">{p.title}</div>
              <div className="mt-1.5 text-[13px] leading-relaxed text-ink/80">{p.prompt}</div>
              <div className="mt-2 text-[12px] italic leading-relaxed text-muted">{p.guidance}</div>
            </button>
          ))}
          <div className="flex justify-end">
            <button className={btnGhost} onClick={() => setIdeas(null)}>Back</button>
          </div>
        </div>
      )}

      {chosen && (
        <div className="space-y-5">
          <div className="rounded-xl border border-brass/25 bg-brass/[0.05] px-4 py-3.5">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-brass/80">
              {chosen.title}
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink/90">{chosen.prompt}</p>
            <p className="mt-2 text-[12px] italic leading-relaxed text-muted">{chosen.guidance}</p>
          </div>
          <Field label="Rubric">
            <select value={rubricId} onChange={(e) => setRubricId(e.target.value)} className={inputCls}>
              {RUBRICS.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Your essay" hint={`${words} words`}>
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              rows={6}
              placeholder="Write it here — or paste your draft…"
              className={inputCls + " min-h-[140px] resize-none leading-relaxed sm:rows-12"}
            />
          </Field>
          {status && <LampPulse label={status} />}
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between sm:gap-3">
            <button className={btnGhost} onClick={() => setChosen(null)}>
              <PencilSimpleLine size={13} className="mr-1.5 inline" /> Different prompt
            </button>
            <button className={btnLamp} onClick={grade} disabled={busy || essay.trim().length < 80}>
              {busy ? "Grading…" : "Grade with reasoning"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Feedback view ────────────────────────────────────────── */

export function EssayFeedback({ payload }: { payload: EssayReviewPayload }) {
  const pct = Math.round((payload.overall / payload.overallMax) * 100);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-hairline bg-ink/[0.02] p-6 text-center">
        <div className="label-mono">{payload.rubricName}</div>
        <div className="mt-3 font-display text-[2.5rem] font-[420] leading-none text-lamp sm:text-[3rem]">
          {payload.overall}
          <span className="text-[1.2rem] text-muted sm:text-[1.4rem]"> / {payload.overallMax}</span>
        </div>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-muted">{payload.prompt}</p>
      </div>

      <div className="space-y-3">
        {payload.criteria.map((c: RubricCriterion) => (
          <div key={c.name} className="rounded-xl border border-hairline bg-ink/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-medium text-ink/90">{c.name}</span>
              <span className="font-mono text-[11.5px] text-brasspale">
                {c.score} / {c.max}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded bg-ink/[0.06]">
              <div className="h-full grad-lamp" style={{ width: `${(c.score / c.max) * 100}%` }} />
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">{c.comment}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-moon/15 bg-moon/[0.05] px-4 py-4">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-moon/80">
          The grader's reasoning
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink/85">{payload.reasoning}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="label-mono mb-2.5 text-sage/80">Strengths</div>
          <ul className="space-y-2">
            {payload.strengths.map((s, i) => (
              <li key={i} className="rounded-lg border border-sage/20 bg-sage/[0.04] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink/85">
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="label-mono mb-2.5 text-brass/80">Next draft</div>
          <ul className="space-y-2">
            {payload.improvements.map((s, i) => (
              <li key={i} className="rounded-lg border border-brass/20 bg-brass/[0.04] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink/85">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted/60">
        {pct}% — rough thought, polished
      </div>
    </div>
  );
}
