import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import SectionHead from "./SectionHead";
import { SOFT } from "../studio/fx";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

const FAQS = [
  {
    q: "What is Comtus?",
    a: "Comtus is an AI study companion designed to help students understand difficult lessons, organize scattered course materials, practice what they learn through active recall, and master their subjects over time.",
  },
  {
    q: "Is Comtus just another chatbot?",
    a: "No. Unlike chatbots with temporary conversational threads, Comtus is a dedicated, local-first study workspace. It organizes your files into subject notebooks, extracts key concepts, generates full mock exams, creates flashcards, and provides Socratic reasoning grounded in your own uploaded sources.",
  },
  {
    q: "Can Comtus help me study for licensure and major exams?",
    a: "Yes. Comtus includes dedicated exam blueprints and simulated exam engines modeled on real board examination formats (such as PNLE, LET, Civil Engineering, CPA, and custom university exams) complete with timed mode and rationales for every answer choice.",
  },
  {
    q: "Can I upload my own lecture notes, slides, and PDFs?",
    a: "Yes. You can import PDF textbooks, DOCX files, Markdown notes, lecture slide transcripts, or NotebookLM JSON export files. Comtus parses and indexes them directly inside your browser.",
  },
  {
    q: "Does Comtus give direct homework answers?",
    a: "Comtus is built to support genuine learning, not cognitive replacement. When asked homework questions, it prioritizes hints, worked examples, and step-by-step Socratic breakdowns so you understand how to solve problems independently.",
  },
  {
    q: "How does Comtus protect my private study materials?",
    a: "Comtus is architected local-first. Your documents and study sessions are stored in your device's IndexedDB. Your API keys stay on your machine, and your study data is never used to train public AI models.",
  },
  {
    q: "Is Comtus free to use?",
    a: "Yes. You can use Comtus 100% free by bringing your own free OpenRouter key (which includes DeepSeek R1, Llama 3.3 70B, and Gemini Flash with zero credit card required) or by running fully local models with Ollama. Optional hosted passes for Claude Opus 5 are also available.",
  },
  {
    q: "What academic subjects can I study?",
    a: "Comtus supports any subject where students learn from source materials — including Medicine, Nursing, STEM, Law, Engineering, Business, Humanities, Computer Science, and Language Learning.",
  },
  {
    q: "Can Comtus generate custom quizzes and flashcards?",
    a: "Yes. In the Studio pane, you can generate multiple-choice quizzes, flashcards, study guides, mind maps, and full mock exams with customizable question counts and difficulty levels.",
  },
  {
    q: "How is Comtus different from ChatGPT?",
    a: "ChatGPT operates as a general-purpose chat interface without subject structure or active recall pedagogy. Comtus provides a persistent course workspace, strict page-level source citations, interactive exam testing, essay rubric grading, and a distraction-free Lamplight study environment.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-faq");
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
            delay: i * 0.05,
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
      id="faq"
      data-torch
      className="relative mx-auto w-full max-w-4xl px-6 py-[clamp(6rem,14vh,10rem)] text-[#0B132B]"
    >
      <div className="reveal-faq">
        <SectionHead
          center
          index="03"
          label="FAQ"
          title={
            <>
              Frequently asked <em className="font-[500] text-[#044AB3]">questions.</em>
            </>
          }
          sub="Everything you need to know about how Comtus works, privacy, model keys, and study tools."
        />
      </div>

      <div className="reveal-faq mt-14 space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={faq.q}
              className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
                isOpen
                  ? "border-[#044AB3] bg-white shadow-[0_6px_28px_rgba(4,74,179,0.1)]"
                  : "border-[rgba(4,74,179,0.14)] bg-white hover:border-[#044AB3]/60 shadow-sm"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors cursor-pointer"
              >
                <span className="font-display text-[1.15rem] font-[520] text-[#0B132B]">
                  {faq.q}
                </span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-transform duration-300 ${
                    isOpen
                      ? "rotate-180 text-white bg-[#044AB3] border-[#044AB3]"
                      : "border-[rgba(4,74,179,0.2)] bg-[#044AB3]/5 text-[#044AB3]"
                  }`}
                >
                  <ChevronDown size={14} />
                </span>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={SOFT}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-[rgba(4,74,179,0.08)] px-5 pb-5 pt-3 text-[14px] leading-relaxed text-[#5A6A85]">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
