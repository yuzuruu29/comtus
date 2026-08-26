import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LampCanvas from "./LampCanvas";
import { scrollToSection } from "../lib/scroll";
import ArcadeCta from "./ArcadeCta";
import HeroLamp from "./HeroLamp";
import DeskDiorama from "./DeskDiorama";
import { HOUSE_EASE, PIXEL_HOP, PIXEL_STEPS } from "./pixelMotion";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

export default function Hero({
  ready,
  onStartStudying,
}: {
  ready: boolean;
  onStartStudying?: () => void;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ready || !rootRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(".hero-anim", { opacity: 1, yPercent: 0, y: 0 });
        gsap.set(".hero-lamp, .desk-diorama", { opacity: 1, y: 0 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: HOUSE_EASE }, delay: 0.12 });
      tl.fromTo(
        ".hero-kicker",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.48, ease: PIXEL_HOP },
      )
        .fromTo(
          ".hero-line-inner",
          { yPercent: 118 },
          { yPercent: 0, duration: 0.85, stagger: 0.1, ease: PIXEL_STEPS },
          "-=0.28",
        )
        .fromTo(
          ".hero-sub",
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.55, ease: PIXEL_HOP },
          "-=0.45",
        )
        .fromTo(
          ".hero-cta",
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: PIXEL_HOP },
          "-=0.35",
        )
        .fromTo(
          ".hero-lamp",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: PIXEL_HOP },
          "-=0.4",
        )
        .fromTo(
          ".desk-diorama",
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.45, ease: PIXEL_HOP },
          "-=0.3",
        )
        .fromTo(
          ".hero-cue",
          { opacity: 0 },
          { opacity: 1, duration: 0.55 },
          "-=0.2",
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
      <div className="landing-hero-bloom" aria-hidden />
      <HeroLamp />
      {/* Cool floor glow — the desk under the lamp */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] bg-[radial-gradient(60%_100%_at_50%_100%,rgba(42,54,84,0.5),rgba(42,54,84,0.12)_55%,transparent_80%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(242,237,227,0.14),transparent)]" />

      <div className="hero-content relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pt-28 pb-6 text-center">
        <div className="hero-kicker label-mono flex items-center gap-3 sm:gap-4 opacity-0">
          <span className="hidden h-px w-10 grad-lamp sm:block" />
          <span className="arcade-press border border-brass/35 bg-brass/10 px-3 py-1 text-[12px] font-semibold tracking-[0.18em] text-brasspale">
            AI STUDY COMPANION
          </span>
          <span className="hidden h-px w-10 grad-lamp sm:block" />
        </div>

        <h1 className="mt-8 font-display text-[clamp(2.9rem,8vw,6.8rem)] font-[380] leading-[1.02] tracking-[-0.015em] text-parchment">
          <span className="hero-line block overflow-hidden pb-1">
            <span className="hero-line-inner hero-anim block will-change-transform">
              Study smarter with Comtus.
            </span>
          </span>
          <span className="hero-line block overflow-hidden pb-3">
            <span className="hero-line-inner hero-anim block font-[420] italic text-[clamp(2.1rem,5.5vw,4.5rem)] text-faded will-change-transform">
              Rough thought, <span className="text-lamp">polished.</span>
            </span>
          </span>
        </h1>

        <p className="hero-sub hero-anim mt-6 max-w-2xl text-balance text-[15.5px] leading-relaxed text-faded opacity-0 sm:text-[17px]">
          Comtus helps you understand difficult lessons, organize your study materials, practice what you've learned, and prepare with confidence.
        </p>

        {/* Learning Loop Pill Badges */}
        <div className="hero-sub hero-anim mt-5 flex flex-wrap items-center justify-center gap-2 text-[12px] text-faded/90 opacity-0">
          <span className="arcade-press flex items-center gap-1.5 border border-white/10 bg-white/[0.03] px-3 py-1">
            <span className="h-1.5 w-1.5 bg-brass" /> Understand
          </span>
          <span className="arcade-press flex items-center gap-1.5 border border-white/10 bg-white/[0.03] px-3 py-1">
            <span className="h-1.5 w-1.5 bg-moon" /> Organize
          </span>
          <span className="arcade-press flex items-center gap-1.5 border border-white/10 bg-white/[0.03] px-3 py-1">
            <span className="h-1.5 w-1.5 bg-sage" /> Practice
          </span>
          <span className="arcade-press flex items-center gap-1.5 border border-white/10 bg-white/[0.03] px-3 py-1">
            <span className="h-1.5 w-1.5 bg-brasspale" /> Master
          </span>
        </div>

        <div className="hero-play">
          <div className="hero-cta-row">
            {onStartStudying ? (
              <ArcadeCta className="hero-cta hero-anim opacity-0" magnetY={false}>
                <button
                  onClick={onStartStudying}
                  className="arcade-press group flex min-h-[50px] w-full items-center justify-center gap-2.5 grad-lamp py-3.5 pl-7 pr-3 text-[15px] font-semibold text-night"
                >
                  <span>Start Studying</span>
                  <span className="flex h-8 w-8 items-center justify-center bg-night/15 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
                    <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M1.5 9.5L9.5 1.5M9.5 1.5H3M9.5 1.5V8"
                        stroke="#0B0F1A"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </button>
              </ArcadeCta>
            ) : (
              <ArcadeCta className="hero-cta hero-anim opacity-0" magnetY={false}>
                <Link
                  to="/studio"
                  className="arcade-press group flex min-h-[50px] w-full items-center justify-center gap-2.5 grad-lamp py-3.5 pl-7 pr-3 text-[15px] font-semibold text-night"
                >
                  <span>Start Studying</span>
                  <span className="flex h-8 w-8 items-center justify-center bg-night/15 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
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
              </ArcadeCta>
            )}
            <button
              onClick={() => scrollToSection("#learning-loop")}
              className="hero-cta hero-anim arcade-press ghost-tint group flex min-h-[50px] items-center justify-center border border-white/12 bg-white/[0.03] px-7 py-3.5 text-[15px] font-medium text-parchment/90 backdrop-blur-sm opacity-0"
            >
              <span className="roll">
                <span>See How Comtus Works</span>
                <span aria-hidden>See How Comtus Works</span>
              </span>
            </button>
          </div>
          <DeskDiorama />
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
