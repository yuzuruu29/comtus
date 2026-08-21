import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionHead from "./SectionHead";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    n: "i",
    title: "Gather your stack",
    line: "The same PDFs, DOCX files, slides, and notes you fed NotebookLM — or a JSON export from a NotebookLM backup extension.",
  },
  {
    n: "ii",
    title: "Drop them into Comtus",
    line: "Parsed, chunked, and indexed on your own device. Nothing uploads anywhere; the key and the corpus both stay home.",
  },
  {
    n: "iii",
    title: "Ask, drill, grade",
    line: "The whole studio opens on top of your stack — grounded chat, mock exams, essay grading, flashcards.",
  },
];

/** 03 — YOUR STACK · the NotebookLM bridge, with a thread drawn on scroll. */
export default function BringStack() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const path = rootRef.current?.querySelector<SVGPathElement>(".stack-thread");
      if (path && !reduced) {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(path, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 65%",
            end: "bottom 75%",
            scrub: 0.6,
          },
        });
      }
      const targets = gsap.utils.toArray<HTMLElement>(".reveal");
      if (reduced) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }
      targets.forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 36 },
          {
            opacity: 1,
            y: 0,
            duration: 0.85,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          },
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id="stack"
      className="relative border-y border-white/[0.06] bg-study/25 py-[clamp(5.5rem,12vh,9rem)]"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="reveal">
          <SectionHead
            index="03"
            label="Your Stack"
            title={
              <>
                Already living in{" "}
                <em className="font-[420] text-lamp">NotebookLM?</em>
              </>
            }
            sub="Bring the whole stack over. Comtus reads what NotebookLM reads — and keeps it on your machine."
          />
        </div>

        <div className="relative mt-16">
          {/* Thread connecting the steps (desktop) */}
          <svg
            className="pointer-events-none absolute inset-x-0 top-7 hidden h-2 w-full lg:block"
            viewBox="0 0 1000 8"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              className="stack-thread"
              d="M 60 4 C 250 -4, 380 12, 500 4 S 780 -4, 940 4"
              fill="none"
              stroke="url(#threadGrad)"
              strokeWidth="1.5"
            />
            <defs>
              <linearGradient id="threadGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#C99236" stopOpacity="0.15" />
                <stop offset="0.5" stopColor="#E3B04B" stopOpacity="0.7" />
                <stop offset="1" stopColor="#F0CE8C" stopOpacity="0.15" />
              </linearGradient>
            </defs>
          </svg>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="reveal relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-brass/30 bg-night font-display text-lg font-[450] italic text-brasspale shadow-[0_0_30px_rgba(227,176,75,0.12)]">
                  {s.n}
                </div>
                <h3 className="mt-6 font-display text-[1.45rem] font-[430] text-parchment">
                  {s.title}
                </h3>
                <p className="mt-2.5 max-w-sm text-[14px] leading-relaxed text-faded">
                  {s.line}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/[0.06] pt-8">
          <span className="label-mono !tracking-[0.24em] opacity-70">Reads</span>
          {["PDF", "DOCX", "TXT", "Markdown", "Slides → text", "NotebookLM JSON", "Web pages", "Paste"].map(
            (f) => (
              <span
                key={f}
                className="font-mono text-[11px] tracking-wide text-parchment/70"
              >
                {f}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
