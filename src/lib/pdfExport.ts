import { jsPDF } from "jspdf";
import type { Generation } from "./types";
import type {
  QuizPayload,
  ExamPayload,
  FlashcardsPayload,
  DocPayload,
  QuizQuestion,
} from "./types";
import { answerText, metaLineFor, stripMd } from "./exportDocs";

/* Print-first PDF engine: Letter, vector text (crisp at any zoom),
 * white paper, ink text, brass accents that survive grayscale printing. */

const INK: [number, number, number] = [0x21, 0x24, 0x2e];
const FADED: [number, number, number] = [0x6b, 0x70, 0x7e];
const BRASS: [number, number, number] = [0x8f, 0x6a, 0x1f];
const RULE: [number, number, number] = [0xd9, 0xdc, 0xe3];
const CARD_LINE: [number, number, number] = [0xb9, 0xbe, 0xc9];

const M = 56; // page margin (pt)
const W = 612 - M * 2; // usable width
const BOTTOM = 792 - M - 18; // leave room for the footer

type Doc = jsPDF;

class Flow {
  doc: Doc;
  y = 0;
  constructor(doc: Doc) {
    this.doc = doc;
    this.y = M;
  }
  gap(n = 10) {
    this.y += n;
  }
}

function setFill(doc: Doc, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function wrapped(
  flow: Flow,
  text: string,
  opts: {
    size?: number;
    style?: "normal" | "bold" | "italic";
    color?: [number, number, number];
    indent?: number;
    lead?: number;
    gapAfter?: number;
  } = {},
): void {
  const { size = 10.5, style = "normal", color = INK, indent = 0, lead = 1.42, gapAfter = 0 } = opts;
  const doc = flow.doc;
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  setFill(doc, color);
  const lines = doc.splitTextToSize(text, W - indent) as string[];
  const lh = size * lead;
  for (const line of lines) {
    if (flow.y + lh > BOTTOM) doc.addPage();
    doc.text(line, M + indent, flow.y + size);
    flow.y += lh;
  }
  flow.gap(gapAfter);
}

function heading(flow: Flow, text: string, size = 15): void {
  flow.gap(12);
  wrapped(flow, text, { size, style: "bold", color: INK });
  const doc = flow.doc;
  if (flow.y + 10 > BOTTOM) doc.addPage();
  doc.setDrawColor(BRASS[0], BRASS[1], BRASS[2]);
  doc.setLineWidth(1.4);
  doc.line(M, flow.y + 3, M + 46, flow.y + 3);
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.6);
  doc.line(M + 46, flow.y + 3, M + W, flow.y + 3);
  flow.gap(12);
}

function chrome(doc: Doc, title: string, meta: string, notebookName: string): Flow {
  const flow = new Flow(doc);
  doc.setFont("times", "bold");
  doc.setFontSize(21);
  setFill(doc, INK);
  const titleLines = doc.splitTextToSize(title, W) as string[];
  for (const line of titleLines) {
    doc.text(line, M, flow.y + 17);
    flow.y += 23;
  }
  flow.gap(2);
  wrapped(flow, meta, { size: 9, color: FADED });
  flow.gap(4);
  doc.setDrawColor(BRASS[0], BRASS[1], BRASS[2]);
  doc.setLineWidth(1.6);
  doc.line(M, flow.y, M + 64, flow.y);
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.6);
  doc.line(M + 64, flow.y, M + W, flow.y);
  flow.gap(10);
  doc.setProperties({
    title,
    subject: `${notebookName} — Comtus study material`,
    creator: "Comtus",
  });
  return flow;
}

function footers(doc: Doc, notebookName: string): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setFill(doc, FADED);
    doc.text(`Generated with Comtus · ${notebookName}`, M, 792 - 24);
    doc.text(`Page ${i} of ${total}`, 612 - M, 792 - 24, { align: "right" });
  }
}

function nameDateScoreRow(flow: Flow, total?: number): void {
  const doc = flow.doc;
  flow.y += 8;
  if (flow.y + 20 > BOTTOM) doc.addPage();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setFill(doc, INK);
  doc.setDrawColor(CARD_LINE[0], CARD_LINE[1], CARD_LINE[2]);
  doc.setLineWidth(0.8);

  const labelLine = (label: string, x: number, w: number) => {
    doc.text(label, x, flow.y);
    const lw = doc.getTextWidth(label) + 6;
    doc.line(x + lw, flow.y + 2, x + lw + w, flow.y + 2);
    return x + lw + w;
  };

  let x = labelLine("Name", M, 168);
  x = labelLine("Date", x + 26, 96);
  if (total != null) {
    x = labelLine("Score", x + 26, 64);
    doc.setFontSize(9);
    setFill(doc, FADED);
    doc.text(`/${total}`, x + 4, flow.y + 1);
  }
  flow.gap(22);
}

