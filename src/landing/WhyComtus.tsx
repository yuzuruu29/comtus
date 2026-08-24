import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Check, X } from "lucide-react";
import SectionHead from "./SectionHead";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

const COMPARISONS = [
  {
    topic: "Study Context",
    generic: "One-off questions lost in temporary chat logs",
    comtus: "Continuous, persistent workspace organized by course & subject",
  },
  {
    topic: "Learning Approach",
    generic: "Gives quick answers that bypass student critical thinking",
    comtus: "Socratic tutoring, hints-first, and worked step-by-step reasoning",
  },
  {
    topic: "Source Grounding",
    generic: "Unverified model training data with hallucination risk",
    comtus: "Grounded strictly in your uploaded slides, PDFs & notes with page citations",
  },
  {
    topic: "Dedicated Study Modes",
    generic: "Single generic text box for all tasks",
    comtus: "Dedicated Mock Exams, Rapid Quizzes, Essay Rubric Coach, and Flashcards",
  },
  {
    topic: "Material Organization",
    generic: "User manually organizes files and copies prompts",
    comtus: "Automatic parsing, concept glossaries, and on-device indexing",
  },
  {
    topic: "Privacy & Data Storage",
    generic: "Uploaded files sent and stored on remote company servers",
    comtus: "Local-first on-device IndexedDB storage; BYOK keys never leave your machine",
  },
];

export default function WhyComtus() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-why");
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
            duration: 0.9,
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
      id="why-comtus"
      data-torch
      className="relative mx-auto w-full max-w-6xl px-6 py-[clamp(6rem,14vh,10rem)]"
    >
      <div className="reveal-why">
        <SectionHead
          index="04"
          label="Why Comtus"
          title={
            <>
              Why not just use a{" "}
              <em className="font-[420] text-lamp">generic chatbot?</em>
            </>
          }
          sub="Chatbots are designed for broad conversation. Comtus is engineered specifically around the cognitive science of studying."
        />
      </div>

      {/* Comparison Matrix Table */}
      <div className="reveal-why mt-14 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-study/50 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <div className="grid grid-cols-1 md:grid-cols-12 border-b border-white/[0.08] bg-night/80 text-[12px] font-mono uppercase tracking-[0.2em]">
          <div className="p-4 md:col-span-3 text-faded">Dimension</div>
          <div className="p-4 md:col-span-4 border-t md:border-t-0 md:border-l border-white/[0.08] text-faded/80">
            Generic AI Chatbot
          </div>
          <div className="p-4 md:col-span-5 border-t md:border-t-0 md:border-l border-brass/25 bg-brass/[0.04] text-brasspale font-semibold">
            Comtus Study Companion
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {COMPARISONS.map((row, idx) => (
            <div
              key={row.topic}
              className={`grid grid-cols-1 md:grid-cols-12 text-[13.5px] transition-colors ${
                idx % 2 === 0 ? "bg-white/[0.01]" : "bg-transparent"
              } hover:bg-white/[0.025]`}
            >
              <div className="p-4 md:col-span-3 font-display font-medium text-parchment">
                {row.topic}
              </div>
              <div className="p-4 md:col-span-4 border-t md:border-t-0 md:border-l border-white/[0.06] text-faded flex items-start gap-2.5">
                <X size={15} className="text-rust/70 shrink-0 mt-0.5" />
                <span>{row.generic}</span>
              </div>
              <div className="p-4 md:col-span-5 border-t md:border-t-0 md:border-l border-brass/20 bg-brass/[0.02] text-parchment/90 flex items-start gap-2.5">
                <Check size={16} className="text-sage shrink-0 mt-0.5" />
                <span>{row.comtus}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
