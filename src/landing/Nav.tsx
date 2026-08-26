import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { scrollToSection } from "../lib/scroll";
import { ComtusEmblem } from "../components/brand/ComtusLogo";
import ArcadeCta from "./ArcadeCta";
import { PIXEL_HOP } from "./pixelMotion";

const LINKS = [
  { label: "Learning Loop", hash: "#learning-loop" },
  { label: "Demo", hash: "#demo" },
  { label: "Use Cases", hash: "#use-cases" },
  { label: "Why Comtus", hash: "#why-comtus" },
  { label: "Features", hash: "#studio" },
  { label: "BYOK Guide", hash: "#byok-guide" },
  { label: "FAQ", hash: "#faq" },
];

/** Floating glass island nav — hides on scroll down, returns on scroll up.
 *  Mobile: hamburger morphs to an X; menu expands as a full glass overlay
 *  with staggered link reveals. */
export default function Nav({
  ready,
  onStartStudying,
}: {
  ready: boolean;
  onStartStudying?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const desktopRef = useRef<HTMLElement>(null);
  const mobileRef = useRef<HTMLElement>(null);
  const lastY = useRef(0);

  useEffect(() => {
    if (!ready) return;
    const targets = [desktopRef.current, mobileRef.current].filter(
      (el): el is HTMLElement => !!el,
    );
    if (targets.length === 0) return;
    gsap.fromTo(
      targets,
      { y: -24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, ease: PIXEL_HOP, delay: 0.28, stagger: 0.05 },
    );
    const el = desktopRef.current;
    if (!el) return;

    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > lastY.current && y > 140;
      gsap.to(el, {
        yPercent: goingDown ? -130 : 0,
        duration: 0.5,
        ease: "power3.out",
        overwrite: "auto",
      });
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ready]);

  const go = (hash: string) => {
    setOpen(false);
    // Let the overlay close before travelling.
    window.setTimeout(() => scrollToSection(hash), open ? 350 : 0);
  };

  return (
    <>
      <header
        ref={desktopRef}
        className="fixed inset-x-0 top-5 z-[100] mx-auto hidden w-max items-center gap-1 border-2 border-white/10 bg-night/70 py-2 pl-6 pr-2 backdrop-blur-xl opacity-0 md:flex arcade-press"
      >
        <Link
          to="/"
          className="mr-4 flex items-center gap-2.5"
          data-cursor
          aria-label="Comtus home"
        >
          <img
            src="/app-icon.jpg"
            alt="Comtus Logo"
            className="h-6 w-6 rounded-lg border border-brass/30 shadow-[0_0_12px_rgba(227,176,75,0.25)] object-cover"
          />
          <span className="font-display text-[15px] font-[480] tracking-[0.18em] text-parchment">
            COMTUS
          </span>
        </Link>

        {LINKS.map((l) => (
          <button
            key={l.hash}
            type="button"
            onClick={() => go(l.hash)}
            className="group relative px-3 py-1.5 text-[12px] font-medium text-faded transition-colors duration-300 hover:text-parchment cursor-pointer"
          >
            {l.label}
            <span className="absolute inset-x-3 -bottom-px h-px origin-left scale-x-0 grad-lamp transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
          </button>
        ))}

        <div className="ml-2 flex items-center gap-2">
          {onStartStudying ? (
            <ArcadeCta>
              <button
                type="button"
                onClick={onStartStudying}
                className="group flex items-center gap-1.5 arcade-press grad-lamp py-1.5 pl-4 pr-2 text-[12px] font-semibold text-night"
              >
                <span>Start Studying</span>
                <span className="flex h-6 w-6 items-center justify-center bg-night/15 transition-transform duration-300 group-hover:translate-x-0.5">
                  <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
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
            <ArcadeCta>
              <Link
                to="/studio"
                className="group flex items-center gap-1.5 arcade-press grad-lamp py-1.5 pl-4 pr-2 text-[12px] font-semibold text-night"
              >
                <span>Start Studying</span>
                <span className="flex h-6 w-6 items-center justify-center bg-night/15 transition-transform duration-300 group-hover:translate-x-0.5">
                  <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
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
        </div>
      </header>

      {/* Mobile bar */}
      <header
        ref={mobileRef}
        className="fixed inset-x-4 top-[calc(1rem+var(--sat))] z-[100] flex items-center justify-between border-2 border-white/10 bg-night/60 py-2.5 pl-5 pr-2.5 backdrop-blur-xl opacity-0 md:hidden arcade-press"
      >
        <Link to="/" className="flex items-center gap-2" aria-label="Comtus home">
          <img
            src="/app-icon.jpg"
            alt="Comtus Logo"
            className="h-5 w-5 rounded-md border border-brass/30 shadow-[0_0_8px_rgba(227,176,75,0.25)] object-cover"
          />
          <span className="font-display text-sm font-[480] tracking-[0.18em]">COMTUS</span>
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="relative flex h-11 w-11 items-center justify-center border border-white/10 bg-white/5 active:translate-x-px active:translate-y-px"
        >
          <span
            className={`absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 bg-parchment transition-all duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? "rotate-45" : "-translate-y-[3.5px]"
            }`}
          />
          <span
            className={`absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 bg-parchment transition-all duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? "-rotate-45" : "translate-y-[3.5px]"
            }`}
          />
        </button>
      </header>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-[90] flex flex-col justify-center bg-night/95 px-8 pb-[calc(2rem+var(--sab))] pt-[calc(4rem+var(--sat))] backdrop-blur-2xl transition-all duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {[...LINKS, { label: "Start Studying", hash: "/studio" }].map((l, i) => (
          <div key={l.label} className="overflow-hidden py-1">
            <button
              onClick={() =>
                l.hash.startsWith("/") ? (window.location.href = l.hash) : go(l.hash)
              }
              className={`font-display text-[2rem] font-[380] text-parchment transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 text-left ${
                open ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
              }`}
              style={{ transitionDelay: open ? `${100 + i * 50}ms` : "0ms" }}
            >
              {l.label}
            </button>
          </div>
        ))}
        <div
          className={`label-mono mt-8 transition-opacity duration-700 text-brasspale/90 ${
            open ? "opacity-70" : "opacity-0"
          }`}
          style={{ transitionDelay: open ? "420ms" : "0ms" }}
        >
          Your AI Study Companion · Rough thought, polished.
        </div>
      </div>
    </>
  );
}

export function FlameMark({ className = "h-6 w-6" }: { className?: string }) {
  return <ComtusEmblem size={24} className={className} />;
}
