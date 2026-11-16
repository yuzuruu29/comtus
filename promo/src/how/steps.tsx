import React from "react";
import { useCurrentFrame } from "remotion";
import { day, easeInOut, font } from "./theme";
import { DayDesk } from "./backdrop";
import { Guide, Icon, Rise, SOURCES, Sheet, SheetBar, SourceRow, StepHeader, mix, move, pop, prog, typed } from "./kit";

/* ------------------------------------------------------------------ */
/* 01  The pile, then the notebook it pours into.                      */
/* ------------------------------------------------------------------ */

const PILE = [
  { x: 1000, y: 230, r: -7, fromX: 1500, fromY: -500 },
  { x: 1270, y: 330, r: 5, fromX: 2400, fromY: 100 },
  { x: 1030, y: 445, r: 3, fromX: 1200, fromY: 1500 },
  { x: 1310, y: 560, r: -6, fromX: 2400, fromY: 700 },
  { x: 980, y: 660, r: 8, fromX: 700, fromY: 1500 },
  { x: 1250, y: 770, r: -3, fromX: 1900, fromY: 1500 },
];

const NB = { x: 900, y: 150, w: 870, h: 700 };
const ROW = { x: NB.x + 28, y: NB.y + 132, w: NB.w - 56, h: 70, gap: 82 };
export const PILE_TO_LIST = 150;

