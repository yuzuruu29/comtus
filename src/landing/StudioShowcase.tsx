import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionHead from "./SectionHead";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    tag: "Mock exams",
    title: "The full dress rehearsal.",
    line: "100–150 items, timed, shaded scoring, and a rationale behind every key — modeled on the real thing.",
  },
  {
    tag: "Quiz drills",
    title: "Small sets, instant why.",
    line: "Ten questions on today's weak spot, each answered with the reasoning the moment you commit.",
  },
  {
    tag: "Essay coach",
    title: "A second reader, always awake.",
    line: "Prompts from your own sources, outlines before drafts, rubric scores with visible judgment.",
  },
  {
    tag: "Study aids",
    title: "The desk, pre-set.",
    line: "Study guides, briefs, FAQs, timelines, and flashcards generated from the same sources — one click each.",
  },
];

/** 03 — THE STUDIO · editorial split: sticky manifesto left, feature
 *  cascade + a CSS-built glimpse of the workspace right. */
export default function StudioShowcase() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal");
      if (reduced) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }
      targets.forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 87%", once: true },
          },
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id="studio"
      data-torch
      className="relative mx-auto w-full max-w-6xl px-6 py-[clamp(6rem,14vh,10rem)]"
    >
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <div className="reveal">
              <SectionHead
                index="03"
                label="The Studio"
                title={
                  <>
                    One notebook.{" "}
                    <em className="font-[420] text-lamp">Every</em> kind of
                    practice.
                  </>
                }
                sub="Read on the left, think in the middle, practice on the right. The workspace keeps your sources, your questions, and your generated drills in one warm room."
              />
            </div>
            <div className="reveal mt-9">
              <Link
                to="/studio"
                className="group ghost-tint inline-flex items-center gap-2.5 rounded-full border border-brass/30 bg-brass/[0.06] px-6 py-3 text-[13.5px] font-medium text-brasspale transition-colors duration-300 hover:bg-brass/[0.12]"
              >
                <span className="roll">
                  <span>Try it with your own sources</span>
                  <span aria-hidden>Try it with your own sources</span>
                </span>
                <span className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5">
          {/* Visual preview of the midnight lamplight study */}
          <div className="reveal group relative overflow-hidden rounded-[1.9rem] border border-white/[0.08] bg-study/40 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[1.5rem]">
              <img
                src="/images/studio-workspace.jpg"
                alt="Comtus midnight lamplight study workspace"
                className="h-full w-full object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/90 via-night/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-night/70 px-3.5 py-1.5 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass" />
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-parchment/90">
                    The Midnight Desk
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faded/80">
                  Grounded · Private · Focused
                </span>
              </div>
            </div>
          </div>

          {/* Glimpse of the workspace, built in CSS */}
          <div className="reveal rounded-[1.9rem] border border-white/[0.07] bg-white/[0.035] p-1.5">
            <div className="overflow-hidden rounded-[1.55rem] bg-night shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
                <span className="h-2 w-2 rounded-full bg-rust/70" />
                <span className="h-2 w-2 rounded-full bg-brass/70" />
                <span className="h-2 w-2 rounded-full bg-sage/70" />
                <span className="ml-3 font-mono text-[10px] tracking-[0.18em] text-faded">
                  COMTUS — NURSING SEM 1
                </span>
              </div>
              <div className="grid grid-cols-3 gap-px bg-white/[0.05]">
                <div className="min-h-[190px] bg-study/80 p-4">
                  <div className="label-mono !text-[9px]">Sources</div>
                  <div className="mt-3 space-y-2.5">
                    {["w-10/12", "w-8/12", "w-11/12", "w-7/12"].map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-[4px] bg-brass/25" />
                        <div className={`h-1.5 ${w} rounded bg-white/15`} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="min-h-[190px] bg-study/60 p-4">
                  <div className="label-mono !text-[9px]">Chat</div>
                  <div className="mt-3 space-y-2.5">
                    <div className="ml-auto h-1.5 w-9/12 rounded bg-white/20" />
                    <div className="rounded-lg border border-moon/15 bg-moon/[0.06] p-2.5">
                      <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-moon/80">
                        thinking
                      </div>
                      <div className="mt-1.5 h-1 w-10/12 rounded bg-moon/25" />
                    </div>
                    <div className="h-1.5 w-11/12 rounded bg-white/12" />
                    <div className="h-1.5 w-7/12 rounded bg-white/10" />
                    <div className="flex gap-1.5">
                      {["p. 12", "p. 30"].map((c) => (
                        <span
                          key={c}
                          className="rounded-full border border-brass/25 bg-brass/[0.08] px-2 py-0.5 font-mono text-[8px] text-brasspale"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="min-h-[190px] bg-study/80 p-4">
                  <div className="label-mono !text-[9px]">Studio</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {["Quiz", "Exam", "Essay", "Cards"].map((t) => (
                      <div
                        key={t}
                        className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-3 text-center font-mono text-[9px] tracking-[0.14em] text-faded"
                      >
                        {t.toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.tag}
                className="reveal group rounded-[1.4rem] border border-white/[0.06] bg-white/[0.02] p-6 transition-colors duration-500 hover:border-brass/25 hover:bg-brass/[0.03]"
              >
                <div className="label-mono !text-[10px] text-brass/80">{f.tag}</div>
                <h3 className="mt-3 font-display text-[1.25rem] font-[430] text-parchment">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-faded">{f.line}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
