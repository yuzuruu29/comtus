import type { Generation } from "./types";
import type {
  QuizPayload,
  ExamPayload,
  FlashcardsPayload,
  QuizQuestion,
} from "./types";
import { loadChunk } from "./lazyChunk";

export type ExportFormat = "pdf" | "pptx";

/** Which download formats make sense per artifact kind. */
export function exportFormatsFor(kind: Generation["kind"]): ExportFormat[] {
  switch (kind) {
    case "quiz":
    case "exam":
    case "flashcards":
      return ["pdf", "pptx"];
    case "presentation":
    case "slideshow":
      return ["pptx"];
    case "study-guide":
    case "brief":
    case "faq":
    case "timeline":
      return ["pdf"];
    default:
      return [];
  }
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "comtus"
  );
}

const dateStamp = () => new Date().toISOString().slice(0, 10);

export async function exportGeneration(
  gen: Generation,
  notebookName: string,
  format: ExportFormat,
): Promise<void> {
  const base = `${slug(notebookName)}-${slug(gen.title)}-${dateStamp()}`;
  if (format === "pdf") {
    const { savePdf } = await loadChunk(() => import("./pdfExport"));
    await savePdf(gen, notebookName, base);
  } else {
    const { savePptx } = await loadChunk(() => import("./pptxExport"));
    await savePptx(gen, notebookName, base);
  }
}

/* ── shared helpers ───────────────────────────────────────── */

const LETTERS = ["A", "B", "C", "D", "E"];

export function answerText(q: QuizQuestion): string {
  if (q.format === "identification" || q.format === "solution") return q.answer;
  if (q.format === "truefalse") return q.answerIndex === 0 ? "True" : "False";
  return LETTERS[q.answerIndex] ?? q.answer;
}

export function metaLineFor(gen: Generation): string {
  const d = new Date(gen.createdAt);
  const nice = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const payload = gen.payload as Partial<QuizPayload & ExamPayload & FlashcardsPayload>;
  const nQuestions = payload.questions?.length;
  if (gen.kind === "exam") {
    const bp = payload.blueprint;
    const items = bp?.totalItems ?? nQuestions ?? 0;
    return bp?.minutes
      ? `${notebookTag(gen, nice)} · ${items} items · ${bp.minutes} minutes`
      : `${notebookTag(gen, nice)} · ${items} items`;
  }
  if (gen.kind === "quiz") {
    const cfg = payload.config;
    const items = cfg?.count ?? nQuestions ?? 0;
    const bits = [notebookTag(gen, nice), `${items} items`];
    if (cfg?.difficulty) bits.push(cfg.difficulty);
    if (cfg?.scope) bits.push(cfg.scope);
    return bits.join(" · ");
  }
  if (gen.kind === "flashcards") {
    return `${notebookTag(gen, nice)} · ${payload.cards?.length ?? 0} cards`;
  }
  return `${notebookTag(gen, nice)}`;
}

function notebookTag(_gen: Generation, date: string): string {
  return date;
}

/** Strip common markdown markers for plain-text rendering. */
export function stripMd(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_`]/g, "");
}
