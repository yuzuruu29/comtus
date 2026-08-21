import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Key,
  Sparkles,
  Zap,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Crown,
  CheckCircle2,
} from "lucide-react";
import SectionHead from "./SectionHead";
import TiltCard from "./TiltCard";

gsap.registerPlugin(ScrollTrigger);

const FREE_MODELS = [
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1 (Free)",
    badge: "Deep Reasoning",
    badgeColor: "text-brasspale border-brass/30 bg-brass/10",
    speed: "Standard (~40 tok/s)",
    context: "64k tokens",
    bestFor: "Complex multi-step math, clinical reasoning, board exam logic",
    why: "Generates full visible chain-of-thought reasoning before answering.",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B (Free)",
    badge: "Most Balanced",
    badgeColor: "text-sage border-sage/30 bg-sage/10",
    speed: "Fast (~65 tok/s)",
    context: "128k tokens",
    bestFor: "100-item mock exams, comprehensive study guides, essay scoring",
    why: "State-of-the-art open weights with strong factual grounding.",
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash (Free)",
    badge: "Massive Context",
    badgeColor: "text-moon border-moon/30 bg-moon/10",
    speed: "Very Fast (~90 tok/s)",
    context: "1,000,000 tokens",
    bestFor: "Massive multi-chapter PDFs, full textbooks, semester slides",
    why: "Reads entire textbook libraries without truncating source text.",
  },
  {
    id: "llama-3.3-70b-versatile (Groq)",
    name: "Groq LPU (Free Tier)",
    badge: "500+ tok/s LPUs",
    badgeColor: "text-brass border-brass/40 bg-brass/15",
    speed: "Ultra-instant (~500+ tok/s)",
    context: "128k tokens",
    bestFor: "Rapid-fire flashcards, instantaneous chat, zero-latency drills",
    why: "Dedicated Groq tensor hardware with near-zero latency.",
  },
];

