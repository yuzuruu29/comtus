import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GraduationCap, Compass, HelpCircle, Layers, FileCheck, BookOpen } from "lucide-react";
import SectionHead from "./SectionHead";
import TiltCard from "./TiltCard";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

const USE_CASES = [
  {
    icon: GraduationCap,
    title: "After Class",
    tag: "Review & Retention",
    description:
      "Turn rushed, messy lecture notes and unorganized slides into a clear, structured study review within minutes of leaving the hall.",
  },
  {
    icon: HelpCircle,
    title: "Difficult Topic",
    tag: "Conceptual Breakthrough",
    description:
      "Stuck on complex clinical pathways, calculus proofs, or historical nuances? Ask Comtus to re-explain with concrete analogies and diagrams.",
  },
  {
    icon: Layers,
    title: "Before a Quiz",
    tag: "Active Recall",
    description:
      "Generate focused 10-item drill sets from today's assigned readings to test your recall and expose gaps before walking into class.",
  },
  {
    icon: FileCheck,
    title: "Exam Week",
    tag: "Full Dress Rehearsal",
    description:
      "Run complete 100–150 item simulated mock exams with strict timing, shaded answer sheets, and defensible rationales for every key.",
  },
  {
    icon: Compass,
    title: "Research & Synthesis",
    tag: "Multi-Source Grounding",
    description:
      "Synthesize multiple textbook chapters, academic papers, and lecture transcripts while tracking exact page citations for every argument.",
  },
  {
    icon: BookOpen,
    title: "Self-Study & Upskilling",
    tag: "Independent Learning",
    description:
      "Learn new programming languages, accounting standards, or medical terminology at your own pace with an always-patient Socratic tutor.",
  },
];

export default function UseCases() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-uc");
      if (reduced) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }
      targets.forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 35 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            delay: (i % 3) * 0.07,
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
      id="use-cases"
      data-torch
      className="relative mx-auto w-full max-w-6xl px-6 py-[clamp(6rem,14vh,10rem)]"
    >
      <div className="reveal-uc">
        <SectionHead
          index="03"
          label="Use Cases"
          title={
            <>
              Made for the way students{" "}
              <em className="font-[420] text-lamp">actually study.</em>
            </>
          }
          sub="Whether you have 15 minutes before a pop quiz or two months before board exams, Comtus adapts to your workflow."
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((uc) => {
          const Icon = uc.icon;
          return (
            <div key={uc.title} className="reveal-uc h-full">
              <TiltCard className="flex h-full flex-col justify-between p-6 sm:p-7">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brass/25 bg-brass/[0.08] text-brasspale">
                      <Icon size={18} />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-faded">
                      {uc.tag}
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-[1.35rem] font-[430] text-parchment">
                    {uc.title}
                  </h3>

                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-faded">
                    {uc.description}
                  </p>
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-4 font-mono text-[11px] text-brasspale/80 flex items-center gap-1">
                  <span>Explore in Studio</span> →
                </div>
              </TiltCard>
            </div>
          );
        })}
      </div>
    </section>
  );
}
