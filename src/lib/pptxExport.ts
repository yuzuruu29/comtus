import PptxGenJS from "pptxgenjs";
import { createAssessmentCapture } from "./assessmentExport";
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

async function quizExamPptx(pptx: PptxGenJS, gen: Generation): Promise<void> {
  const payload = gen.payload as QuizPayload & ExamPayload;
  const questions = payload.questions ?? [];
  titleSlide(pptx, gen.title, gen.kind === "exam" && payload.blueprint
    ? [`${payload.blueprint.totalItems} items`, `${payload.blueprint.minutes} minutes`]
    : [`${questions.length} items`, payload.config?.difficulty ?? ""]);
  const capture = createAssessmentCapture(true);
  let page = 1;
  try {
    for (const [i, q] of questions.entries()) {
      for (const answer of [false, true]) {
        let slide: Slide;
        let y = 0.72;
        let continuation = 0;
        const nextSlide = () => {
          slide = baseSlide(pptx, { study: true });
          sectionTag(slide, `${answer ? "Answer" : gen.kind === "exam" ? "Mock exam" : "Quiz"} · Item ${i + 1}${continuation ? " · continued" : ""}`);
          pageFoot(slide, ++page);
          slide.addNotes(answer ? `${q.stem}\nAnswer: ${q.answer}\n${q.rationale}`
            : [q.stem, ...q.options, q.graph ? JSON.stringify(q.graph) : ""].join("\n"));
          if (q.topic) slide.addText(q.topic, { x: 0.55, y: 5.08, w: 8, h: 0.25, fontSize: 9, color: FADED });
          y = 0.72;
          continuation++;
        };
        const addContent = async (content: string | NonNullable<typeof q.graph>) => {
          for (const image of await capture.render(content, 4.15 / 8.9)) {
            const height = image.height / image.width * 8.9;
            const scale = Math.min(1, 4.15 / height);
            const h = height * scale;
            if (y + h > 4.92) nextSlide();
            slide.addImage({ data: image.data, x: 0.55, y, w: 8.9 * scale, h });
            y += h + 0.08;
          }
        };
        nextSlide();
        if (answer) {
          const key = q.format === "mcq" ? `${answerText(q)}. ${q.options[q.answerIndex] ?? q.answer}` : q.answer || answerText(q);
          await addContent(`**Correct answer:** ${key}`);
          if (q.rationale) await addContent(q.rationale);
        } else {
          await addContent(q.stem);
          if (q.graph) await addContent(q.graph);
          if (q.format === "solution" || q.format === "identification") {
            await addContent(q.format === "solution" ? "Show your working on paper." : "Your answer: ____________________");
          } else {
            for (const [oi, option] of (q.format === "truefalse" ? ["True", "False"] : q.options).entries()) {
              await addContent(`**${String.fromCharCode(65 + oi)}.** ${option}`);
            }
          }
        }
      }
    }
  } finally {
    capture.close();
  }
}

function flashcardsPptx(pptx: PptxGenJS, gen: Generation): void {
  const cards = (gen.payload as FlashcardsPayload).cards ?? [];
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
  const slides = deck.slides ?? [];
  titleSlide(
    pptx,
    deck.deckTitle || gen.title,
    [deck.deckSubtitle, `Comtus · ${deck.topic}`].filter(Boolean) as string[],
  );

  slides.forEach((sl) => {
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
      await quizExamPptx(pptx, gen);
      break;
    case "flashcards":
      flashcardsPptx(pptx, gen);
      break;
    default:
      presentationPptx(pptx, gen);
  }

  const fileName = base.toLowerCase().endsWith(".pptx") ? base : `${base}.pptx`;
  await pptx.writeFile({ fileName });
}
