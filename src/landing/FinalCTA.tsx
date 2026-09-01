import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

const FOOTNOTES = [
  ["BYOK Privacy", "Free models run on your own OpenRouter key, smarter Claude models on our hosted key via PayPal pass, or fully local with Ollama. Keys stay strictly on-device."],
  ["Local-first", "Sources, notebooks, and history live in your browser's IndexedDB. Nothing uploads to our servers."],
  ["Everywhere", "Runs in the browser or as an installable PWA / native desktop app across iOS, Android, macOS, and Windows."],
];

export default function FinalCTA() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-final");
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
            duration: 0.85,
            ease: "power3.out",
            delay: i * 0.1,
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
      data-torch
      className="relative overflow-hidden py-[clamp(7rem,16vh,11rem)] bg-ground text-ink"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[110vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brasspale)_22%,transparent),color-mix(in_srgb,var(--brass)_14%,transparent)_55%,transparent_75%)]" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <div className="reveal-final flex items-center justify-center gap-3 text-brass">
          <span className="h-px w-9 bg-brass" />
          <span className="font-mono text-[11.5px] uppercase tracking-widest font-bold text-brass">The Desk Is Set</span>
          <span className="h-px w-9 bg-brass" />
        </div>
        <h2 className="reveal-final mt-7 font-display text-landing-statement font-[600] leading-[1.03] text-ink">
          Open the studio.{" "}
          <em className="font-[600] text-brass not-italic">Think tonight.</em>
        </h2>
        <div className="reveal-final mt-10 flex justify-center">
          <Link
            to="/studio"
            className="c8-btn text-[16px] py-3.5 px-8"
          >
            <span className="c8-line-reveal">
              <span className="c8-line-inner" data-text="Open the Studio">
                Open the Studio
              </span>
            </span>
            <div className="c8-arrow-wrap">
              <svg className="c8-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </div>
          </Link>
        </div>
        <div className="reveal-final mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
          {FOOTNOTES.map(([tag, line]) => (
            <div key={tag} className="border-t border-hairline pt-4">
              <div className="font-mono text-[11.5px] text-brass font-bold uppercase tracking-wider">{tag}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted font-normal">{line}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