export default function OpenRouterByokSection() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-byok");
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
            delay: (i % 3) * 0.07,
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
      id="byok-guide"
      className="relative border-y border-white/[0.07] bg-night/80 py-[clamp(5.5rem,13vh,9.5rem)]"
    >
      {/* Subtle backdrop glow */}
      <div className="pointer-events-none absolute left-1/2 top-12 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-brass/[0.035] blur-[120px]" />

      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="reveal-byok">
          <SectionHead
            index="02"
            label="OpenRouter BYOK Guide"
            title={
              <>
                How to use <em className="font-[420] text-lamp">Free AI Models</em> in 60 seconds.
              </>
            }
            sub="Never used Bring-Your-Own-Key (BYOK) before? This 3-step guide gets you free access to DeepSeek R1, Llama 3.3 70B, and Gemini — no credit card required."
          />
        </div>

        {/* 3-Step Visual Setup Flow */}
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Step 1 */}
          <div className="reveal-byok group relative flex flex-col justify-between rounded-2xl border border-brass/30 bg-brass/[0.04] p-6 transition-all duration-300 hover:border-brass/50 hover:bg-brass/[0.07]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brass/40 bg-brass/15 font-mono text-[13px] font-bold text-brasspale">
                  1
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-sage bg-sage/10 border border-sage/25 px-2 py-0.5 rounded-full">
                  100% Free · No Card
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.3rem] font-[430] text-parchment">
                Get your Free Key
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-faded">
                Go to OpenRouter and sign in with Google or GitHub in 5 seconds. No credit card or payment is ever asked.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08]">
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-brass/40 bg-brass/10 py-2.5 font-mono text-[12px] font-medium text-brasspale transition-colors hover:bg-brass/20"
              >
                <Key size={13} /> openrouter.ai/keys <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="reveal-byok group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/5 font-mono text-[13px] font-bold text-parchment">
                  2
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-faded bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  On-Device Storage
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.3rem] font-[430] text-parchment">
                Paste in Comtus Settings
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-faded">
                In Comtus, open <strong>Settings (⚙️)</strong> in the top header, select <strong>OpenRouter (BYOK)</strong>, and paste your key starting with <code className="text-brasspale text-[11.5px]">sk-or-v1-...</code>.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] text-[11.5px] font-mono text-faded flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-sage shrink-0" />
              <span>Key stays local on your machine</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="reveal-byok group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/5 font-mono text-[13px] font-bold text-parchment">
                  3
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-brasspale bg-brass/10 border border-brass/25 px-2 py-0.5 rounded-full">
                  Ready to Study
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.3rem] font-[430] text-parchment">
                Pick a Free Model & Save
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-faded">
                Click the <span className="text-brasspale font-medium">✨ :free</span> filter chip, pick <strong>DeepSeek R1</strong> or <strong>Llama 3.3</strong>, and click <em>Save & test</em>. The lamp is lit.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] text-[11.5px] font-mono text-brasspale flex items-center gap-1.5">
              <Sparkles size={14} className="text-brass shrink-0" />
              <span>Free, unlimited grounded learning</span>
            </div>
          </div>
        </div>

        {/* Free Models Comparison Grid */}
        <div className="reveal-byok mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <div className="label-mono !tracking-[0.24em] text-brasspale opacity-90">Model Decision Guide</div>
              <h3 className="mt-2 font-display text-[1.6rem] font-[430] text-parchment">
                Which free model should you choose?
              </h3>
            </div>
            <p className="text-[13px] text-faded max-w-md">
              Comtus automatically syncs the latest free models in real-time. Here is how to pick the right one for your study task:
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FREE_MODELS.map((m) => (
              <TiltCard key={m.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${m.badgeColor}`}>
                      {m.badge}
                    </span>
                    <span className="font-mono text-[10px] text-faded">{m.speed}</span>
                  </div>

                  <h4 className="mt-3 font-display text-[1.15rem] font-[440] text-parchment">
                    {m.name}
                  </h4>

                  <p className="mt-2 text-[12px] leading-relaxed text-faded">
                    <strong>Best for:</strong> {m.bestFor}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] text-[11.5px] text-parchment/75 leading-snug">
                  {m.why}
                </div>
              </TiltCard>
            ))}
          </div>
        </div>

        {/* Troubleshooting & Unresponsive Models Guide (Prevent User Scare) */}
        <div className="reveal-byok mt-12 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brass/30 bg-brass/10">
              <AlertTriangle size={15} className="text-brass" />
            </span>
            <div className="max-w-2xl">
              <h3 className="font-display text-[1.45rem] font-[430] leading-snug text-parchment">
                What if a free model is slow or unresponsive?
              </h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-faded">
                Free community models (like DeepSeek R1) occasionally queue requests during worldwide traffic peaks.{" "}
                <strong className="font-[560] text-parchment/90">Don't panic — your study data is 100% safe.</strong>{" "}
                If an endpoint stalls, two quick fixes:
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-night/60 p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-parchment">
                <RefreshCw size={13} className="shrink-0 text-brass" /> Switch free model
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-faded">
                Open Settings and pick Llama 3.3 70B or Gemini Flash — switching takes two seconds.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-night/60 p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-parchment">
                <Zap size={13} className="shrink-0 text-sage" /> Use Groq fast free
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-faded">
                Groq's dedicated LPUs serve 500+ tok/s with virtually zero queue latency.
              </p>
            </div>
          </div>
        </div>

        {/* Exclusive Anthropic Smarter Tier & PPT / Slideshow Maker Feature Callout */}
        <div className="reveal-byok mt-14 overflow-hidden rounded-3xl border border-brass/50 bg-gradient-to-b from-brass/[0.1] to-night/90 p-7 sm:p-10 shadow-[0_12px_40px_rgba(227,176,75,0.08)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass/20 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-brasspale font-medium">
                  <Crown size={12} className="text-brass" /> Smarter Models Exclusive
                </span>
                <span className="font-mono text-[11px] text-faded">Claude Opus 5 & Sonnet 5</span>
              </div>

              <h3 className="font-display text-[1.85rem] sm:text-[2.2rem] font-[420] text-parchment leading-tight">
                PPT Maker & Interactive Slideshows.
              </h3>

              <p className="text-[14.5px] leading-relaxed text-faded max-w-xl">
                Turn entire textbooks, medical chapters, and lecture notes into structured <strong>presentation decks with speaker notes</strong> and an <strong>interactive fullscreen slide viewer</strong>. Exclusively powered by Claude Opus 5 & Sonnet 5 for unmatched structural reasoning.
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                {["Structured Deck Outlines", "Presenter Speaker Notes", "Interactive Slide Deck Viewer", "Export to PowerPoint / Markdown", "Adaptive Thinking"].map((f) => (
                  <span key={f} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-parchment/85">
                    <CheckCircle2 size={12} className="text-brass" /> {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-brass/30 bg-night/80 p-6 space-y-4">
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-brasspale font-medium">
                  Available via PayPal study passes:
                </div>
                <div className="mt-3 space-y-2 text-[12.5px]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-parchment font-medium">Sprint Pass</span>
                    <span className="font-mono text-brass font-bold">$2.99 USD (~500k tok)</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-parchment font-medium flex items-center gap-1">
                      Scholar Pass <span className="rounded bg-brass/20 px-1 py-0.2 font-mono text-[9px] text-brasspale uppercase">Popular</span>
                    </span>
                    <span className="font-mono text-brass font-bold">$6.99 USD (~1.5M tok)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-parchment font-medium">Mastery Pass</span>
                    <span className="font-mono text-brass font-bold">$14.99 USD (~3.5M tok)</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.08] text-[11px] text-faded leading-snug">
                Anthropic BYOK is disabled for simplicity. Pay directly through PayPal inside Comtus Settings to activate instant Claude access.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
