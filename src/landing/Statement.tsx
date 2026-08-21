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
        gsap.set(words, { opacity: 1 });
        return;
      }
      gsap.fromTo(
        words,
        { opacity: 0.13 },
        {
          opacity: 1,
          stagger: 0.06,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 72%",
            end: "center 45%",
            scrub: 0.5,
          },
        },
      );
      gsap.fromTo(
        ".stmt-glow",
        { scale: 0.55, opacity: 0.25 },
        {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 80%",
            end: "center center",
            scrub: 0.5,
          },
        },
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-[92svh] items-center overflow-hidden border-y border-white/[0.06]"
      aria-label="Manifesto"
    >
      <div
        className="stmt-glow pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(227,176,75,0.10), rgba(42,54,84,0.16) 45%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="label-mono mb-8 justify-center opacity-70">
          <span className="h-px w-9 grad-lamp" />
          <span className="mx-4">The Point</span>
          <span className="h-px w-9 grad-lamp" />
        </div>
        <p className="font-display text-[clamp(1.9rem,4.6vw,3.6rem)] font-[390] leading-[1.22] text-parchment">
          {TEXT.split(" ").map((w, i) => (
            <span key={i} className="stmt-word inline-block">
              {w}
              {" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
