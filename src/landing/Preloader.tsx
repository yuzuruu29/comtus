import { useEffect, useRef } from "react";
import gsap from "gsap";

const WORD = "COMTUS";

/** Lamp-ignition preloader: flame blooms, letters rise, rule draws,
 *  counter runs, panel lifts. Click to skip. Skipped entirely when
 *  the user prefers reduced motion. */
export default function Preloader({ onDone }: { onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onDone();
      return;
    }

    const ctx = gsap.context(() => {
      const counter = { v: 0 };
      const counterEl = rootRef.current?.querySelector<HTMLElement>(".pre-count");
      const tl = gsap.timeline({
        defaults: { ease: "power4.out" },
        onComplete: finish,
      });

      tl.fromTo(
        ".pre-flame",
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.8)" },
      )
        .fromTo(
          ".pre-glow",
          { scale: 0.4, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.9, ease: "power2.out" },
          "<",
        )
        .fromTo(
          ".pre-letter",
          { yPercent: 120 },
          { yPercent: 0, duration: 0.8, stagger: 0.055 },
          "-=0.45",
        )
        .fromTo(
          ".pre-rule",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.7, ease: "power3.inOut" },
          "-=0.5",
        )
        .to(
          counter,
          {
            v: 100,
            duration: 1.05,
            ease: "power2.inOut",
            onUpdate: () => {
              if (counterEl)
                counterEl.textContent = String(Math.round(counter.v)).padStart(3, "0");
            },
          },
          "-=0.7",
        )
        .to({}, { duration: 0.15 })
        .to(rootRef.current, {
          yPercent: -100,
          duration: 0.85,
          ease: "power4.inOut",
        });
    }, rootRef);

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    }

    const el = rootRef.current;
    const skip = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      if (el) {
        gsap
          .to(el, { yPercent: -100, duration: 0.5, ease: "power4.inOut" })
          .then(onDone);
      } else {
        onDone();
      }
    };
    el?.addEventListener("click", skip);

    return () => {
      ctx.revert();
      el?.removeEventListener("click", skip);
    };
  }, [onDone]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-night"
      aria-hidden
    >
      <div className="pre-glow absolute h-[46vmin] w-[46vmin] rounded-full bg-[radial-gradient(circle,rgba(227,176,75,0.16),rgba(42,54,84,0.12)_45%,transparent_70%)]" />
      <svg
        viewBox="0 0 64 64"
        className="pre-flame relative h-14 w-14 drop-shadow-[0_0_24px_rgba(227,176,75,0.45)]"
      >
        <path
          d="M32 10 C 38 18, 42 23, 42 29 A 10 10 0 1 1 22 29 C 22 23, 26 18, 32 10 Z"
          fill="#E3B04B"
        />
        <path
          d="M32 20 C 35 24, 37 26.5, 37 29.5 A 5 5 0 1 1 27 29.5 C 27 26.5, 29 24, 32 20 Z"
          fill="#F0CE8C"
        />
      </svg>
      <div className="relative mt-7 overflow-hidden">
        <div className="flex font-display text-[clamp(2.2rem,6vw,4rem)] font-[420] tracking-[0.32em] text-parchment">
          {WORD.split("").map((l, i) => (
            <span key={i} className="pre-letter inline-block will-change-transform">
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="pre-rule grad-lamp mt-6 h-px w-44 origin-center" />
      <div className="pre-count label-mono absolute bottom-[calc(1.5rem+var(--sab))] left-6 tabular-nums sm:bottom-10 sm:left-10">
        000
      </div>
      <div className="label-mono absolute bottom-[calc(1.5rem+var(--sab))] right-6 text-right normal-case tracking-[0.2em] opacity-60 sm:bottom-10 sm:right-10">
        study in a warmer light
      </div>
    </div>
  );
}