/* ── quiz & exam paper ────────────────────────────────────── */

function questionBlock(flow: Flow, q: QuizQuestion, n: number): void {
  const doc = flow.doc;
  const stemX = M + 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setFill(doc, INK);
  const stemLines = doc.splitTextToSize(q.stem, W - 22) as string[];

  // Never orphan an item's options on the next page.
  const optionsCount = q.format === "identification" ? 0 : q.format === "truefalse" ? 2 : q.options.length;
  const needed = stemLines.length * 15 + optionsCount * 16 + 34;
  if (flow.y + needed > BOTTOM && flow.y > M + 20) doc.addPage();

  doc.setFont("helvetica", "bold");
  doc.text(`${n}.`, M, flow.y + 10.5);
  doc.setFont("helvetica", "normal");
  let sy = flow.y;
  for (const line of stemLines) {
    doc.text(line, stemX, sy + 10.5);
    sy += 15;
  }
  flow.y = sy + 4;

  if (q.format === "identification") {
    doc.setDrawColor(CARD_LINE[0], CARD_LINE[1], CARD_LINE[2]);
    doc.setLineWidth(0.8);
    if (flow.y + 16 > BOTTOM) doc.addPage();
    doc.line(stemX + 4, flow.y + 8, M + W - 30, flow.y + 8);
    flow.gap(20);
  } else {
    const opts = q.format === "truefalse" ? ["True", "False"] : q.options;
    opts.forEach((opt, i) => {
      wrapped(flow, `${String.fromCharCode(65 + i)}.  ${opt}`, { indent: 22 });
      flow.y += 3;
    });
    flow.gap(8);
  }
}

function quizExamPdf(doc: Doc, gen: Generation, notebookName: string): void {
  const isExam = gen.kind === "exam";
  const payload = gen.payload as QuizPayload & ExamPayload;
  const questions: QuizQuestion[] = payload.questions;

  const flow = chrome(doc, gen.title, metaLineFor(gen), notebookName);

  if (isExam && payload.blueprint?.sections?.length) {
    wrapped(
      flow,
      `Blueprint: ` + payload.blueprint.sections.map((s) => `${s.topic} (${s.items})`).join("  ·  "),
      { size: 9.5, color: FADED, gapAfter: 8 },
    );
  }

  nameDateScoreRow(flow, isExam ? payload.blueprint?.totalItems : questions.length);

  wrapped(flow, "Read each item carefully. Choose the best answer.", {
    size: 9.5,
    style: "italic",
    color: FADED,
    gapAfter: 8,
  });

  questions.forEach((q, i) => questionBlock(flow, q, i + 1));

  // Answer key on its own page — print the paper without the last page.
  doc.addPage();
  const keyFlow = new Flow(doc);
  heading(keyFlow, "Answer Key", 14);
  questions.forEach((q, i) => {
    const d = keyFlow.doc;
    const ans = answerText(q);
    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    setFill(d, BRASS);
    const numW = 22;
    const ansW = d.getTextWidth(ans);
    // Long answers push the rationale onto its own line instead of beside it.
    const beside = numW + ansW + 12 <= W - 120;
    const ratX = beside ? M + numW + ansW + 12 : M + 10;
    const ratW = beside ? W - numW - ansW - 12 : W - 10;
    d.setFont("helvetica", "italic");
    d.setFontSize(9);
    setFill(d, FADED);
    const ratLines = (d.splitTextToSize(q.rationale || "", ratW) as string[]).slice(0, beside ? 2 : 3);
    const rowH = beside ? Math.max(16, ratLines.length * 11 + 4) : 16 + ratLines.length * 11;
    if (keyFlow.y + rowH + 4 > BOTTOM) d.addPage();
    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    setFill(d, BRASS);
    d.text(`${i + 1}.`, M, keyFlow.y + 10);
    d.text(ans, M + numW, keyFlow.y + 10);
    d.setFont("helvetica", "italic");
    d.setFontSize(9);
    setFill(d, FADED);
    ratLines.forEach((line, li) => {
      d.text(line, ratX, keyFlow.y + 10 + (beside ? li * 11 : 14 + li * 11));
    });
    keyFlow.y += rowH + 4;
  });

  footers(doc, notebookName);
}

/* ── flashcards: duplex cut-out sheets ────────────────────── */

const CARD_COLS = 2;
const CARD_ROWS = 3;
const CARD_GAP = 14;
const CARD_H = 170;

