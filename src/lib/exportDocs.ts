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
  if (q.format === "identification") return q.answer;
  if (q.format === "truefalse") return q.answerIndex === 0 ? "True" : "False";
  return LETTERS[q.answerIndex] ?? q.answer;
}

export function metaLineFor(gen: Generation): string {
  const d = new Date(gen.createdAt);
  const nice = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  if (gen.kind === "exam") {
    const bp = (gen.payload as ExamPayload).blueprint;
    return `${notebookTag(gen, nice)} · ${bp.totalItems} items · ${bp.minutes} minutes`;
  }
  if (gen.kind === "quiz") {
    const cfg = (gen.payload as QuizPayload).config;
    return `${notebookTag(gen, nice)} · ${cfg.count} items · ${cfg.difficulty} · ${cfg.scope}`;
  }
  if (gen.kind === "flashcards") {
    return `${notebookTag(gen, nice)} · ${(gen.payload as FlashcardsPayload).cards.length} cards`;
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
