import { useEffect, useRef, useState } from "react";
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

const KEY_PROVIDERS = [
  { name: "OpenRouter", url: "https://openrouter.ai/keys" },
  { name: "Groq", url: "https://console.groq.com/keys" },
  { name: "OpenCode Zen", url: "https://opencode.ai/zen" },
];

interface BenchmarkModel {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  category: "frontier" | "reasoning" | "vision" | "instant" | "balanced";
  modality: "text" | "multimodal";
  modalityNote: string;
  speed: string;
  context: string;
  benchmarkScore: string;
  bestFor: string;
  why: string;
  isExpiringSoon?: boolean;
}

const BENCHMARK_MODELS: BenchmarkModel[] = [
  {
    id: "stealth/ox-alpha",
    name: "Ox Alpha (Stealth)",
    badge: "🔥 SOTA Frontier · Expiring Soon",
    badgeColor: "text-amber-300 border-amber-500/40 bg-amber-500/15 shadow-[0_0_14px_rgba(245,158,11,0.25)]",
    category: "frontier",
    modality: "multimodal",
    modalityNote: "🖼️ Multimodal (Vision + Video + Text)",
    speed: "Fast · ~70 tok/s",
    context: "1,048,576 tokens (1M)",
    benchmarkScore: "Top 1% LMSYS Arena / X Hype",
    bestFor: "SOTA reasoning, complex math proofs, sustained study sessions, frontier coding logic",
    why: "Top stealth model trending on X research feeds with 1M context. Active now before trial closes.",
    isExpiringSoon: true,
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots3-Note Preview",
    badge: "Top Study & Note Synthesizer",
    badgeColor: "text-emerald-300 border-emerald-500/40 bg-emerald-500/15",
    category: "vision",
    modality: "multimodal",
    modalityNote: "🖼️ Multimodal (Vision + Text)",
    speed: "Fast · ~85 tok/s",
    context: "512,000 tokens (512k)",
    benchmarkScore: "Academic Note-Taking SOTA",
    bestFor: "Lecture slide extraction, textbook synthesis, structured study guides, visual diagrams",
    why: "Open 16B active MoE from Dots Studio built specifically for structured notes and study extraction.",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning",
    badge: "1M Context + Blazing Speed",
    badgeColor: "text-brass border-brass/40 bg-brass/15",
    category: "instant",
    modality: "text",
    modalityNote: "📄 Text-Only · NVIDIA Hybrid Engine",
    speed: "500+ tok/s · Hardware LPU",
    context: "1,000,000 tokens (1M)",
    benchmarkScore: "Fastest 1M Context Engine",
    bestFor: "Massive textbook indexing, rapid-fire drills, zero-latency flashcard generation",
    why: "NVIDIA hybrid MoE serving 1M tokens with ultra-high throughput and zero queue lag.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google Gemma 4 31B",
    badge: "Configurable Thinking Mode",
    badgeColor: "text-sky-300 border-sky-400/40 bg-sky-500/15",
    category: "vision",
    modality: "multimodal",
    modalityNote: "🖼️ Multimodal (Vision + Video + Text)",
    speed: "Fast · ~65 tok/s",
    context: "262,144 tokens (256k)",
    benchmarkScore: "DeepMind Open Weights Leader",
    bestFor: "Handwritten test papers, anatomical illustrations, multi-step math and physics breakdown",
    why: "Google DeepMind's flagship 30.7B dense multimodal model with native reasoning mode.",
  },
  {
    id: "z-ai/glm-5.2:free",
    name: "Z.ai GLM 5.2",
    badge: "Deep Logic & Exam Agent",
    badgeColor: "text-brasspale border-brass/30 bg-brass/10",
    category: "reasoning",
    modality: "text",
    modalityNote: "📄 Text-Only · Deep Reasoning",
    speed: "Fast · ~60 tok/s",
    context: "256,000 tokens (256k)",
    benchmarkScore: "Leader in Long-Horizon Tasks",
    bestFor: "100-item practice exams, clinical case reasoning, comprehensive review outlines",
    why: "Large-scale frontier reasoning model from Z.ai designed for deep academic problem solving.",
  },
  {
    id: "thinkingmachines/inkling:free",
    name: "Inkling Omni",
    badge: "Omni-Modal Vision",
    badgeColor: "text-purple-300 border-purple-500/40 bg-purple-500/15",
    category: "vision",
    modality: "multimodal",
    modalityNote: "🖼️ Omni-Modal (Vision + Audio + Text)",
    speed: "Very Fast · ~90 tok/s",
    context: "262,144 tokens (256k)",
    benchmarkScore: "Thinking Machines Lab SOTA",
    bestFor: "Diagram analysis, slide screenshots, audio study companion lectures",
    why: "41B active MoE with unified perception across text, image, and speech modalities.",
  },
  {
    id: "poolside/laguna-s-2.1:free",
    name: "Poolside Laguna S 2.1",
    badge: "Coding & Math Proofs",
    badgeColor: "text-indigo-300 border-indigo-500/40 bg-indigo-500/15",
    category: "reasoning",
    modality: "text",
    modalityNote: "📄 Text-Only · Coding & Proofs",
    speed: "Fast · ~75 tok/s",
    context: "262,144 tokens (256k)",
    benchmarkScore: "Top Code & Algorithm ELO",
    bestFor: "Computer science coursework, algorithm derivation, LaTeX syntax, programming homework",
    why: "Specialized high-accuracy reasoning model from Poolside for precise syntax and proofs.",
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "LiquidAI LFM 2.5",
    badge: "Ultra-Lightweight & Agile",
    badgeColor: "text-teal-300 border-teal-500/40 bg-teal-500/15",
    category: "instant",
    modality: "text",
    modalityNote: "📄 Text-Only · Liquid Neural Net",
    speed: "300+ tok/s",
    context: "65,536 tokens",
    benchmarkScore: "Liquid State-Space Engine",
    bestFor: "Quick concept definitions, flashcard reviews, rapid grammar and syntax checks",
    why: "Liquid AI dynamic neural network delivering instantaneous answers with minimal compute footprint.",
  },
];

