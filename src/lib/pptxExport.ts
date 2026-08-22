import PptxGenJS from "pptxgenjs";
import type { Generation } from "./types";
import type {
  QuizPayload,
  ExamPayload,
  FlashcardsPayload,
  PresentationPayload,
} from "./types";
import { answerText } from "./exportDocs";

/* Deck styling follows the Comtus brand: night ground, parchment ink,
 * brass accents. Titles use a serif (Georgia) to echo Fraunces on screen;
 * everything else stays Inter-adjacent via the default sans. */

const NIGHT = "0B0F1A";
const STUDY = "111827";
const PARCHMENT = "F3EAD8";
const FADED = "9BA3B5";
const BRASS = "E3B04B";

type Slide = PptxGenJS.Slide;

function baseSlide(pptx: PptxGenJS, opts: { study?: boolean } = {}): Slide {
  const s = pptx.addSlide();
  s.background = { color: opts.study ? STUDY : NIGHT };
  // brass hairline along the top edge — the Comtus thread
  s.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.035,
    fill: { color: BRASS },
    line: { type: "none" },
  });
  return s;
}

function titleSlide(pptx: PptxGenJS, title: string, sub: string[]): void {
  const s = baseSlide(pptx);
  s.addText(title, {
    x: 0.6,
    y: 1.7,
    w: 8.8,
    h: 1.4,
    align: "center",
    fontFace: "Georgia",
    fontSize: title.length > 60 ? 26 : 34,
    color: PARCHMENT,
    bold: false,
  });
  if (sub.length) {
    s.addText(sub.join("   ·   "), {
      x: 0.6,
      y: 3.15,
      w: 8.8,
      h: 0.5,
      align: "center",
      fontFace: "Arial",
      fontSize: 12,
      color: FADED,
      charSpacing: 2,
    });
  }
  s.addText("COMTUS", {
    x: 0.6,
    y: 4.95,
    w: 8.8,
    h: 0.35,
    align: "center",
    fontFace: "Arial",
    fontSize: 10,
    color: BRASS,
    charSpacing: 6,
  });
}

function sectionTag(s: Slide, text: string): void {
  s.addText(text.toUpperCase(), {
    x: 0.55,
    y: 0.22,
    w: 8.9,
    h: 0.32,
    fontFace: "Arial",
    fontSize: 10,
    color: BRASS,
    charSpacing: 3,
  });
}

function pageFoot(s: Slide, n: number): void {
  s.addText(`${n}`, {
    x: 9.1,
    y: 5.18,
    w: 0.5,
    h: 0.3,
    align: "right",
    fontFace: "Arial",
    fontSize: 9,
    color: FADED,
  });
}

function quizExamPptx(pptx: PptxGenJS, gen: Generation): void {
  const payload = gen.payload as QuizPayload & ExamPayload;
  const questions = payload.questions;

  const sub: string[] =
    gen.kind === "exam" && payload.blueprint
      ? [`${payload.blueprint.totalItems} items`, `${payload.blueprint.minutes} minutes`]
      : [
          `${payload.config?.count ?? questions.length} items`,
          ...(payload.config?.difficulty ? [payload.config.difficulty] : []),
        ];
  titleSlide(pptx, gen.title, sub);

  questions.forEach((q, i) => {
    // Question slide
    const qs = baseSlide(pptx, { study: true });
    sectionTag(qs, `${gen.kind === "exam" ? "Mock exam" : "Quiz"} · Item ${i + 1} of ${questions.length}`);
    qs.addText(q.stem, {
      x: 0.55,
      y: 0.75,
      w: 8.9,
      h: 1.9,
      fontFace: "Georgia",
      fontSize: q.stem.length > 180 ? 16 : 20,
      color: PARCHMENT,
      valign: "top",
    });

    const opts = q.format === "truefalse" ? ["True", "False"] : q.options;
    if (q.format === "identification") {
      qs.addText("Your answer:", {
        x: 0.55,
        y: 3.1,
        w: 3,
        h: 0.4,
        fontFace: "Arial",
        fontSize: 13,
        color: FADED,
        italic: true,
      });
    } else {
      opts.forEach((opt, oi) => {
        const rowY = 2.85 + oi * 0.52;
        qs.addText(`${String.fromCharCode(65 + oi)}.  ${opt}`, {
          x: 0.85,
          y: rowY,
          w: 8.2,
          h: 0.45,
          fontFace: "Arial",
          fontSize: 14,
          color: PARCHMENT,
        });
      });
    }
    if (q.topic) {
      qs.addText(`Topic: ${q.topic}`, {
        x: 0.55,
        y: 5.05,
        w: 5,
        h: 0.3,
        fontFace: "Arial",
        fontSize: 9,
        color: FADED,
      });
    }
    pageFoot(qs, i * 2 + 2);

    // Answer slide
    const as = baseSlide(pptx);
    sectionTag(as, `Answer · Item ${i + 1}`);
    as.addText(q.stem, {
      x: 0.55,
      y: 0.62,
      w: 8.9,
      h: 0.95,
      fontFace: "Georgia",
      fontSize: 13,
      color: FADED,
      valign: "top",
    });
    as.addText(answerText(q), {
      x: 0.55,
      y: 1.85,
      w: 8.9,
      h: 1.1,
      fontFace: "Georgia",
      fontSize: 40,
      color: BRASS,
      align: "center",
    });
    if (q.rationale) {
      as.addText(q.rationale, {
        x: 1.0,
        y: 3.25,
        w: 8.0,
        h: 1.5,
        fontFace: "Arial",
        fontSize: 13,
        color: PARCHMENT,
        align: "center",
        valign: "top",
      });
    }
    pageFoot(as, i * 2 + 3);
  });
}

