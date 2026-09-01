import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ComtusEmblem } from "../components/brand/ComtusLogo";

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
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" },
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
          { yPercent: 0, duration: 0.55, stagger: 0.05, ease: "power3.out" },
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
      className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-ground text-ink"
      aria-hidden
    >
      <div className="pre-glow absolute h-[46vmin] w-[46vmin] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--brasspale)_28%,transparent),color-mix(in_srgb,var(--brass)_16%,transparent)_45%,transparent_70%)]" />
      <div className="pre-flame relative drop-shadow-[0_0_24px_color-mix(in_srgb,var(--brass)_40%,transparent)]">
        <ComtusEmblem size={56} className="text-brass" />
      </div>
      <div className="relative mt-7 overflow-hidden">
        <div className="flex font-display text-[clamp(2.2rem,6vw,4rem)] font-[600] tracking-[0.32em] text-ink">
          {WORD.split("").map((l, i) => (
            <span key={i} className="pre-letter inline-block will-change-transform">
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="pre-rule mt-6 h-px w-44 origin-center bg-brass" />
      <div className="pre-count label-mono absolute bottom-[calc(1.5rem+var(--sab))] left-6 tabular-nums sm:bottom-10 sm:left-10 text-brass">
        000
      </div>
      <div className="label-mono absolute bottom-[calc(1.5rem+var(--sab))] right-6 text-right text-muted sm:bottom-10 sm:right-10">
        COGNITIVE INFRASTRUCTURE · ACTIVE
      </div>
    </div>
  );
}
