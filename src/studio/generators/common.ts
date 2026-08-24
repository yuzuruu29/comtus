import { groundContext } from "../../lib/retrieval";
import type { QuizQuestion, EssayReviewPayload, Flashcard, SolutionCheck } from "../../lib/types";

/**
 * Shared plumbing for studio generators: pull grounded source text,
 * then shape it into prompts. Generation gets a larger context budget
 * than chat — practice material should see the whole notebook.
 */

const MAX_GEN_CHARS = 480_000; // ≈ 120k tokens of source text, worst case

export interface SourceBlock {
  block: string;
  titles: string[];
  mode: "full" | "retrieved";
  truncated: boolean;
}

export async function buildSourceBlock(
  notebookId: string,
  query: string,
): Promise<SourceBlock> {
  const { docs, mode } = await groundContext(notebookId, query);
  const titles = docs.map((d) => d.source.title);
  let block = "";
  let truncated = false;
  for (const d of docs) {
    const piece = `<<<SOURCE: ${d.source.title}>>>\n${d.text}\n<<<END SOURCE>>>\n\n`;
    if (block.length + piece.length > MAX_GEN_CHARS) {
      truncated = true;
      break;
    }
    block += piece;
  }
  return { block, titles, mode, truncated };
}

export const GENERATOR_SYSTEM = `You are Comtus's exam writer and study-aids author — a meticulous senior lecturer preparing review material.

Rules:
- Draw every item from the provided sources. If the sources are too thin for the request, generate fewer items rather than inventing material, and say so in the natural place.
- Non-Text / Scanned / Image Sources & Hybrid OCR:
  * For non-text sources, diagrams, screenshots, or scanned PDF pages: Force hybrid OCR to extract all visible concepts, formulas, and labels. If the active model lacks multimodal vision/OCR capability to read the scanned layer, admit this limitation honestly instead of inventing fictional questions or rationales.
- Rationales must teach: name the concept, then say why the right answer is right and (for MCQ) why attractive distractors are wrong. Keep each rationale 1–3 sentences.
- Match the requested difficulty and topic distribution faithfully.
- Output ONLY the requested JSON.`;

/* ── Model-output validation ────────────────────────────────
   The UI indexes into generated payloads; validate shapes once,
   at generation time, so a malformed item can never blank it. */

const isStrArr = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

/* ── Drawn-solution scoring, shared by quiz & exam takers ── */

/** Half credit — a partially-correct solution earns its keep. */
export function solutionCredit(check: SolutionCheck | null | undefined): number {
  if (!check) return 0;
  return check.verdict === "correct" ? 1 : check.verdict === "partial" ? 0.5 : 0;
}

/** "7.5" keeps its half; whole numbers stay clean. */
export function fmtScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function sanitizeQuestions(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: QuizQuestion[] = [];
  raw.forEach((q, i) => {
    const o = q as Record<string, unknown>;
    if (typeof o.stem !== "string" || o.stem.trim().length < 4) return;
    const format =
      o.format === "truefalse" || o.format === "identification" || o.format === "solution"
        ? o.format
        : "mcq";
    let options = isStrArr(o.options) ? o.options : [];
    let answerIndex = typeof o.answerIndex === "number" ? Math.floor(o.answerIndex) : 0;
    if (format === "solution") {
      // A drawn-solution item carries its expected final answer in `answer`
      // and the worked method in `rationale` — no options, nothing to pick.
      if (typeof o.answer !== "string" || !o.answer.trim()) return;
      options = [];
      answerIndex = 0;
    } else if (format === "truefalse") {
      options = ["True", "False"];
      answerIndex = answerIndex === 1 ? 1 : 0;
    } else if (format === "identification") {
      options = [];
      answerIndex = 0;
    } else {
      if (options.length < 2) return; // an MCQ without real options is unusable
      if (answerIndex < 0 || answerIndex >= options.length) {
        const byText = options.findIndex(
          (opt) => typeof o.answer === "string" && opt.trim() === o.answer.trim(),
        );
        answerIndex = byText >= 0 ? byText : 0;
      }
    }
    out.push({
      id: `q${i}`,
      format,
      topic: typeof o.topic === "string" && o.topic.trim() ? o.topic : "General",
      difficulty:
        o.difficulty === "easy" || o.difficulty === "hard" ? o.difficulty : "moderate",
      stem: o.stem,
      options,
      answerIndex,
      answer: typeof o.answer === "string" ? o.answer : options[answerIndex] ?? "",
      rationale: typeof o.rationale === "string" ? o.rationale : "",
      sourceHint: typeof o.sourceHint === "string" ? o.sourceHint : undefined,
    });
  });
  return out;
}

export function sanitizeReview(raw: unknown, fallbackMax: number): EssayReviewPayload {
  const o = (raw ?? {}) as Record<string, unknown>;
  const criteria = (Array.isArray(o.criteria) ? o.criteria : [])
    .map((c) => {
      const x = c as Record<string, unknown>;
      const max = typeof x.max === "number" && x.max > 0 ? x.max : 0;
      const score = typeof x.score === "number" ? Math.max(0, Math.min(x.score, max || 0)) : 0;
      return {
        name: typeof x.name === "string" ? x.name : "Criterion",
        score,
        max,
        comment: typeof x.comment === "string" ? x.comment : "",
      };
    })
    .filter((c) => c.max > 0);
  const overallMax =
    typeof o.overallMax === "number" && o.overallMax > 0
      ? o.overallMax
      : criteria.reduce((s, c) => s + c.max, 0) || fallbackMax;
  const overall =
    typeof o.overall === "number" && o.overall >= 0
      ? Math.min(o.overall, overallMax)
      : criteria.reduce((s, c) => s + c.score, 0);
  const strArr = (v: unknown) => (isStrArr(v) ? v : []);
  return {
    prompt: typeof o.prompt === "string" ? o.prompt : "",
    rubricName: typeof o.rubricName === "string" ? o.rubricName : "Rubric",
    essay: typeof o.essay === "string" ? o.essay : "",
    overall,
    overallMax,
    criteria,
    strengths: strArr(o.strengths),
    improvements: strArr(o.improvements),
    reasoning: typeof o.reasoning === "string" ? o.reasoning : "",
  };
}

export function sanitizeCards(raw: unknown): Flashcard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c, i): Flashcard | null => {
      const o = (c ?? {}) as Record<string, unknown>;
      if (typeof o.front !== "string" || typeof o.back !== "string") return null;
      if (o.front.trim().length < 2 || o.back.trim().length < 1) return null;
      return {
        id: `c${i}`,
        front: o.front,
        back: o.back,
        topic: typeof o.topic === "string" ? o.topic : undefined,
      };
    })
    .filter((c): c is Flashcard => c !== null);
}
