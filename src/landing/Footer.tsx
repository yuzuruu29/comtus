import { Link } from "react-router-dom";
import { scrollToSection } from "../lib/scroll";
import { FlameMark } from "./Nav";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.07] bg-night/95">
      <div className="mx-auto w-full max-w-6xl px-6 pt-16">
        <div className="grid grid-cols-1 gap-10 pb-14 sm:grid-cols-2 lg:grid-cols-12">
          {/* Brand Info */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <FlameMark className="h-6 w-6" />
              <span className="font-display text-lg font-[470] tracking-[0.2em] text-parchment">
                COMTUS
              </span>
            </div>
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-faded">
              Your AI Study Companion. Turn difficult lessons, scattered notes, and rough ideas into knowledge you can actually understand and retain.
            </p>
            <div className="mt-5 font-mono text-[11px] text-brasspale/90">
              Rough thought, polished.
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="lg:col-span-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-parchment/90 font-semibold mb-4">
              Product
            </div>
            <ul className="space-y-2.5 text-[13px] text-faded font-mono">
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#learning-loop")}
                  className="hover:text-parchment transition-colors text-left"
                >
                  The Learning Loop
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#demo")}
                  className="hover:text-parchment transition-colors text-left"
                >
                  See in Action
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#use-cases")}
                  className="hover:text-parchment transition-colors text-left"
                >
                  Use Cases
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#why-comtus")}
                  className="hover:text-parchment transition-colors text-left"
                >
                  Why Comtus
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#studio")}
                  className="hover:text-parchment transition-colors text-left"
                >
                  The Studio Desk
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#desktop")}
                  className="hover:text-parchment transition-colors text-left"
                >
                  Desk App (macOS & Windows)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#byok-guide")}
                  className="hover:text-parchment transition-colors text-left"
                >
                  BYOK & Free Models
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#faq")}
                  className="hover:text-parchment transition-colors text-left"
                >
                  FAQ
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Company & Ethics */}
          <div className="lg:col-span-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-parchment/90 font-semibold mb-4">
              Company & Learning
            </div>
            <ul className="space-y-2.5 text-[13px] text-faded font-mono">
              <li>
                <Link to="/about" className="hover:text-parchment transition-colors">
                  About Comtus
                </Link>
              </li>
              <li>
                <Link to="/study-companion" className="hover:text-parchment transition-colors">
                  Study Companion Guide
                </Link>
              </li>
              <li>
                <Link to="/responsible-ai" className="hover:text-parchment transition-colors">
                  Responsible AI
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-parchment transition-colors">
                  Contact & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Action */}
          <div className="lg:col-span-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-parchment/90 font-semibold mb-4">
              Legal & Account
            </div>
            <ul className="space-y-2.5 text-[13px] text-faded font-mono">
              <li>
                <Link to="/privacy" className="hover:text-parchment transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-parchment transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li className="pt-2">
                <Link
                  to="/studio"
              className="inline-flex items-center gap-1 arcade-press border border-brass/30 bg-brass/[0.08] px-2 py-1 text-brasspale font-semibold"
                >
                  Start Studying →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.06] py-6 font-mono text-[10.5px] uppercase tracking-[0.2em] text-faded/80 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Comtus — Your AI Study Companion</span>
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
          WebkitTextStroke: "2px rgba(227,176,75,0.12)",
        }}
        aria-hidden
      >
        COMTUS
      </div>
    </footer>
  );
}