export const AddScene: React.FC = () => {
  const f = useCurrentFrame();
  const hookOut = move(f, 108, 18);
  const nb = prog(f, 126, 26);
  const landed = PILE.filter((_, i) => f >= PILE_TO_LIST + i * 9 + 26).length;

  return (
    <DayDesk>
      {/* The hook: the moment before you open Comtus. */}
      <div style={{ position: "absolute", left: 150, top: 250, opacity: 1 - hookOut, transform: `translateY(${-50 * hookOut}px)` }}>
        <Rise at={2} dy={40} dur={22}>
          <div style={{ fontFamily: font.mono, fontSize: 30, color: day.rust, fontWeight: 500, marginBottom: 26 }}>Monday, 9:41 PM</div>
        </Rise>
        <Rise at={6} dy={50} dur={24}>
          <h1 style={{ margin: 0, fontFamily: font.read, fontWeight: 640, fontSize: 150, lineHeight: 0.98, letterSpacing: "-0.035em", color: day.ink }}>
            Exam on<br />Friday.
          </h1>
        </Rise>
        <Rise at={58} dy={30}>
          <p style={{ margin: "34px 0 0", fontFamily: font.read, fontStyle: "italic", fontSize: 64, color: day.muted, letterSpacing: "-0.01em" }}>
            Where do you even start?
          </p>
        </Rise>
      </div>

      <StepHeader
        at={124}
        n="01"
        title={<>Drop it<br />all in.</>}
        caption="PDFs, Word docs, web pages, typed notes, even photos of handwritten pages."
      />

      {/* The notebook that receives the pile. */}
      <Sheet style={{ left: NB.x, top: NB.y, width: NB.w, height: NB.h, opacity: nb, transform: `translateY(${(1 - nb) * 60}px) scale(${0.96 + 0.04 * nb})` }}>
        <SheetBar
          title="Biology 101"
          right={<span style={{ fontFamily: font.mono, fontSize: 22, color: landed ? day.brass : day.muted }}>{landed} sources</span>}
        />
        <div style={{ padding: "24px 28px 0", fontFamily: font.ui, fontWeight: 600, fontSize: 21, color: day.muted }}>Sources</div>
        <div
          style={{
            position: "absolute",
            left: 28,
            right: 28,
            bottom: 30,
            height: 60,
            borderRadius: 14,
            border: `2px dashed ${day.hairlineStrong}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font.ui,
            fontSize: 22,
            color: day.muted,
            opacity: prog(f, 220, 20),
          }}
        >
          Drop more anytime
        </div>
      </Sheet>

      {/* Each file: tumbles into the pile, then files itself as a row. */}
      {PILE.map((p, i) => {
        const inT = pop(f, 12 + i * 7, 22);
        const fly = move(f, PILE_TO_LIST + i * 9, 26);
        const pileX = mix(p.fromX, p.x, inT);
        const pileY = mix(p.fromY, p.y, inT);
        const pileR = mix(p.r * 4, p.r, Math.min(1, inT));
        const x = mix(pileX, ROW.x, fly);
        const y = mix(pileY, ROW.y + i * ROW.gap, fly);
        const w = mix(470, ROW.w, fly);
        const h = mix(86, ROW.h, fly);
        const r = mix(pileR, 0, fly);
        const ready = prog(f, PILE_TO_LIST + i * 9 + 30, 14);
        if (f < 12 + i * 7) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: h,
              transform: `rotate(${r}deg)`,
              background: day.surface,
              borderRadius: 14,
              border: `1px solid ${day.hairlineStrong}`,
              boxShadow: fly < 1 ? day.lift : "none",
            }}
          >
            <SourceRow s={SOURCES[i]} ready={ready} />
          </div>
        );
      })}

      <Guide at={66} mood={f < 170 ? "think" : "read"} since={f < 170 ? 66 : 170} />
    </DayDesk>
  );
};

/* ------------------------------------------------------------------ */
/* 02  A question, visible thinking, an answer that shows its page.    */
/* ------------------------------------------------------------------ */

const QUESTION = "Why does water rush into a cell?";
const ANSWER =
  "A cell holds more dissolved salts and sugars than the water around it. Water moves toward the side with more dissolved stuff, so it flows in.";

export const AskScene: React.FC = () => {
  const f = useCurrentFrame();
  const chat = prog(f, 4, 24);
  const q = typed(QUESTION, f, 18, 1.3);
  const typing = q.length < QUESTION.length;
  const think = prog(f, 46, 12) * (1 - prog(f, 92, 10, easeInOut));
  const thought = prog(f, 96, 12);
  const words = ANSWER.split(" ");
  const cite = pop(f, 100 + words.length * 1.8 + 4, 16);
  const ring = prog(f, 156, 22);
  const source = prog(f, 160, 26);
  const hl = prog(f, 184, 24, easeInOut);

  return (
    <DayDesk>
      <StepHeader at={6} n="02" title={<>Ask<br />anything.</>} caption="Every answer comes from your own notes, with the page it came from." />

      <Sheet style={{ left: 880, top: 120, width: 900, height: 590, opacity: chat, transform: `translateY(${(1 - chat) * 50}px)` }}>
        <SheetBar title="Biology 101" right={<span style={{ fontFamily: font.ui, fontSize: 22, color: day.muted }}>Chat</span>} />

        {/* Your question. */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "30px 32px 0" }}>
          <div
            style={{
              opacity: f >= 14 ? 1 : 0,
              background: day.raised,
              borderRadius: "22px 22px 6px 22px",
              padding: "18px 26px",
              fontFamily: font.ui,
              fontSize: 31,
              color: day.ink,
              minHeight: 74,
            }}
          >
            {q}
            {typing && <span style={{ display: "inline-block", width: 3, height: 32, marginLeft: 3, verticalAlign: -5, background: day.brass, opacity: Math.floor(f / 8) % 2 ? 0.2 : 1 }} />}
          </div>
        </div>

        {/* Thinking: the reasoning is shown, not hidden behind a spinner. */}
        <div style={{ position: "relative", height: 112, margin: "18px 32px 0" }}>
          <div style={{ position: "absolute", inset: 0, opacity: think }}>
            <div
              style={{
                fontFamily: font.ui,
                fontWeight: 600,
                fontSize: 26,
                backgroundImage: `linear-gradient(90deg, ${day.moon} 0%, ${day.moon} 35%, ${day.brassPale} 50%, ${day.moon} 65%, ${day.moon} 100%)`,
                backgroundSize: "300% 100%",
                backgroundPosition: `${100 - ((f * 2.4) % 100)}% 0`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Thinking…
            </div>
            {["Reading Lecture 7, page 12", "Checking Textbook ch. 4"].map((line, i) => (
              <div key={line} style={{ marginTop: 8, fontFamily: font.mono, fontSize: 21, color: day.moon, opacity: prog(f, 54 + i * 12, 12) }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: thought, fontFamily: font.ui, fontSize: 22, color: day.moon }}>Thought for 3 seconds</div>
        </div>

        {/* The answer inks in, then cites its page. */}
        <div style={{ margin: "-62px 32px 0", opacity: thought }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: font.ui, fontWeight: 600, fontSize: 23, color: day.ink, marginBottom: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: day.brass }} /> Comtus
          </div>
          <p style={{ margin: 0, fontFamily: font.read, fontSize: 33, lineHeight: 1.45, color: day.ink }}>
            {words.map((w, i) => (
              <span key={i} style={{ opacity: prog(f, 100 + i * 1.8, 8) }}>
                {w}{" "}
              </span>
            ))}
            <sup
              style={{
                position: "relative",
                display: "inline-block",
                fontFamily: font.ui,
                fontWeight: 700,
                fontSize: 22,
                color: day.brass,
                transform: `scale(${cite})`,
                marginLeft: -4,
              }}
            >
              1
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 46,
                  height: 46,
                  marginLeft: -23,
                  marginTop: -23,
                  borderRadius: 23,
                  border: `2.5px solid ${day.brass}`,
                  opacity: ring > 0 && ring < 1 ? 1 - ring : 0,
                  transform: `scale(${0.4 + ring * 1.4})`,
                }}
              />
            </sup>
          </p>
        </div>
      </Sheet>

      {/* The page the answer came from, lifted onto the desk. */}
      <Sheet lifted style={{ left: 1110, top: 610, width: 690, height: 262, opacity: source, transform: `translateY(${(1 - source) * 90}px) rotate(${(1 - source) * 3 - 1}deg)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "26px 30px 0" }}>
          <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 18, padding: "5px 11px", borderRadius: 7, background: day.rust, color: day.ground }}>PDF</span>
          <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 25, color: day.ink }}>Lecture 7.pdf</span>
          <span style={{ marginLeft: "auto", fontFamily: font.mono, fontSize: 21, color: day.brass }}>
            <sup style={{ fontFamily: font.ui, fontWeight: 700 }}>1</sup> page 12
          </span>
        </div>
        <p style={{ margin: "22px 30px 0", fontFamily: font.read, fontSize: 27, lineHeight: 1.55, color: day.muted }}>
          Osmosis is the movement of water across a membrane.{" "}
          <span
            style={{
              color: day.ink,
              backgroundImage: `linear-gradient(${day.brassPale}66, ${day.brassPale}66)`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${hl * 100}% 100%`,
            }}
          >
            Water moves toward the side with the higher concentration of dissolved solute.
          </span>
        </p>
      </Sheet>

      <Guide mood={f < 46 ? "idle" : f < 150 ? "think" : "nod"} since={f < 46 ? 0 : f < 150 ? 46 : 150} />
    </DayDesk>
  );
};

/* ------------------------------------------------------------------ */
/* 03  Quiz, flashcards, a mock exam. Misses turn into cards.          */
/* ------------------------------------------------------------------ */

const OPTIONS = ["It shrinks", "Nothing changes", "It swells and can burst", "It loses water"];
const WRONG = 1;
const RIGHT = 2;

export const PracticeScene: React.FC = () => {
  const f = useCurrentFrame();
  const quiz = prog(f, 4, 24);
  const deck = prog(f, 12, 24);
  const exam = prog(f, 22, 24);
  const picked = f >= 40;
  const reveal = prog(f, 56, 14);
  const flip = move(f, 26, 22);
  const send = move(f, 104, 30);
  const arrived = f >= 134;
  const swap = prog(f, 134, 14);
  const ring = prog(f, 126, 46);
  const secs = 45 * 60 - Math.floor(f / 30);
  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <DayDesk>
      <StepHeader at={6} n="03" title={<>Quiz<br />yourself.</>} caption="Flashcards, quizzes and timed mock exams, made from your notes." />

      {/* Quiz */}
      <Sheet style={{ left: 880, top: 120, width: 570, height: 540, opacity: quiz, transform: `translateY(${(1 - quiz) * 50}px)` }}>
        <SheetBar title="Quiz" right={<span style={{ fontFamily: font.mono, fontSize: 22, color: day.muted }}>4 / 10</span>} />
        <p style={{ margin: "26px 30px 22px", fontFamily: font.read, fontSize: 30, lineHeight: 1.3, color: day.ink }}>What happens to a red blood cell in pure water?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 30px" }}>
          {OPTIONS.map((o, i) => {
            const wrong = i === WRONG && picked;
            const right = i === RIGHT && reveal > 0;
            const tone = wrong ? day.rust : right ? day.sage : null;
            return (
              <div
                key={o}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  height: 58,
                  padding: "0 18px",
                  borderRadius: 14,
                  border: `2px solid ${tone ?? day.hairlineStrong}`,
                  background: tone ? `${tone}14` : day.surface,
                  fontFamily: font.ui,
                  fontSize: 25,
                  color: day.ink,
                  transform: wrong ? `translateX(${Math.sin((f - 40) * 1.6) * 6 * (1 - prog(f, 40, 14))}px)` : undefined,
                }}
              >
                <span style={{ fontFamily: font.mono, fontSize: 20, color: tone ?? day.muted, width: 22 }}>{"ABCD"[i]}</span>
                <span style={{ flex: 1 }}>{o}</span>
                {wrong && <Icon name="x" size={26} color={day.rust} weight={2.6} draw={prog(f, 40, 10)} />}
                {right && <Icon name="check" size={28} color={day.sage} weight={2.8} draw={reveal} />}
              </div>
            );
          })}
        </div>
        <div style={{ margin: "16px 30px 0", fontFamily: font.ui, fontSize: 22, color: day.sage, opacity: prog(f, 66, 14) }}>
          Water rushes in, so the cell swells.
        </div>
      </Sheet>

      {/* Flashcard deck */}
      <div style={{ position: "absolute", left: 1490, top: 120, width: 310, height: 330, perspective: 1400, opacity: deck, transform: `translateY(${(1 - deck) * 50}px)` }}>
        {[2, 1].map((k) => (
          <div key={k} style={{ position: "absolute", inset: 0, transform: `translate(${k * 7}px, ${k * 7}px)`, borderRadius: 20, background: day.surface, border: `1px solid ${day.hairlineStrong}` }} />
        ))}
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateY(${arrived ? 0 : flip * 180}deg)` }}>
          {[0, 1].map((side) => (
            <div
              key={side}
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden",
                transform: side ? "rotateY(180deg)" : undefined,
                borderRadius: 20,
                background: day.surface,
                border: `1px solid ${day.hairlineStrong}`,
                boxShadow: day.elev,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 28,
                textAlign: "center",
              }}
            >
              <div style={{ position: "absolute", top: 20, fontFamily: font.mono, fontSize: 19, color: day.muted }}>{arrived ? "Card 25" : "Card 12"}</div>
              {side === 0 && !arrived && <div style={{ fontFamily: font.read, fontWeight: 560, fontSize: 46, color: day.ink }}>Osmosis</div>}
              {side === 0 && arrived && (
                <div style={{ opacity: swap }}>
                  <div style={{ display: "inline-block", marginBottom: 14, fontFamily: font.ui, fontWeight: 600, fontSize: 18, padding: "4px 12px", borderRadius: 8, background: day.brass, color: day.ground }}>New</div>
                  <div style={{ fontFamily: font.read, fontSize: 30, lineHeight: 1.25, color: day.ink }}>A red blood cell in pure water?</div>
                </div>
              )}
              {side === 1 && <div style={{ fontFamily: font.ui, fontSize: 27, lineHeight: 1.35, color: day.ink }}>Water moving toward more dissolved solute.</div>}
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", top: 352, left: 0, right: 0, textAlign: "center", fontFamily: font.ui, fontSize: 21, color: day.brass, fontWeight: 600, opacity: prog(f, 136, 14) }}>
          Missed it? It’s a card now.
        </div>
      </div>

      {/* The missed question, folding itself into the deck. */}
      {f >= 104 && !arrived && (
        <div
          style={{
            position: "absolute",
            left: mix(910, 1520, send),
            top: mix(318, 200, send) - Math.sin(send * Math.PI) * 120,
            width: mix(510, 250, send),
            height: mix(58, 170, send),
            borderRadius: 14,
            background: day.surface,
            border: `2px solid ${day.rust}`,
            boxShadow: day.lift,
            transform: `rotate(${Math.sin(send * Math.PI) * -8}deg)`,
            opacity: 1 - prog(f, 128, 6),
          }}
        />
      )}

      {/* Mock exam and where you stand */}
      <Sheet style={{ left: 880, top: 700, width: 920, height: 250, opacity: exam, transform: `translateY(${(1 - exam) * 50}px)` }}>
        <div style={{ position: "absolute", left: 34, top: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: font.ui, fontWeight: 600, fontSize: 25, color: day.ink }}>
            <Icon name="clock" size={28} color={day.brass} weight={2} /> Mock exam
          </div>
          <div style={{ marginTop: 12, fontFamily: font.mono, fontWeight: 500, fontSize: 64, color: day.ink, letterSpacing: "-0.02em" }}>{timer}</div>
          <div style={{ fontFamily: font.ui, fontSize: 21, color: day.muted }}>Timed, like the real thing</div>
        </div>
        <svg width={170} height={170} viewBox="0 0 170 170" style={{ position: "absolute", left: 330, top: 40 }}>
          <circle cx={85} cy={85} r={70} fill="none" stroke={day.raised} strokeWidth={14} />
          <circle
            cx={85}
            cy={85}
            r={70}
            fill="none"
            stroke={day.sage}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 70}
            strokeDashoffset={2 * Math.PI * 70 * (1 - 0.8 * ring)}
            transform="rotate(-90 85 85)"
          />
          <text x={85} y={96} textAnchor="middle" style={{ fontFamily: font.mono, fontWeight: 500, fontSize: 36, fill: day.ink }}>
            {Math.round(8 * ring)}/10
          </text>
        </svg>
        <div style={{ position: "absolute", left: 550, top: 38, width: 336 }}>
          <div style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 22, color: day.muted, marginBottom: 14 }}>Where you stand</div>
          {[
            { topic: "Osmosis", v: 0.9, c: day.sage },
            { topic: "Tonicity", v: 0.5, c: day.candle, chip: "Review today" },
          ].map((row, i) => (
            <div key={row.topic} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.ui, fontSize: 23, color: day.ink, marginBottom: 7 }}>
                {row.topic}
                {row.chip && (
                  <span style={{ fontSize: 17, fontWeight: 600, padding: "3px 10px", borderRadius: 7, background: day.candle, color: day.leather, opacity: prog(f, 172, 12) }}>{row.chip}</span>
                )}
              </div>
              <div style={{ height: 10, borderRadius: 5, background: day.raised }}>
                <div style={{ height: 10, borderRadius: 5, background: row.c, width: `${row.v * 100 * prog(f, 134 + i * 10, 30)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Sheet>

      <Guide mood={f < 40 ? "idle" : f < 160 ? "poke" : "cheer"} since={f < 40 ? 0 : f < 160 ? 40 : 160} />
    </DayDesk>
  );
};

/* ------------------------------------------------------------------ */
/* 04  An exam date becomes a short plan for each day.                 */
/* ------------------------------------------------------------------ */

const DAYS: { d: string; tasks: string[] }[] = [
  { d: "Mon", tasks: ["20 cards", "Read ch. 4"] },
  { d: "Tue", tasks: ["Quiz", "15 cards"] },
  { d: "Wed", tasks: ["Mock exam"] },
  { d: "Thu", tasks: ["Weak topics", "10 cards"] },
  { d: "Fri", tasks: ["Exam"] },
];

export const PlanScene: React.FC = () => {
  const f = useCurrentFrame();
  const sheet = prog(f, 4, 24);
  const line = prog(f, 64, 50, easeInOut);
  return (
    <DayDesk>
      <StepHeader at={6} n="04" title={<>Ready by<br />exam day.</>} caption="Set your exam date. Comtus spreads your reviews so they all land before it." />

      <Sheet style={{ left: 880, top: 220, width: 920, height: 470, opacity: sheet, transform: `translateY(${(1 - sheet) * 50}px)` }}>
        <SheetBar title="Exam plan" right={<span style={{ fontFamily: font.mono, fontSize: 22, color: day.brass }}>4 days to go</span>} />
        <div style={{ position: "absolute", left: 30, right: 30, top: 104, display: "flex", gap: 16 }}>
          {DAYS.map((col, i) => {
            const exam = i === DAYS.length - 1;
            const done = !exam && f >= 70 + i * 10;
            const glow = exam ? prog(f, 108, 16) : 0;
            return (
              <div
                key={col.d}
                style={{
                  flex: 1,
                  height: 236,
                  borderRadius: 18,
                  padding: "18px 14px",
                  border: `1.5px solid ${exam ? day.candle : day.hairlineStrong}`,
                  background: exam ? `rgba(239,131,40,${0.06 + glow * 0.1})` : day.surface,
                  boxShadow: exam ? `0 0 ${40 * glow}px rgba(239,131,40,${0.35 * glow})` : "none",
                  opacity: Math.min(1, pop(f, 14 + i * 6, 18)),
                  transform: `translateY(${(1 - Math.min(1, pop(f, 14 + i * 6, 18))) * 30}px)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <span style={{ fontFamily: font.read, fontWeight: 560, fontSize: 38, color: day.ink }}>{col.d}</span>
                  {done && <Icon name="check" size={30} color={day.sage} weight={2.8} draw={prog(f, 70 + i * 10, 10)} />}
                  {exam && <Icon name="flag" size={28} color={day.candle} weight={2.2} />}
                </div>
                {col.tasks.map((t, j) => (
                  <div
                    key={t}
                    style={{
                      marginBottom: 10,
                      padding: "9px 12px",
                      borderRadius: 10,
                      fontFamily: font.ui,
                      fontWeight: exam ? 600 : 500,
                      fontSize: 20,
                      background: exam ? day.candle : day.raised,
                      color: exam ? day.leather : done ? day.muted : day.ink,
                      textDecoration: done ? "line-through" : "none",
                      textDecorationColor: day.hairlineStrong,
                      opacity: prog(f, 26 + i * 6 + j * 5, 12),
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 30, right: 30, bottom: 76, height: 6, borderRadius: 3, background: day.raised }}>
          <div style={{ height: 6, borderRadius: 3, background: day.sage, width: `${line * 80}%` }} />
        </div>
        <div style={{ position: "absolute", left: 30, bottom: 26, display: "flex", alignItems: "center", gap: 10, fontFamily: font.ui, fontSize: 23, color: day.sage, opacity: prog(f, 112, 14) }}>
          <Icon name="check" size={24} color={day.sage} weight={2.6} /> Every review lands before Friday.
        </div>
      </Sheet>

      <Guide mood={f < 100 ? "read" : "cheer"} since={f < 100 ? 0 : 100} />
    </DayDesk>
  );
};
