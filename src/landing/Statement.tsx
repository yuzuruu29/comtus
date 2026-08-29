import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const TEXT =
  "Between the highlight and the exam lies the thinking — quiet, patient work. Comtus keeps a lamp on in that space, and never forgets which page an idea came from.";

/** Full-viewport manifesto, revealed word by word as you scroll. */
export default function Statement() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>(".stmt-word");
      if (reduced) {
        gsap.set(words, { opacity: 1, y: 0 });
        gsap.set(".stmt-rule", { scaleX: 1 });
        return;
      }
      gsap.fromTo(
        words,
        { opacity: 0.12, y: 8 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          ease: "power2.out",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 78%",
            end: "center 40%",
            scrub: 0.35,
          },
        },
      );
      gsap.fromTo(
        ".stmt-glow",
        { scale: 0.45, opacity: 0.15 },
        {
          scale: 1.08,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 85%",
            end: "center center",
            scrub: 0.4,
          },
        },
      );
      gsap.fromTo(
        ".stmt-rule",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 75%",
            end: "center 50%",
            scrub: 0.3,
          },
        },
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      data-torch
      className="relative flex min-h-[92svh] items-center overflow-hidden border-y border-white/[0.12] bg-[#044AB3] text-white"
      aria-label="Manifesto"
    >
      <div
        className="stmt-glow pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(111,227,255,0.22), rgba(4,74,179,0.4) 45%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-8 text-[#6FE3FF]">
          <span className="stmt-rule h-px w-9 origin-left bg-[#6FE3FF]" />
          <span className="font-mono text-[11.5px] uppercase tracking-widest font-bold text-[#6FE3FF]">The Point</span>
          <span className="stmt-rule h-px w-9 origin-right bg-[#6FE3FF]" />
        </div>
        <p className="font-display text-[clamp(1.9rem,4.6vw,3.6rem)] font-[600] leading-[1.28] text-white drop-shadow-sm flex flex-wrap justify-center">
          {TEXT.split(" ").map((w, i) => (
            <span key={i} className="stmt-word inline-block mr-[0.32em] last:mr-0">
              {w}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
