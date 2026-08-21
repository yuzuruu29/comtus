import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LampCanvas from "./LampCanvas";
import { scrollToSection } from "../lib/scroll";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

export default function Hero({ ready }: { ready: boolean }) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ready || !rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(".hero-anim", { opacity: 1, yPercent: 0, y: 0 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.15 });
      tl.fromTo(
        ".hero-kicker",
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.8 },
      )
        .fromTo(
          ".hero-line-inner",
          { yPercent: 118 },
          { yPercent: 0, duration: 1.15, stagger: 0.13 },
          "-=0.5",
        )
        .fromTo(
          ".hero-sub",
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.9 },
          "-=0.7",
        )
        .fromTo(
          ".hero-cta",
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.09 },
          "-=0.65",
        )
        .fromTo(
          ".hero-cue",
          { opacity: 0 },
          { opacity: 1, duration: 0.9, ease: "power2.inOut" },
          "-=0.4",
        );

      // Scroll parallax — the lamp recedes as you leave (lighter on mobile).
      const isMobile = window.innerWidth < 768;
      gsap.to(".hero-content", {
        yPercent: isMobile ? -4 : -9,
        opacity: 0.25,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom 35%",
          scrub: true,
        },
      });
      gsap.to(".hero-canvas-layer", {
        opacity: 0.15,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }, rootRef);
    return () => ctx.revert();
  }, [ready]);

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-[100svh] flex-col overflow-hidden"
      aria-label="Introduction"
    >
      <div className="hero-canvas-layer absolute inset-0">
        <LampCanvas className="h-full w-full" />
      </div>
      {/* Cool floor glow — the desk under the lamp */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] bg-[radial-gradient(60%_100%_at_50%_100%,rgba(42,54,84,0.5),rgba(42,54,84,0.12)_55%,transparent_80%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(242,237,227,0.14),transparent)]" />

      <div className="hero-content relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pt-28 text-center">
        <div className="hero-kicker label-mono flex items-center gap-4 opacity-0">
          <span className="hidden h-px w-10 grad-lamp sm:block" />
          A study companion that shows its work
          <span className="hidden h-px w-10 grad-lamp sm:block" />
        </div>

        <h1 className="mt-8 font-display text-[clamp(3.1rem,9vw,7.4rem)] font-[380] leading-[0.99] tracking-[-0.015em] text-parchment">
          <span className="hero-line block overflow-hidden pb-1">
            <span className="hero-line-inner hero-anim block will-change-transform">
              Rough thought,
            </span>
          </span>
          <span className="hero-line block overflow-hidden pb-3">
            <span className="hero-line-inner hero-anim block font-[420] italic will-change-transform">
              <span className="text-lamp">polished.</span>
            </span>
          </span>
        </h1>

        <p className="hero-sub hero-anim mt-7 max-w-xl text-balance text-[15.5px] leading-relaxed text-faded opacity-0 sm:text-base">
          Comtus reads your sources, reasons in the open, and turns them into mock
          exams, graded essays, and answers that cite their pages.
        </p>

        <div className="mt-10 flex w-full max-w-xs flex-col items-stretch gap-3 sm:max-w-none sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <Link
            to="/studio"
            className="hero-cta hero-anim group flex min-h-[48px] items-center justify-center gap-2.5 rounded-full grad-lamp py-3.5 pl-7 pr-2.5 text-[14px] font-semibold text-night shadow-[0_10px_44px_rgba(227,176,75,0.22)] transition-all duration-500 hover:shadow-[0_14px_60px_rgba(227,176,75,0.34)] active:scale-[0.98] opacity-0"
          >
            Open the studio
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-night/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
              <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
                <path
                  d="M1.5 9.5L9.5 1.5M9.5 1.5H3M9.5 1.5V8"
                  stroke="#0B0F1A"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </Link>
          <button
            onClick={() => scrollToSection("#method")}
            className="hero-cta hero-anim ghost-tint group flex min-h-[48px] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 py-3.5 text-[14px] font-medium text-parchment/90 backdrop-blur-sm transition-all duration-300 active:scale-[0.98] opacity-0"
          >
            <span className="roll">
              <span>See how it thinks</span>
              <span aria-hidden>See how it thinks</span>
            </span>
          </button>
        </div>
      </div>

      <div className="hero-cue hero-anim relative z-10 pb-9 pt-6 text-center opacity-0">
        <div className="label-mono inline-flex flex-col items-center gap-3 opacity-80">
          <span>Scroll</span>
          <span className="relative block h-10 w-px overflow-hidden bg-white/10">
            <span className="absolute left-0 top-0 h-3.5 w-px animate-[cue-drop_2.2s_var(--ease-house-inout)_infinite] grad-lamp" />
          </span>
        </div>
      </div>

      <style>{`@keyframes cue-drop { 0% { transform: translateY(-100%);} 55% { transform: translateY(260%);} 100% { transform: translateY(260%);} }`}</style>
    </section>
  );
}
