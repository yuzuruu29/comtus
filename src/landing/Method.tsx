import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionHead from "./SectionHead";
import TiltCard from "./TiltCard";

gsap.registerPlugin(ScrollTrigger);

/** 01 — THE METHOD · asymmetrical bento of the four thinking moves. */
export default function Method() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal");
      if (reduced) {
        gsap.set(targets, { opacity: 1, y: 0, filter: "none" });
        return;
      }
      targets.forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 44, filter: "blur(6px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.95,
            ease: "power3.out",
            delay: (i % 2) * 0.08,
            scrollTrigger: { trigger: el, start: "top 86%", once: true },
          },
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id="method"
      data-torch
      className="relative mx-auto w-full max-w-6xl px-6 py-[clamp(6rem,14vh,10rem)]"
    >
      <div className="reveal">
        <SectionHead
          index="01"
          label="The Method"
          title={
            <>
              Every answer{" "}
              <em className="font-[420] text-lamp">shows its work.</em>
            </>
          }
          sub="Four moves, one habit: Comtus never asks you to trust it — it lets you check it. Sources in, reasoning out, citations attached."
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="reveal lg:col-span-7">
          <TiltCard className="h-full flex flex-col justify-between">
            <div>
              <div className="label-mono !tracking-[0.24em] opacity-70">Grounded</div>
              <h3 className="mt-4 font-display text-[1.7rem] font-[420] leading-snug text-parchment">
                Grounded, or silent.
              </h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-faded">
                Every claim carries a chip back to the exact page, passage, or slide it
                came from. Where your sources are quiet, Comtus says so instead of
                improvising.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Rationale p. 12", "Lecture 3 · 14:02", "Handout §2.1"].map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-brass/25 bg-brass/[0.07] px-3 py-1 font-mono text-[10.5px] tracking-wide text-brasspale"
                  >
                    {c}
                  </span>
                ))}
                <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10.5px] tracking-wide text-faded">
                  not in sources → says so
                </span>
              </div>
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-night/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <img
                src="/images/grounded-notes.jpg"
                alt="Open academic manuscript with margin notes and brass pointer"
                className="h-44 w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                loading="lazy"
              />
            </div>
          </TiltCard>
        </div>

        <div className="reveal lg:col-span-5">
          <TiltCard className="h-full">
            <div className="label-mono !tracking-[0.24em] text-moon opacity-90">
              Reasoning
            </div>
            <h3 className="mt-4 font-display text-[1.7rem] font-[420] leading-snug text-parchment">
              Reasoning you can watch.
            </h3>
            <p className="mt-3 text-[14.5px] leading-relaxed text-faded">
              Hard questions get a visible thinking pass — moonlit, collapsible,
              honest. You see the plan before the answer, like a worked solution on
              a chalkboard.
            </p>
            <div className="mt-7 rounded-xl border border-moon/15 bg-moon/[0.05] p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-moon/80">
                thinking
              </div>
              <div className="mt-2.5 space-y-2">
                <div className="h-1.5 w-11/12 rounded bg-moon/25" />
                <div className="h-1.5 w-4/5 rounded bg-moon/20" />
                <div className="h-1.5 w-3/5 rounded bg-moon/15" />
              </div>
            </div>
          </TiltCard>
        </div>

        <div className="reveal lg:col-span-5">
          <TiltCard className="h-full">
            <div className="label-mono !tracking-[0.24em] opacity-70">Generation</div>
            <h3 className="mt-4 font-display text-[1.7rem] font-[420] leading-snug text-parchment">
              Practice with a blueprint.
            </h3>
            <p className="mt-3 text-[14.5px] leading-relaxed text-faded">
              Quizzes and exams aren't random — you set the topics, item counts, and
              formats, then Comtus builds to spec and defends every answer with a
              rationale.
            </p>
            <div className="mt-7 space-y-2.5">
              {[
                ["Cardiovascular", 30],
                ["Respiratory", 22],
                ["Fluid & Electrolytes", 18],
              ].map(([topic, n]) => (
                <div key={topic as string} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 font-mono text-[10.5px] text-faded">
                    {topic}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded bg-white/[0.06]">
                    <div
                      className="h-full grad-lamp opacity-80"
                      style={{ width: `${((n as number) / 30) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10.5px] text-brasspale">{n}</span>
                </div>
              ))}
            </div>
          </TiltCard>
        </div>

        <div className="reveal lg:col-span-7">
          <TiltCard className="h-full">
            <div className="label-mono !tracking-[0.24em] opacity-70">Assessment</div>
            <h3 className="mt-4 font-display text-[1.7rem] font-[420] leading-snug text-parchment">
              Graded like a professor who explains.
            </h3>
            <p className="mt-3 text-[14.5px] leading-relaxed text-faded">
              Essays come back with a rubric, not a vibe — criterion by criterion,
              score by score, with the reasoning shown and the next draft already
              pointed toward.
            </p>
            <div className="mt-7 space-y-2">
              {[
                ["Thesis & argument", "9 / 10"],
                ["Use of evidence", "8 / 10"],
                ["Organization", "9 / 10"],
              ].map(([crit, score]) => (
                <div
                  key={crit}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5"
                >
                  <span className="text-[13px] text-parchment/85">{crit}</span>
                  <span className="font-mono text-[11px] text-brasspale">{score}</span>
                </div>
              ))}
            </div>
          </TiltCard>
        </div>
      </div>
    </section>
  );
}
