import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionHead from "./SectionHead";
import TiltCard from "./TiltCard";

gsap.registerPlugin(ScrollTrigger);

const PRESETS = [
  ["PNLE", "Philippine Nurse Licensure"],
  ["LET", "Licensure Exam for Teachers"],
  ["CE", "Civil Engineers Board"],
  ["CPA", "Certified Public Accountant"],
  ["+", "Model any exam, anywhere"],
];

/** 05 — BOARDS · Philippine licensure presets + the blueprint editor. */
export default function Boards() {
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
          { opacity: 0, y: 38 },
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
      id="boards"
      data-torch
      className="relative mx-auto w-full max-w-6xl px-6 py-[clamp(6rem,14vh,10rem)]"
    >
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="reveal">
            <SectionHead
              index="05"
              label="Boards"
              title={
                <>
                  Built for the{" "}
                  <em className="font-[420] text-lamp">board-exam</em> grind.
                </>
              }
              sub="Philippine licensure presets modeled on the real formats — full-length shaded exams, per-item rationales, timed simulations, and drills that hunt your weak areas."
            />
          </div>
          <div className="reveal mt-9 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {PRESETS.map(([code, name]) => (
              <div
                key={code}
                className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors duration-300 hover:border-brass/25"
              >
                <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg border border-brass/25 bg-brass/[0.07] font-mono text-[11px] font-medium tracking-wide text-brasspale">
                  {code}
                </span>
                <span className="text-[12.5px] leading-snug text-parchment/80">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal lg:col-span-6">
          <TiltCard>
            <div className="flex items-baseline justify-between">
              <div className="label-mono !tracking-[0.24em] opacity-70">
                Exam blueprint
              </div>
              <div className="font-mono text-[10.5px] text-faded">
                150 items · 3h · shaded
              </div>
            </div>
            <h3 className="mt-4 font-display text-[1.6rem] font-[420] text-parchment">
              PNLE — Full Simulation
            </h3>

            {/* Exam preparation flatlay image */}
            <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-night/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <img
                src="/images/board-blueprint.jpg"
                alt="Board exam blueprint, stopwatch, and shaded answer sheet"
                className="h-40 w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                loading="lazy"
              />
            </div>

            <div className="mt-6 space-y-3">
              {[
                ["Community Health Nursing", 92, 30],
                ["Medical-Surgical", 88, 38],
                ["Maternal & Child", 76, 28],
                ["Psychiatric Nursing", 58, 22],
                ["Professional Adjustment", 44, 32],
              ].map(([topic, weight, items]) => (
                <div key={topic as string} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 truncate text-[12.5px] text-parchment/80">
                    {topic}
                  </span>
                  <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full grad-lamp"
                      style={{ width: `${weight}%`, opacity: 0.85 }}
                    />
                  </div>
                  <span className="w-7 text-right font-mono text-[10.5px] text-faded">
                    {items}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
              {["timed mode", "tutor mode", "rationale on every key", "weak-area drills"].map(
                (m) => (
                  <span
                    key={m}
                    className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] tracking-wide text-faded"
                  >
                    {m}
                  </span>
                ),
              )}
            </div>
          </TiltCard>
        </div>
      </div>
    </section>
  );
}
