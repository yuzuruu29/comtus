import { Link } from "react-router-dom";
import "./landing.css";

const FOOTNOTES = [
  ["BYOK Privacy", "Free models run on your own OpenRouter key, smarter Claude models on our hosted key via PayPal pass, or fully local with Ollama. Keys stay strictly on-device."],
  ["Local-first", "Sources, notebooks, and history live in your browser's IndexedDB. Nothing uploads to our servers."],
  ["Everywhere", "Runs in the browser or as an installable PWA / native desktop app across iOS, Android, macOS, and Windows."],
];

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-[clamp(7rem,16vh,11rem)]">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[110vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(227,176,75,0.10),rgba(42,54,84,0.14)_55%,transparent_75%)]" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <div className="label-mono justify-center opacity-70">
          <span className="h-px w-9 grad-lamp" />
          <span className="mx-4">The Desk Is Set</span>
          <span className="h-px w-9 grad-lamp" />
        </div>
        <h2 className="mt-7 font-display text-[clamp(2.6rem,6.5vw,5rem)] font-[390] leading-[1.03] text-parchment">
          Open the studio.{" "}
          <em className="font-[420] text-lamp">Think tonight.</em>
        </h2>
        <div className="mt-10 flex justify-center">
          <Link
            to="/studio"
            className="group flex items-center gap-2.5 rounded-full grad-lamp py-4 pl-8 pr-3 text-[15px] font-semibold text-night shadow-[0_12px_50px_rgba(227,176,75,0.25)] transition-shadow duration-500 hover:shadow-[0_16px_70px_rgba(227,176,75,0.4)] active:scale-[0.98]"
          >
            <span className="roll">
              <span>Open the studio</span>
              <span aria-hidden>Think tonight</span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
              <svg width="13" height="13" viewBox="0 0 11 11" fill="none">
                <path
                  d="M1.5 9.5L9.5 1.5M9.5 1.5H3M9.5 1.5V8"
                  stroke="#0B0F1A"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
          {FOOTNOTES.map(([tag, line]) => (
            <div key={tag} className="border-t border-white/[0.08] pt-4">
              <div className="label-mono !text-[10px] text-brass/80">{tag}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-faded">{line}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
