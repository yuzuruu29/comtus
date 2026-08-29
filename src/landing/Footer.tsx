import { Link } from "react-router-dom";
import { scrollToSection } from "../lib/scroll";
import { FlameMark } from "./Nav";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.12] bg-[#021B47] text-white">
      <div className="mx-auto w-full max-w-6xl px-6 pt-16">
        <div className="grid grid-cols-1 gap-10 pb-14 sm:grid-cols-2 lg:grid-cols-12">
          {/* Brand Info */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <FlameMark className="h-6 w-6 text-[#6FE3FF]" />
              <span className="font-display text-lg font-[600] tracking-[0.2em] text-white">
                COMTUS
              </span>
            </div>
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-[#94A3B8]">
              Your AI Study Companion. Turn difficult lessons, scattered notes, and rough ideas into knowledge you can actually understand and retain.
            </p>
            <div className="mt-5 font-mono text-[11px] text-[#6FE3FF] font-semibold">
              Rough thought, polished.
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="lg:col-span-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6FE3FF] font-semibold mb-4">
              Infrastructure & Engines
            </div>
            <ul className="space-y-2.5 text-[13px] text-[#94A3B8] font-mono">
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#hero")}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Cognitive Strings Canvas
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#foundations")}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Study Foundations & Pulse
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#byok-guide")}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Free AI Models & BYOK
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("#faq")}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Help & FAQ
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Company & Ethics */}
          <div className="lg:col-span-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6FE3FF] font-semibold mb-4">
              Company & Learning
            </div>
            <ul className="space-y-2.5 text-[13px] text-[#94A3B8] font-mono">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Comtus
                </Link>
              </li>
              <li>
                <Link to="/study-companion" className="hover:text-white transition-colors">
                  Study Companion Guide
                </Link>
              </li>
              <li>
                <Link to="/responsible-ai" className="hover:text-white transition-colors">
                  Responsible AI
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Action */}
          <div className="lg:col-span-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6FE3FF] font-semibold mb-4">
              Legal & Account
            </div>
            <ul className="space-y-2.5 text-[13px] text-[#94A3B8] font-mono">
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li className="pt-2">
                <Link
                  to="/studio"
                  className="inline-flex items-center gap-1 border border-white/20 bg-white/10 px-3 py-1.5 rounded text-white font-mono text-[12px] font-semibold hover:bg-white/20 transition-all"
                >
                  Start Studying →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.1] py-6 font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#94A3B8] sm:flex-row sm:items-center sm:justify-between">
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
          WebkitTextStroke: "2px rgba(255, 255, 255, 0.05)",
        }}
        aria-hidden
      >
        COMTUS
      </div>
    </footer>
  );
}