function flashcardsPptx(pptx: PptxGenJS, gen: Generation): void {
  const cards = (gen.payload as FlashcardsPayload).cards;
  titleSlide(pptx, gen.title, [`${cards.length} cards`, "Advance for each answer"]);

  cards.forEach((card, i) => {
    // Front slide — big centered prompt
    const fs = baseSlide(pptx);
    sectionTag(fs, `Card ${i + 1} of ${cards.length}`);
    fs.addText(card.front, {
      x: 0.8,
      y: 1.15,
      w: 8.4,
      h: 3.2,
      fontFace: "Georgia",
      fontSize: card.front.length > 160 ? 20 : 28,
      color: PARCHMENT,
      align: "center",
      valign: "middle",
    });
    if (card.topic) {
      fs.addText(card.topic, {
        x: 0.55,
        y: 5.05,
        w: 5,
        h: 0.3,
        fontFace: "Arial",
        fontSize: 9,
        color: FADED,
      });
    }
    pageFoot(fs, i * 2 + 2);

    // Answer slide — faint front above, brass back below
    const bs = baseSlide(pptx);
    sectionTag(bs, `Answer · Card ${i + 1}`);
    bs.addText(card.front, {
      x: 1.2,
      y: 0.72,
      w: 7.6,
      h: 1.0,
      fontFace: "Arial",
      fontSize: 13,
      color: FADED,
      align: "center",
      valign: "top",
    });
    bs.addShape(pptx.ShapeType.rect, {
      x: 3.7,
      y: 1.86,
      w: 2.6,
      h: 0.014,
      fill: { color: BRASS },
      line: { type: "none" },
    });
    bs.addText(card.back, {
      x: 0.8,
      y: 2.0,
      w: 8.4,
      h: 2.6,
      fontFace: "Georgia",
      fontSize: card.back.length > 140 ? 19 : 26,
      color: BRASS,
      align: "center",
      valign: "middle",
    });
    pageFoot(bs, i * 2 + 3);
  });
}

function presentationPptx(pptx: PptxGenJS, gen: Generation): void {
  const deck = gen.payload as PresentationPayload;
  titleSlide(
    pptx,
    deck.deckTitle || gen.title,
    [deck.deckSubtitle, `Comtus · ${deck.topic}`].filter(Boolean) as string[],
  );

  deck.slides.forEach((sl) => {
    const s = baseSlide(pptx, { study: true });
    sectionTag(s, `Slide ${sl.slideNumber}`);
    s.addText(sl.title, {
      x: 0.55,
      y: 0.68,
      w: 8.9,
      h: 0.85,
      fontFace: "Georgia",
      fontSize: 26,
      color: PARCHMENT,
      valign: "top",
    });
    if (sl.subtitle) {
      s.addText(sl.subtitle, {
        x: 0.55,
        y: 1.5,
        w: 8.9,
        h: 0.45,
        fontFace: "Arial",
        fontSize: 14,
        italic: true,
        color: BRASS,
      });
    }
    const startY = sl.subtitle ? 2.1 : 1.75;
    if (sl.bullets.length) {
      s.addText(
        sl.bullets.map((b) => ({ text: b, options: { bullet: { characterCode: "2022" }, breakLine: true } })),
        {
          x: 0.85,
          y: startY,
          w: 8.3,
          h: 4.9 - startY,
          fontFace: "Arial",
          fontSize: sl.bullets.length > 6 ? 13 : 15,
          color: PARCHMENT,
          valign: "top",
          paraSpaceAfter: 8,
        },
      );
    }
    if (sl.notes) s.addNotes(sl.notes);
    pageFoot(s, sl.slideNumber + 1);
  });
}

export async function savePptx(gen: Generation, notebookName: string, base: string): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Comtus";
  pptx.company = "Comtus";
  pptx.title = gen.title;
  pptx.subject = notebookName;

  switch (gen.kind) {
    case "quiz":
    case "exam":
      quizExamPptx(pptx, gen);
      break;
    case "flashcards":
      flashcardsPptx(pptx, gen);
      break;
    default:
      presentationPptx(pptx, gen);
  }

  await pptx.writeFile({ fileName: base });
}
