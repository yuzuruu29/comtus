import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollToSection } from "../lib/scroll";
import PixelDeskHeroScene from "./PixelDeskHeroScene";
import { PixelButton } from "../components/pixel/PixelUI";
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
        gsap.set(".pixel-desk-hero-scene-wrap", { opacity: 1, y: 0 });
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
          ".pixel-desk-hero-scene-wrap",
          { opacity: 0, y: 22, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: PIXEL_HOP },
          "-=0.3",
        )
        .fromTo(
          ".hero-cue",
          { opacity: 0 },
          { opacity: 1, duration: 0.55 },
          "-=0.2",
        );

      // Smooth GSAP scroll transitions — viewpoint gently transitions from the ambient window into the desk workbench
      const isMobile = window.innerWidth < 768;
      gsap.to(".hero-header-block", {
        yPercent: isMobile ? -5 : -10,
        opacity: 0.35,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom 40%",
          scrub: true,
        },
      });

      gsap.to(".pixel-desk-hero-scene-wrap", {
        yPercent: isMobile ? -3 : -7,
        scale: isMobile ? 0.98 : 1.02,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom 25%",
          scrub: 0.7,
        },
      });
    }, rootRef);

    return () => ctx.revert();
  }, [ready]);

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-[100svh] flex-col overflow-hidden bg-transparent"
      aria-label="Introduction"
    >
      {/* Warm paper ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] bg-[radial-gradient(60%_100%_at_50%_100%,rgba(74,46,27,0.06),transparent_75%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(92,61,30,0.14),transparent)]" />

      <div className="hero-content relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 pt-24 pb-8 text-center sm:px-6 sm:pt-28">
        <div className="hero-header-block flex flex-col items-center">
          {/* Kicker Eyebrow */}
          <div className="hero-kicker label-mono flex items-center gap-3 sm:gap-4 opacity-0">
            <span className="hidden h-px w-10 bg-px-brass/40 sm:block" />
            <span className="btn-ink-press border border-px-brass/40 bg-px-brass/10 px-3.5 py-1 text-[12px] font-mono font-semibold tracking-[0.18em] text-px-brass shadow-[1px_1px_0_rgba(92,61,30,0.15)]">
              AI STUDY COMPANION
            </span>
            <span className="hidden h-px w-10 bg-px-brass/40 sm:block" />
          </div>

          {/* Headline with smooth ink-bleed entrance */}
          <h1 className="mt-7 font-display text-[clamp(2.7rem,7.5vw,6.4rem)] font-[420] leading-[1.02] tracking-[-0.015em] text-px-ink">
            <span className="hero-line block overflow-hidden pb-1">
              <span className="hero-line-inner hero-anim block will-change-transform">
                Study smarter with Comtus.
              </span>
            </span>
            <span className="hero-line block overflow-hidden pb-2">
              <span className="hero-line-inner hero-anim block font-[480] italic text-[clamp(2.1rem,5.5vw,4.5rem)] text-px-brass will-change-transform">
                Rough thought, <span className="text-px-brass-deep font-semibold">polished.</span>
              </span>
            </span>
          </h1>

          {/* Subtitle / Brand Line */}
          <div className="hero-sub hero-anim mt-5 max-w-2xl text-balance text-[15.5px] leading-relaxed text-px-muted opacity-0 sm:text-[17px]">
            <p className="font-semibold text-px-ink mb-1">
              Study in a warmer light.
            </p>
            <p>
              Comtus helps you understand difficult lessons, organize your study materials, practice what you've learned, and prepare with confidence.
            </p>
          </div>

          {/* Learning Loop Pill Badges */}
          <div className="hero-sub hero-anim mt-4 flex flex-wrap items-center justify-center gap-2 text-[12px] text-px-muted opacity-0 font-mono">
            <span className="btn-ink-press flex items-center gap-1.5 border border-px-border bg-px-surface px-3 py-1 text-px-ink">
              <span className="h-1.5 w-1.5 bg-px-brass" /> Understand
            </span>
            <span className="btn-ink-press flex items-center gap-1.5 border border-px-border bg-px-surface px-3 py-1 text-px-ink">
              <span className="h-1.5 w-1.5 bg-px-moon" /> Organize
            </span>
            <span className="btn-ink-press flex items-center gap-1.5 border border-px-border bg-px-surface px-3 py-1 text-px-ink">
              <span className="h-1.5 w-1.5 bg-px-sage" /> Practice
            </span>
            <span className="btn-ink-press flex items-center gap-1.5 border border-px-border bg-px-surface px-3 py-1 text-px-ink">
              <span className="h-1.5 w-1.5 bg-px-candle" /> Master
            </span>
          </div>

          {/* CTA Row with PixelButton and Ink-Press Physics */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row sm:gap-4 w-full max-w-md">
            {onStartStudying ? (
              <PixelButton
                variant="brass"
                size="lg"
                onClick={onStartStudying}
                className="hero-cta hero-anim opacity-0 w-full sm:w-auto min-h-[50px] px-7 text-[15px] font-semibold tracking-wide text-white bg-px-brass border-px-brass shadow-[2px_2px_0_rgba(92,61,30,0.3),inset_1px_1px_0_rgba(255,255,255,0.4)]"
                rightIcon={
                  <span className="flex h-6 w-6 items-center justify-center bg-black/15">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M1.5 9.5L9.5 1.5M9.5 1.5H3M9.5 1.5V8"
                        stroke="#FFFFFF"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                }
              >
                Open the Studio
              </PixelButton>
            ) : (
              <Link to="/studio" className="w-full sm:w-auto">
                <PixelButton
                  variant="brass"
                  size="lg"
                  className="hero-cta hero-anim opacity-0 w-full min-h-[50px] px-7 text-[15px] font-semibold tracking-wide text-white bg-px-brass border-px-brass shadow-[2px_2px_0_rgba(92,61,30,0.3),inset_1px_1px_0_rgba(255,255,255,0.4)]"
                  rightIcon={
                    <span className="flex h-6 w-6 items-center justify-center bg-black/15">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path
                          d="M1.5 9.5L9.5 1.5M9.5 1.5H3M9.5 1.5V8"
                          stroke="#FFFFFF"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  }
                >
                  Open the Studio
                </PixelButton>
              </Link>
            )}

            <PixelButton
              variant="ghost"
              size="lg"
              onClick={() => scrollToSection("#learning-loop")}
              className="hero-cta hero-anim opacity-0 w-full sm:w-auto min-h-[50px] border border-px-border bg-px-surface px-7 text-[15px] font-medium text-px-ink backdrop-blur-sm hover:border-px-brass/50 hover:bg-px-raised hover:text-px-brass"
            >
              Explore the Desk
            </PixelButton>
          </div>
        </div>

        {/* ── 16-Bit Cozy Pixel Desk Hero Scene Focal Piece ────────────── */}
        <div className="pixel-desk-hero-scene-wrap hero-anim relative z-10 mt-10 w-full max-w-4xl opacity-0">
          <PixelDeskHeroScene />
        </div>
      </div>

      {/* Scroll Down Cue */}
      <div className="hero-cue hero-anim relative z-10 pb-8 pt-4 text-center opacity-0">
        <div className="label-mono inline-flex flex-col items-center gap-2.5 opacity-80">
          <span className="text-[11px] font-mono tracking-widest text-px-muted">SCROLL TO EXPLORE</span>
          <span className="relative block h-9 w-px overflow-hidden bg-px-border">
            <span className="absolute left-0 top-0 h-3 w-px animate-[cue-drop_2.2s_var(--ease-house-inout)_infinite] bg-px-brass" />
          </span>
        </div>
      </div>

      <style>{`@keyframes cue-drop { 0% { transform: translateY(-100%);} 55% { transform: translateY(260%);} 100% { transform: translateY(260%);} }`}</style>
    </section>
  );
}
