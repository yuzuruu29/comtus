import { Link } from "react-router-dom";
import { scrollToSection } from "../lib/scroll";
import { FlameMark } from "./Nav";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.07]">
      <div className="mx-auto w-full max-w-6xl px-6 pt-16">
        <div className="flex flex-col justify-between gap-10 pb-12 md:flex-row md:items-start">
          <div>
            <div className="flex items-center gap-2.5">
              <FlameMark className="h-6 w-6" />
              <span className="font-display text-lg font-[470] tracking-[0.2em] text-parchment">
                COMTUS
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-faded">
              A thinking study companion. Rough thought, polished — one lamp, one
              desk, your own sources.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-14 gap-y-2.5" aria-label="Footer">
            {[
              ["The Method", "#method"],
              ["The Studio", "#studio"],
              ["Your Stack", "#stack"],
              ["Boards", "#boards"],
            ].map(([label, hash]) => (
              <button
                key={hash}
                onClick={() => scrollToSection(hash)}
                className="text-left font-mono text-[11px] uppercase tracking-[0.22em] text-faded transition-colors duration-300 hover:text-parchment"
              >
                {label}
              </button>
            ))}
            <Link
              to="/studio"
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-brasspale/80 transition-colors duration-300 hover:text-brasspale"
            >
              Open the studio
            </Link>
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/[0.06] py-6 font-mono text-[10.5px] uppercase tracking-[0.2em] text-faded/80 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Comtus — study in a warmer light</span>
          <span className="normal-case tracking-[0.12em]">
            Latin comptus — adorned, polished, refined
          </span>
        </div>
      </div>
      {/* Ghost wordmark */}
      <div
        className="pointer-events-none select-none whitespace-nowrap text-center font-display font-[500] leading-[0.78] text-transparent"
        style={{
          fontSize: "clamp(90px, 19vw, 300px)",
          WebkitTextStroke: "1px rgba(242,237,227,0.05)",
        }}
        aria-hidden
      >
        COMTUS
      </div>
    </footer>
  );
}
