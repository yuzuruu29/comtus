import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BookOpen, FolderTree, Target, Sparkles, CheckCircle2, Clock } from "lucide-react";
import SectionHead from "./SectionHead";
import TiltCard from "./TiltCard";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

const STAGES = [
  {
    step: "01",
    phase: "Understand",
    badge: "Available",
    badgeType: "available",
    icon: BookOpen,
    color: "text-brass",
    bgColor: "bg-brass/10 border-brass/30",
    headline: "Turn confusion into crystal clarity.",
    description:
      "Explain difficult concepts at your exact level. Comtus breaks down complex mechanisms using analogies, step-by-step logic, and follow-up Socratic questions.",
    features: [
      "Plain-language & deep technical explanations",
      "Real-world analogies & intuition builders",
      "Step-by-step mathematical & clinical breakdowns",
      "Socratic follow-ups to test comprehension",
    ],
  },
  {
    step: "02",
    phase: "Organize",
    badge: "Available",
    badgeType: "available",
    icon: FolderTree,
    color: "text-moon",
    bgColor: "bg-moon/10 border-moon/30",
    headline: "Unify scattered notes, slides, and PDFs.",
    description:
      "Drop in lecture slides, textbook chapters, or rough notes. Comtus parses and indexes everything on-device, generating clean outlines, structured summaries, and study guides.",
    features: [
      "PDF, DOCX, TXT, and Markdown indexing",
      "NotebookLM JSON export compatibility",
      "Automatic topic hierarchies & key concept glossaries",
      "All sources remain private on your device",
    ],
  },
  {
    step: "03",
    phase: "Practice",
    badge: "Available",
    badgeType: "available",
    icon: Target,
    color: "text-sage",
    bgColor: "bg-sage/10 border-sage/30",
    headline: "Active recall with defensive rationales.",
    description:
      "Test what you know instead of passively re-reading. Generate tailored quizzes, flashcards, and 100+ item mock exams with instant rationale for every answer choice.",
    features: [
      "Custom item counts, formats, and difficulty",
      "Full simulation timed mode & tutor mode",
      "Rubric-based essay grading with criterion feedback",
      "Hints-first practice to build true mastery",
    ],
  },
  {
    step: "04",
    phase: "Master",
    badge: "Beta & Planned",
    badgeType: "planned",
    icon: Sparkles,
    color: "text-brasspale",
    bgColor: "bg-brasspale/10 border-brasspale/30",
    headline: "Track progress and eliminate weak spots.",
    description:
      "Long-term retention requires deliberate review. Comtus tracks your performance across topics to surface knowledge gaps and keep you exam-ready.",
    features: [
      "Weak-topic detection & targeted drill generation",
      "Topic mastery indicators & performance scoring",
      "Personalized review intervals (Coming Soon)",
      "Exam readiness score & blueprint weighting",
    ],
  },
];

export default function LearningLoop() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-loop");
      if (reduced) {
        gsap.set(targets, { opacity: 1, y: 0, filter: "none" });
        return;
      }
      targets.forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 40, filter: "blur(6px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power3.out",
            delay: (i % 2) * 0.08,
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
      id="learning-loop"
      data-torch
      className="relative mx-auto w-full max-w-6xl px-6 py-[clamp(6rem,14vh,10rem)]"
    >
      <div className="reveal-loop">
        <SectionHead
          index="01"
          label="The Learning Loop"
          title={
            <>
              How Comtus helps you{" "}
              <em className="font-[420] text-lamp">actually learn.</em>
            </>
          }
          sub="Most AI tools stop at answering questions. Comtus accompanies you through the complete four-stage study cycle."
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          return (
            <div key={stage.step} className="reveal-loop h-full">
              <TiltCard className="flex h-full flex-col justify-between p-7 sm:p-8">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                        <Icon size={19} className={stage.color} />
                      </span>
                      <span className="font-mono text-[11px] tracking-[0.24em] text-faded uppercase">
                        {stage.step} — {stage.phase}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        stage.badgeType === "available"
                          ? "border-sage/30 bg-sage/10 text-sage"
                          : "border-brass/30 bg-brass/10 text-brasspale"
                      }`}
                    >
                      {stage.badgeType === "available" ? (
                        <CheckCircle2 size={10} />
                      ) : (
                        <Clock size={10} />
                      )}
                      {stage.badge}
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-[1.45rem] sm:text-[1.6rem] font-[420] leading-snug text-parchment">
                    {stage.headline}
                  </h3>

                  <p className="mt-3 text-[14px] leading-relaxed text-faded">
                    {stage.description}
                  </p>
                </div>

                <div className="mt-7 border-t border-white/[0.06] pt-5">
                  <div className="label-mono !text-[9.5px] opacity-70 mb-3">Key Capabilities</div>
                  <ul className="space-y-2">
                    {stage.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-2 text-[12.5px] leading-snug text-parchment/80"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brass" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </TiltCard>
            </div>
          );
        })}
      </div>
    </section>
  );
}
