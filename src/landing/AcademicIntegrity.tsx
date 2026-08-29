import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BookOpen, Lightbulb, Compass, Award } from "lucide-react";
import SectionHead from "./SectionHead";
import TiltCard from "./TiltCard";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

const PILLARS = [
  {
    icon: Lightbulb,
    title: "Hints First, Answers Second",
    text: "Comtus is programmed to scaffold reasoning. When you ask for homework help, it guides you with questions and hints so you understand the underlying mechanism.",
  },
  {
    icon: Compass,
    title: "Source-Grounded Transparency",
    text: "Answers explicitly cite your lecture notes, textbook slides, and syllabus documents, allowing you to cross-verify claims in your original course materials.",
  },
  {
    icon: Award,
    title: "Rubric-Based Essay Coaching",
    text: "Comtus acts as a critical second reader. It scores your writing against standard rubrics with constructive critiques — never ghostwriting essays.",
  },
  {
    icon: BookOpen,
    title: "Defensible Answer Rationales",
    text: "Every generated quiz and exam question includes a rigorous breakdown of why the correct option is right and why the distractors are wrong.",
  },
];

export default function AcademicIntegrity() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-ai");
      if (reduced) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }
      targets.forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 35 },
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
      id="academic-integrity"
      data-torch
      className="relative mx-auto w-full max-w-6xl px-6 py-[clamp(6rem,14vh,10rem)]"
    >
      <div className="reveal-ai">
        <SectionHead
          index="07"
          label="Academic Integrity"
          title={
            <>
              Built to support learning —{" "}
              <em className="font-[420] text-lamp">not replace it.</em>
            </>
          }
          sub="True confidence comes from understanding. Comtus is intentionally designed to elevate student capability, not encourage cognitive shortcuts."
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="reveal-ai h-full">
              <TiltCard className="flex h-full flex-col p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brass/30 bg-brass/10 text-brasspale">
                    <Icon size={18} />
                  </span>
                  <h3 className="font-display text-[1.25rem] font-[440] text-parchment">
                    {p.title}
                  </h3>
                </div>
                <p className="mt-3.5 text-[13.5px] leading-relaxed text-faded">
                  {p.text}
                </p>
              </TiltCard>
            </div>
          );
        })}
      </div>
    </section>
  );
}
