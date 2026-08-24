import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ITEMS = [
  "Grounded answers",
  "Visible reasoning",
  "Mock board exams",
  "Rubric-graded essays",
  "Flashcards that stick",
  "Your NotebookLM stack",
  "Local-first",
];

function Row() {
  return (
    <div className="flex shrink-0 items-center">
      {ITEMS.map((item) => (
        <span key={item} className="flex items-center">
          <span className="label-mono whitespace-nowrap px-7 text-[12px] !tracking-[0.3em] text-faded">
            {item}
          </span>
          <span className="h-1.5 w-1.5 rotate-45 grad-lamp opacity-70" />
        </span>
      ))}
    </div>
  );
}

/** Velocity-reactive marquee — accelerates with your scroll, eases back. */
export default function Marquee() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const tween = gsap.to(trackRef.current, {
        xPercent: -50,
        duration: 30,
        ease: "none",
        repeat: -1,
      });
      const st = ScrollTrigger.create({
        onUpdate: (self) => {
          const v = Math.abs(self.getVelocity());
          const target = 1 + Math.min(v / 900, 3.4);
          gsap.to(tween, {
            timeScale: target,
            duration: 0.25,
            overwrite: true,
          });
          gsap.to(tween, {
            timeScale: 1,
            duration: 1.4,
            delay: 0.3,
            overwrite: false,
          });
        },
      });
      return () => {
        st.kill();
      };
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      data-torch
      className="relative overflow-hidden border-y border-white/[0.07] bg-study/40 py-5"
      aria-hidden
    >
      <div ref={trackRef} className="flex w-max will-change-transform">
        <Row />
        <Row />
      </div>
    </div>
  );
}