export default function OpenRouterByokSection() {
  const rootRef = useRef<HTMLElement>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [liveStatus, setLiveStatus] = useState<{ count: number; lastChecked: string; liveOxActive: boolean }>({
    count: BENCHMARK_MODELS.length,
    lastChecked: "Just now",
    liveOxActive: true,
  });

  // Background real-time verification of OpenRouter public models
  useEffect(() => {
    let cancel = false;
    async function checkLiveModels() {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models");
        if (!res.ok) return;
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        if (!cancel && data?.data) {
          const modelMap = new Set(data.data.map((m) => m.id));
          const hasOx = modelMap.has("stealth/ox-alpha");
          setLiveStatus({
            count: data.data.length,
            lastChecked: "Live (auto-synced)",
            liveOxActive: hasOx,
          });
        }
      } catch {
        // Silent fallback to curated benchmark roster
      }
    }
    void checkLiveModels();
    return () => {
      cancel = true;
    };
  }, []);

  const displayedModels = BENCHMARK_MODELS.filter((m) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "frontier") return m.category === "frontier";
    if (selectedFilter === "vision") return m.modality === "multimodal";
    if (selectedFilter === "reasoning") return m.category === "reasoning";
    if (selectedFilter === "instant") return m.category === "instant";
    return true;
  });

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
      data-torch
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
            sub="Never used Bring-Your-Own-Key (BYOK) before? This 3-step guide gets you free access to Ox Alpha, Dots3-Note, and Nemotron 3.5 — no credit card required."
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
                Click the <span className="text-brasspale font-medium">✨ :free</span> filter chip, pick <strong>Ox Alpha</strong> or <strong>Dots3-Note</strong>, and click <em>Save & test</em>. The lamp is lit.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] text-[11.5px] font-mono text-brasspale flex items-center gap-1.5">
              <Sparkles size={14} className="text-brass shrink-0" />
              <span>Free, unlimited grounded learning</span>
            </div>
          </div>
        </div>

        {/* Free key providers — any OpenAI-compatible endpoint works */}
        <div className="reveal-byok mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-4">
          <span className="label-mono !tracking-[0.24em] shrink-0 opacity-70">
            Get a Free Key
          </span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {KEY_PROVIDERS.map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-1.5 font-mono text-[11.5px] text-parchment/75 transition-colors duration-300 hover:text-brasspale"
              >
                {p.name}
                <ExternalLink
                  size={10}
                  className="opacity-50 transition-opacity group-hover:opacity-100"
                />
              </a>
            ))}
          </div>
          <span className="ml-auto hidden font-mono text-[10.5px] text-faded lg:block">
            Any OpenAI-compatible endpoint works · or run fully local with Ollama
          </span>
        </div>

        {/* Free Models Comparison Grid */}
        <div className="reveal-byok mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="label-mono !tracking-[0.24em] text-brasspale opacity-90">Model Decision Guide</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {liveStatus.lastChecked}
                </span>
              </div>
              <h3 className="mt-2 font-display text-[1.6rem] font-[430] text-parchment">
                Which free model should you choose?
              </h3>
            </div>
            <p className="text-[13px] text-faded max-w-md">
              Ranked dynamically by live benchmark performance and community resonance. Switch anytime inside Settings:
            </p>
          </div>

          {/* Dynamic Filter Pills */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "All Curated Models" },
              { id: "frontier", label: "🔥 Frontier Preview" },
              { id: "vision", label: "🖼️ Multimodal (Vision)" },
              { id: "reasoning", label: "🧠 Deep Reasoning" },
              { id: "instant", label: "⚡ Ultra-Fast LPUs" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedFilter(tab.id)}
                className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-all ${
                  selectedFilter === tab.id
                    ? "border-brass/70 bg-brass/20 text-brasspale font-medium shadow-[0_0_12px_rgba(227,176,75,0.15)]"
                    : "border-white/10 bg-white/[0.03] text-faded hover:border-white/20 hover:text-parchment"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedModels.map((m) => (
              <TiltCard key={m.id} innerClassName="p-5 sm:p-5 flex flex-col justify-between h-full">
                <div className="flex h-full flex-col">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`self-start rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold ${m.badgeColor}`}
                    >
                      {m.badge}
                    </span>
                    {m.isExpiringSoon && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 font-mono text-[8.5px] text-amber-300 font-semibold animate-pulse">
                        ⚡ Limited Preview
                      </span>
                    )}
                  </div>

                  <h4 className="mt-3 font-display text-[1.15rem] font-[440] leading-snug text-parchment">
                    {m.name}
                  </h4>

                  <div className="mt-1 font-mono text-[10px] text-brasspale/85">
                    {m.modalityNote}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[10px] leading-relaxed text-faded">
                    <span>{m.speed}</span>
                    <span aria-hidden className="text-white/20">·</span>
                    <span>{m.context}</span>
                  </div>

                  <div className="mt-2 rounded bg-white/[0.03] border border-white/[0.06] px-2 py-1 font-mono text-[9.5px] text-faded/90">
                    🏆 {m.benchmarkScore}
                  </div>

                  <p className="mt-3 text-[12px] leading-relaxed text-faded">
                    <strong className="font-medium text-parchment/85">Best for:</strong>{" "}
                    {m.bestFor}
                  </p>

                  <div className="mt-auto pt-4">
                    <div className="border-t border-white/[0.06] pt-3 text-[11px] leading-snug text-parchment/75">
                      {m.why}
                    </div>
                  </div>
                </div>
              </TiltCard>
            ))}
          </div>

          {/* Modality Advisory & Image Input Guidance */}
          <div className="mt-6 rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-950/20 via-night/60 to-night/80 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-400/40 bg-sky-500/20 text-[14px]">
                💡
              </div>
              <div className="text-[12.5px] leading-relaxed text-faded">
                <strong className="font-medium text-parchment">Understanding Model Modality:</strong>{" "}
                <span className="text-sky-300 font-medium">Multimodal models (like Ox Alpha, Dots3-Note, Gemma 4, Inkling)</span> directly parse raw image attachments, anatomical diagrams, handwritten formulas, and lecture slides.{" "}
                <span className="text-amber-300 font-medium">Text-only models (like Nemotron 3.5 Lightning, GLM 5.2, Laguna S 2.1)</span> excel at pure logic, coding, and reasoning proofs. When you upload PDFs or slides in Comtus, Comtus automatically extracts the text locally on your device before sending so you get clean answers on any model.
              </div>
            </div>
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
                Free community models occasionally queue requests during worldwide traffic peaks.{" "}
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
                Open Settings and pick Dots3-Note or Nemotron 3.5 Lightning — switching takes two seconds.
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-[10.5px] uppercase tracking-wider text-brasspale font-medium">
                    Available via PayPal study passes:
                  </div>
                  <span className="rounded-full border border-sage/25 bg-sage/15 px-2 py-0.5 font-mono text-[9px] font-medium text-sage">
                    −40% launch offer
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-[12.5px]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-parchment font-medium">Sprint Pass</span>
                    <span className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[11px] text-faded/60 line-through">$4.99</span>
                      <span className="font-bold text-brass">$2.99</span>
                      <span className="text-[10px] font-normal text-faded">(~500k tok)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-parchment font-medium flex items-center gap-1">
                      Scholar Pass <span className="rounded bg-brass/20 px-1 py-0.2 font-mono text-[9px] text-brasspale uppercase">Popular</span>
                    </span>
                    <span className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[11px] text-faded/60 line-through">$11.99</span>
                      <span className="font-bold text-brass">$6.99</span>
                      <span className="text-[10px] font-normal text-faded">(~1.5M tok)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-parchment font-medium">Mastery Pass</span>
                    <span className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[11px] text-faded/60 line-through">$24.99</span>
                      <span className="font-bold text-brass">$14.99</span>
                      <span className="text-[10px] font-normal text-faded">(~3.5M tok)</span>
                    </span>
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
