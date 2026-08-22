import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { scrollToSection } from "../lib/scroll";

const LINKS = [
  { label: "The Method", hash: "#method" },
  { label: "The Studio", hash: "#studio" },
  { label: "Your Stack", hash: "#stack" },
  { label: "Boards", hash: "#boards" },
];

/** Floating glass island nav — hides on scroll down, returns on scroll up.
 *  Mobile: hamburger morphs to an X; menu expands as a full glass overlay
 *  with staggered link reveals. */
export default function Nav({ ready }: { ready: boolean }) {
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
      { y: -28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", delay: 0.35, stagger: 0.06 },
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
        className="fixed inset-x-0 top-5 z-[100] mx-auto hidden w-max items-center gap-1 rounded-full border border-white/10 bg-night/55 py-2 pl-7 pr-2 backdrop-blur-xl opacity-0 md:flex"
      >
        <Link
          to="/"
          className="mr-5 flex items-center gap-2.5"
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
            onClick={() => go(l.hash)}
            className="group relative rounded-full px-4 py-2 text-[13px] font-medium text-faded transition-colors duration-300 hover:text-parchment"
          >
            {l.label}
            <span className="absolute inset-x-4 -bottom-px h-px origin-left scale-x-0 grad-lamp transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
          </button>
        ))}
        <Link
          to="/studio"
          className="group ml-3 flex items-center gap-2 rounded-full grad-lamp py-2 pl-5 pr-2 text-[13px] font-semibold text-night shadow-[0_0_0_0_rgba(227,176,75,0)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(227,176,75,0.28)] active:scale-[0.97]"
        >
          Open the studio
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-night/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path
                d="M1.5 9.5L9.5 1.5M9.5 1.5H3M9.5 1.5V8"
                stroke="#0B0F1A"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </Link>
      </header>

      {/* Mobile bar */}
      <header
        ref={mobileRef}
        className="fixed inset-x-4 top-[calc(1rem+var(--sat))] z-[100] flex items-center justify-between rounded-full border border-white/10 bg-night/60 py-2.5 pl-5 pr-2.5 backdrop-blur-xl opacity-0 md:hidden"
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
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 active:scale-95"
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
        className={`fixed inset-0 z-[90] flex flex-col justify-center bg-night/90 px-8 pb-[calc(2rem+var(--sab))] pt-[calc(4rem+var(--sat))] backdrop-blur-2xl transition-all duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {[...LINKS, { label: "Open the studio", hash: "/studio" }].map((l, i) => (
          <div key={l.label} className="overflow-hidden py-1">
            <button
              onClick={() =>
                l.hash.startsWith("/") ? (window.location.href = l.hash) : go(l.hash)
              }
              className={`font-display text-[2.4rem] font-[380] text-parchment transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 ${
                open ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
              }`}
              style={{ transitionDelay: open ? `${120 + i * 70}ms` : "0ms" }}
            >
              {l.label}
            </button>
          </div>
        ))}
        <div
          className={`label-mono mt-10 transition-opacity duration-700 ${
            open ? "opacity-70" : "opacity-0"
          }`}
          style={{ transitionDelay: open ? "420ms" : "0ms" }}
        >
          Rough thought, polished.
        </div>
      </div>
    </>
  );
}

export function FlameMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        d="M32 8 C 39 17, 44 23, 44 30 A 12 12 0 1 1 20 30 C 20 23, 25 17, 32 8 Z"
        fill="#E3B04B"
      />
      <path
        d="M32 19 C 35.5 23.5, 38 26.5, 38 30 A 6 6 0 1 1 26 30 C 26 26.5, 28.5 23.5, 32 19 Z"
        fill="#F0CE8C"
      />
    </svg>
  );
}
