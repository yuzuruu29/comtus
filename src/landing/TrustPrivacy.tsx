import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HardDrive, KeyRound, Trash2, Download } from "lucide-react";
import SectionHead from "./SectionHead";
import TiltCard from "./TiltCard";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

const TRUST_POINTS = [
  {
    icon: HardDrive,
    title: "Local-First Storage (IndexedDB)",
    text: "Your uploaded PDFs, lecture notes, flashcards, and exam logs are parsed and stored directly in your browser's IndexedDB. Nothing is uploaded to central application databases.",
  },
  {
    icon: KeyRound,
    title: "On-Device BYOK Keys",
    text: "When using OpenRouter or Groq, your API keys stay strictly in your local device storage. Requests route directly to the model endpoint with no intermediary key logging.",
  },
  {
    icon: Trash2,
    title: "Instant One-Click Deletion",
    text: "You have complete control over your study data. Clear any individual notebook or wipe the entire on-device database instantly in Settings with zero remnant copies.",
  },
  {
    icon: Download,
    title: "Full Data Portability",
    text: "Export your notebooks, generated exams, flashcard sets, and study guides anytime as clean Markdown, JSON, PDF, or PowerPoint presentation files.",
  },
];

export default function TrustPrivacy() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-trust");
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
            ease: "steps(6)",
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
      id="privacy"
      data-torch
      className="relative mx-auto w-full max-w-6xl px-6 py-[clamp(6rem,14vh,10rem)]"
    >
      <div className="reveal-trust">
        <SectionHead
          index="08"
          label="Trust & Privacy"
          title={
            <>
              Your study materials{" "}
              <em className="font-[420] text-lamp">stay yours.</em>
            </>
          }
          sub="No silent model training. No cloud database hoarding. Verified local-first architecture built with respect for your privacy."
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {TRUST_POINTS.map((pt) => {
          const Icon = pt.icon;
          return (
            <div key={pt.title} className="reveal-trust h-full">
              <TiltCard className="flex h-full flex-col p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-sage/30 bg-sage/10 text-sage">
                    <Icon size={18} />
                  </span>
                  <h3 className="font-display text-[1.25rem] font-[440] text-parchment">
                    {pt.title}
                  </h3>
                </div>
                <p className="mt-3.5 text-[13.5px] leading-relaxed text-faded">
                  {pt.text}
                </p>
              </TiltCard>
            </div>
          );
        })}
      </div>
    </section>
  );
}