function cardSheet(
  doc: Doc,
  cards: { label: string; text: string }[],
  side: "front" | "back",
  continueOnCurrent: boolean,
  startY = M,
): void {
  const cardW = (W - CARD_GAP * (CARD_COLS - 1)) / CARD_COLS;
  let idx = 0;
  let firstSheet = true;
  while (idx < cards.length) {
    if (!continueOnCurrent || !firstSheet || side === "back") doc.addPage();
    const firstSheetContinue = continueOnCurrent && firstSheet && side === "front";
    firstSheet = false;
    let y = firstSheetContinue ? startY : M;
    for (let row = 0; row < CARD_ROWS && idx < cards.length; row++) {
      for (let col = 0; col < CARD_COLS && idx < cards.length; col++) {
        // Duplex long-edge flip: back columns mirror the fronts' order per row,
        // so the printed back lands behind its front.
        const placeCol = side === "back" ? CARD_COLS - 1 - col : col;
        const x = M + placeCol * (cardW + CARD_GAP);
        doc.setDrawColor(CARD_LINE[0], CARD_LINE[1], CARD_LINE[2]);
        doc.setLineWidth(0.9);
        doc.setLineDashPattern([3, 3], 0);
        doc.roundedRect(x, y, cardW, CARD_H, 8, 8);
        doc.setLineDashPattern([], 0);
        // number chip
        doc.setFillColor(0xf3, 0xee, 0xe0);
        doc.roundedRect(x + 10, y + 10, 22, 15, 4, 4, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        setFill(doc, BRASS);
        doc.text(cards[idx].label, x + 21, y + 20.5, { align: "center" });
        // body
        doc.setFont("helvetica", side === "front" ? "bold" : "normal");
        doc.setFontSize(side === "front" ? 11 : 10.5);
        setFill(doc, INK);
        const lines = doc.splitTextToSize(cards[idx].text, cardW - 24) as string[];
        const maxLines = Math.floor((CARD_H - 44) / 13.5);
        lines.slice(0, maxLines).forEach((line, li) => {
          doc.text(line, x + 12, y + 42 + li * 13.5);
        });
        if (lines.length > maxLines) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          setFill(doc, FADED);
          doc.text("…", x + 12, y + 42 + maxLines * 13.5);
        }
        idx++;
      }
      y += CARD_H + CARD_GAP;
    }
  }
}

function flashcardsPdf(doc: Doc, gen: Generation, notebookName: string): void {
  const cards = (gen.payload as FlashcardsPayload).cards;
  const flow = chrome(doc, gen.title, metaLineFor(gen), notebookName);
  wrapped(
    flow,
    "Print double-sided (flip on long edge), then cut along the dashed lines — the backs land mirrored behind their matching fronts. Fronts are bold; backs are regular.",
    { size: 9.5, style: "italic", color: FADED, gapAfter: 10 },
  );

  const fronts = cards.map((c, i) => ({ label: String(i + 1), text: c.front }));
  const backs = cards.map((c, i) => ({ label: String(i + 1), text: c.back }));
  cardSheet(doc, fronts, "front", true, flow.y + 6);
  cardSheet(doc, backs, "back", false);
  footers(doc, notebookName);
}

/* ── markdown-ish study aids ──────────────────────────────── */

function docPdf(doc: Doc, gen: Generation, notebookName: string): void {
  const md = (gen.payload as DocPayload).markdown;
  const flow = chrome(doc, gen.title, metaLineFor(gen), notebookName);
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flow.gap(6);
      continue;
    }
    if (/^###\s+/.test(line)) {
      wrapped(flow, line.replace(/^###\s+/, ""), { size: 11.5, style: "bold", gapAfter: 3 });
    } else if (/^##\s+/.test(line)) {
      heading(flow, line.replace(/^##\s+/, ""), 13.5);
    } else if (/^#\s+/.test(line)) {
      heading(flow, line.replace(/^#\s+/, ""), 16);
    } else if (/^\s*[-*•]\s+/.test(line)) {
      const bulletY = flow.y;
      wrapped(flow, line.replace(/^\s*[-*•]\s+/, ""), { indent: 16, gapAfter: 3 });
      doc.setDrawColor(BRASS[0], BRASS[1], BRASS[2]);
      doc.setLineWidth(2.4);
      doc.line(M + 4, bulletY + 7, M + 4, bulletY + 11);
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      wrapped(flow, line.trim(), { indent: 10, gapAfter: 3 });
    } else {
      wrapped(flow, stripMd(line), { gapAfter: 4 });
    }
  }
  footers(doc, notebookName);
}

/* ── entry ────────────────────────────────────────────────── */

export async function savePdf(gen: Generation, notebookName: string, base: string): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  switch (gen.kind) {
    case "quiz":
    case "exam":
      quizExamPdf(doc, gen, notebookName);
      break;
    case "flashcards":
      flashcardsPdf(doc, gen, notebookName);
      break;
    default:
      docPdf(doc, gen, notebookName);
  }
  doc.save(`${base}.pdf`);
}
