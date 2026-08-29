import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { scrollToSection } from "../lib/scroll";
import { ComtusEmblem } from "../components/brand/ComtusLogo";
import { PIXEL_HOP } from "./pixelMotion";

const LINKS = [
  { label: "Console", hash: "#hero" },
  { label: "Power-Ups", hash: "#features" },
  { label: "Free Play", hash: "#byok-guide" },
  { label: "Help & FAQ", hash: "#faq" },
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
        className="fixed inset-x-0 top-5 z-[100] mx-auto hidden w-max items-center gap-1 border border-[rgba(4,74,179,0.18)] bg-white/95 py-2 pl-6 pr-2 backdrop-blur-xl opacity-0 md:flex rounded-full shadow-[0_4px_24px_rgba(4,74,179,0.1)]"
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
            className="h-6 w-6 rounded-full border border-[#044AB3]/30 shadow-[0_0_8px_rgba(4,74,179,0.2)] object-cover"
          />
          <span className="font-display text-[15px] font-[600] tracking-[0.14em] text-[#0B132B]">
            COMTUS
          </span>
        </Link>

        {LINKS.map((l) => (
          <button
            key={l.hash}
            type="button"
            onClick={() => go(l.hash)}
            className="group relative px-3 py-1.5 text-[12.5px] font-medium text-[#5A6A85] transition-colors duration-200 hover:text-[#044AB3] cursor-pointer"
          >
            {l.label}
            <span className="absolute inset-x-3 -bottom-px h-0.5 origin-left scale-x-0 bg-[#044AB3] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
          </button>
        ))}

        <div className="ml-2 flex items-center gap-2">
          {onStartStudying ? (
            <button
              type="button"
              onClick={onStartStudying}
              className="group flex items-center gap-2 rounded-full bg-[#044AB3] text-white py-1.5 pl-4 pr-2 text-[12px] font-medium shadow-[0_2px_12px_rgba(4,74,179,0.25)] hover:bg-[#033CA0] transition-all cursor-pointer"
            >
              <span>Start Studying</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                  <path
                    d="M1.5 9.5L9.5 1.5M9.5 1.5H3M9.5 1.5V8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>
          ) : (
            <Link
              to="/studio"
              className="group flex items-center gap-2 rounded-full bg-[#044AB3] text-white py-1.5 pl-4 pr-2 text-[12px] font-medium shadow-[0_2px_12px_rgba(4,74,179,0.25)] hover:bg-[#033CA0] transition-all cursor-pointer"
            >
              <span>Start Studying</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                  <path
                    d="M1.5 9.5L9.5 1.5M9.5 1.5H3M9.5 1.5V8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </Link>
          )}
        </div>
      </header>

      {/* Mobile bar */}
      <header
        ref={mobileRef}
        className="fixed inset-x-4 top-[calc(1rem+var(--sat))] z-[100] flex items-center justify-between border border-[rgba(4,74,179,0.18)] bg-white/95 py-2.5 pl-5 pr-2.5 backdrop-blur-xl opacity-0 md:hidden rounded-full shadow-md"
      >
        <Link to="/" className="flex items-center gap-2" aria-label="Comtus home">
          <img
            src="/app-icon.jpg"
            alt="Comtus Logo"
            className="h-5 w-5 rounded-full border border-[#044AB3]/30 shadow-[0_0_6px_rgba(4,74,179,0.2)] object-cover"
          />
          <span className="font-display text-sm font-[600] tracking-[0.14em] text-[#0B132B]">COMTUS</span>
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(4,74,179,0.2)] bg-[#044AB3]/5 text-[#044AB3] active:scale-95"
        >
          <span
            className={`absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 bg-[#044AB3] transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? "rotate-45" : "-translate-y-[3.5px]"
            }`}
          />
          <span
            className={`absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 bg-[#044AB3] transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? "-rotate-45" : "translate-y-[3.5px]"
            }`}
          />
        </button>
      </header>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-[90] flex flex-col justify-center bg-white/98 px-8 pb-[calc(2rem+var(--sab))] pt-[calc(4rem+var(--sat))] backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {[...LINKS, { label: "Start Studying", hash: "/studio" }].map((l, i) => (
          <div key={l.label} className="overflow-hidden py-1">
            <button
              onClick={() =>
                l.hash.startsWith("/") ? (window.location.href = l.hash) : go(l.hash)
              }
              className={`font-display text-[2rem] font-[480] text-px-ink transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 text-left ${
                open ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
              }`}
              style={{ transitionDelay: open ? `${100 + i * 50}ms` : "0ms" }}
            >
              {l.label}
            </button>
          </div>
        ))}
        <div
          className={`label-mono mt-8 transition-opacity duration-500 text-px-muted ${
            open ? "opacity-90" : "opacity-0"
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
