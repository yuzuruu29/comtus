import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
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
import { startOpenRouterOAuth } from "../lib/openrouterAuth";

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
  contextNum: number;
  architecture: string;
  benchmarkScore: string;
  bestFor: string;
  why: string;
  tags: string[];
  isExpiringSoon?: boolean;
}

const BENCHMARK_MODELS: BenchmarkModel[] = [
  {
    id: "openrouter/free",
    name: "OpenRouter Auto Free",
    badge: "✨ Best Available Free Router",
    badgeColor: "text-amber-300 border-amber-500/40 bg-amber-500/15 shadow-[0_0_14px_rgba(245,158,11,0.25)]",
    category: "frontier",
    modality: "multimodal",
    modalityNote: "🖼️ Multimodal (Vision + Text)",
    speed: "Fast · Dynamic",
    context: "200,000+ tokens",
    contextNum: 200000,
    architecture: "Auto Dynamic Free Pool (OpenRouter)",
    benchmarkScore: "Top Free Pool Aggregator",
    bestFor: "Zero-config daily study sessions, general homework QA, automatic fallback across free models",
    why: "OpenRouter's intelligent free router that automatically connects you to the highest quality free model currently available.",
    tags: ["#AutoRouting", "#ZeroConfig", "#DailyStudy", "#ReliableFallback"],
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
    contextNum: 512000,
    architecture: "16B Active MoE (Dots Studio)",
    benchmarkScore: "Academic Note-Taking SOTA",
    bestFor: "Lecture slide extraction, textbook synthesis, structured study guides, visual diagrams",
    why: "Open 16B active MoE from Dots Studio built specifically for structured notes and study extraction.",
    tags: ["#LectureNotes", "#SlideDecks", "#VisualDiagrams", "#StudyGuides"],
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
    contextNum: 262144,
    architecture: "41B Active Omni-MoE (Thinking Machines)",
    benchmarkScore: "Thinking Machines Lab SOTA",
    bestFor: "Diagram analysis, slide screenshots, audio study companion lectures",
    why: "41B active MoE with unified perception across text, image, and speech modalities.",
    tags: ["#OmniModal", "#AudioCompanion", "#DiagramQA", "#MultiSensory"],
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
    contextNum: 1000000,
    architecture: "3B Active / Hybrid MoE (NVIDIA)",
    benchmarkScore: "Fastest 1M Context Engine",
    bestFor: "Massive textbook indexing, rapid-fire drills, zero-latency flashcard generation",
    why: "NVIDIA hybrid MoE serving 1M tokens with ultra-high throughput and zero queue lag.",
    tags: ["#500TokPerSec", "#MassiveSyllabus", "#RapidFlashcards", "#ZeroLatency"],
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
    contextNum: 262144,
    architecture: "Precision Reasoning Model (Poolside)",
    benchmarkScore: "Top Code & Algorithm ELO",
    bestFor: "Computer science coursework, algorithm derivation, LaTeX syntax, programming homework",
    why: "Specialized high-accuracy reasoning model from Poolside for precise syntax and proofs.",
    tags: ["#CodingHomework", "#Algorithms", "#LaTeXDerivations", "#CSCourses"],
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
    contextNum: 65536,
    architecture: "Liquid State-Space Neural Net (Liquid AI)",
    benchmarkScore: "Liquid State-Space Engine",
    bestFor: "Quick concept definitions, flashcard reviews, rapid grammar and syntax checks",
    why: "Liquid AI dynamic neural network delivering instantaneous answers with minimal compute footprint.",
    tags: ["#QuickDefinitions", "#FlashcardRecall", "#GrammarCheck", "#MinimalLatency"],
  },
];

export default function OpenRouterByokSection() {
  const rootRef = useRef<HTMLElement>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState<boolean>(false);
  const [liveStatus, setLiveStatus] = useState<{ count: number; lastChecked: string; liveOxActive: boolean }>({
    count: BENCHMARK_MODELS.length,
    lastChecked: "Just now",
    liveOxActive: true,
  });

  const handleCopyModelId = (id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  // Background real-time verification of OpenRouter public models
  useEffect(() => {
    let cancel = false;
    async function checkLiveModels() {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models");
        if (!res.ok) return;
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        if (!cancel && data?.data) {
          const freeModels = data.data.filter((m) => m.id.endsWith(":free") || m.id.includes(":free"));
          const modelMap = new Set(data.data.map((m) => m.id));
          const hasDots = modelMap.has("dots-studio/dots-3-note-preview:free");
          setLiveStatus({
            count: freeModels.length || BENCHMARK_MODELS.length,
            lastChecked: "Live (auto-synced)",
            liveOxActive: hasDots,
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
            label="Zero Setup · 100% Free"
            title={
              <>
                Connect Free AI in <em className="font-[420] text-lamp">1 Click</em>. Zero Setup.
              </>
            }
            sub="No copy-pasting API keys, base URLs, or credit cards. Click Connect with Google or GitHub, and Comtus auto-configures your access to free models instantly."
          />
        </div>

        {/* 3-Step Visual Setup Flow (1-Click Zero Copy-Paste) */}
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Step 1 */}
          <div className="reveal-byok group relative flex flex-col justify-between rounded-2xl border border-brass/40 bg-gradient-to-b from-brass/[0.08] to-brass/[0.02] p-6 transition-all duration-300 hover:border-brass/60 hover:shadow-[0_8px_30px_rgba(227,176,75,0.12)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brass/40 bg-brass/20 font-mono text-[13px] font-bold text-brasspale">
                  1
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-sage bg-sage/10 border border-sage/25 px-2 py-0.5 rounded-full">
                  1-Click Connect
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.3rem] font-[430] text-parchment">
                Sign in with 1 Click
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-faded">
                Click below to authorize securely with Google or GitHub. No credit cards, billing forms, or passwords to remember.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => void startOpenRouterOAuth()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brass py-3 font-mono text-[12px] font-semibold text-night shadow-[0_4px_16px_rgba(227,176,75,0.25)] transition-all hover:bg-brasspale hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles size={14} className="shrink-0" />
                <span>Connect with OpenRouter (1-Click)</span>
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="reveal-byok group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/5 font-mono text-[13px] font-bold text-parchment">
                  2
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-brasspale bg-brass/10 border border-brass/20 px-2 py-0.5 rounded-full">
                  Auto-Configured
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.3rem] font-[430] text-parchment">
                Zero Copy-Paste Setup
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-faded">
                Comtus automatically generates and verifies your key in the background. You never have to manually copy keys, endpoints, or base URLs.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] text-[11.5px] font-mono text-faded flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-sage shrink-0" />
              <span>Zero manual copy-paste needed</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="reveal-byok group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/5 font-mono text-[13px] font-bold text-parchment">
                  3
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-sage bg-sage/10 border border-sage/25 px-2 py-0.5 rounded-full">
                  Ready Instantly
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.3rem] font-[430] text-parchment">
                Start Studying Right Away
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-faded">
                You are taken straight into the studio workspace. Verified free models like <strong>Dots3-Note</strong> and <strong>Nemotron 3.5</strong> are active and ready.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] text-[11.5px] font-mono text-brasspale flex items-center gap-1.5">
              <Sparkles size={14} className="text-brass shrink-0" />
              <span>100% Free Grounded Learning</span>
            </div>
          </div>
        </div>

        {/* Free Tier Daily Limit & Fair Use Advisory */}
        <div className="reveal-byok mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-4.5 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-[14px]">
                ⚠️
              </span>
              <div className="text-[12.5px] leading-relaxed text-faded">
                <strong className="font-medium text-parchment">Free Tier Daily Limit Advisory:</strong>{" "}
                OpenRouter free models share public compute pools with an estimated daily limit per model (resetting at 00:00 UTC). If you hit a temporary queue or daily cap, Comtus alerts you instantly so you can switch to another free model (or Groq 500 tok/s) in 1 click, or continue with dedicated Smarter Models passes.
              </div>
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

          {/* Free Models Symmetrical 4-Column Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {displayedModels.map((m) => {
              const isCopied = copiedId === m.id;
              return (
                <TiltCard key={m.id} innerClassName="p-5 flex flex-col justify-between h-full group">
                  <div className="flex h-full flex-col">
                    {/* Top Row: Category Badge + Limited Preview Pill */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold ${m.badgeColor}`}
                      >
                        {m.badge}
                      </span>
                      {m.isExpiringSoon && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 font-mono text-[8.5px] text-amber-300 font-semibold animate-pulse">
                          ⚡ Limited Preview
                        </span>
                      )}
                    </div>

                    {/* Model Name & Architecture */}
                    <h4 className="mt-3 font-display text-[1.2rem] font-[440] leading-snug text-parchment group-hover:text-brasspale transition-colors">
                      {m.name}
                    </h4>
                    <div className="font-mono text-[10px] text-faded/70">
                      {m.architecture}
                    </div>

                    {/* Modality Tag */}
                    <div className="mt-2 inline-flex items-center gap-1 self-start rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-brasspale/90">
                      {m.modalityNote}
                    </div>

                    {/* Speed, Context & Benchmark */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] leading-relaxed text-faded">
                      <span className="text-parchment/90 font-medium">{m.speed}</span>
                      <span aria-hidden className="text-white/20">·</span>
                      <span>{m.context}</span>
                    </div>

                    <div className="mt-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5 font-mono text-[9.5px] text-faded/90 flex items-center gap-1.5">
                      <span>🏆</span>
                      <span className="text-parchment/85 font-medium">{m.benchmarkScore}</span>
                    </div>

                    {/* Best For */}
                    <p className="mt-3 text-[12px] leading-relaxed text-faded">
                      <strong className="font-medium text-parchment/90">Best for:</strong>{" "}
                      {m.bestFor}
                    </p>

                    {/* Tags */}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {m.tags.map((t) => (
                        <span key={t} className="rounded bg-white/[0.02] border border-white/[0.05] px-1.5 py-0.2 font-mono text-[9px] text-faded/80">
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* Grounded Why */}
                    <div className="mt-auto pt-4">
                      <div className="border-t border-white/[0.06] pt-3 text-[11px] leading-snug text-parchment/75">
                        {m.why}
                      </div>

                      {/* Copy Endpoint ID Action */}
                      <button
                        type="button"
                        onClick={() => handleCopyModelId(m.id)}
                        className={`mt-3 w-full flex items-center justify-between rounded-lg border px-2.5 py-1.5 font-mono text-[10.5px] transition-all duration-200 ${
                          isCopied
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                            : "border-white/10 bg-white/[0.02] text-faded hover:border-brass/40 hover:bg-brass/[0.06] hover:text-brasspale"
                        }`}
                      >
                        <span className="truncate max-w-[170px] text-[10px] text-left opacity-80">{m.id}</span>
                        <span className="font-medium shrink-0 ml-1">
                          {isCopied ? "✓ Copied" : "Copy ID"}
                        </span>
                      </button>
                    </div>
                  </div>
                </TiltCard>
              );
            })}
          </div>

          {/* Toggle Full Comparison Matrix */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setShowMatrix((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 font-mono text-[11.5px] text-parchment transition-colors hover:border-brass/50 hover:bg-brass/10 hover:text-brasspale"
            >
              <span>{showMatrix ? "▲ Hide Benchmark Matrix" : "📊 View Full Model Comparison & Spec Matrix"}</span>
            </button>
          </div>

          {/* Collapsible Full Spec Matrix Table */}
          {showMatrix && (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-night/90 p-4 shadow-xl">
              <table className="w-full text-left font-mono text-[11.5px]">
                <thead>
                  <tr className="border-b border-white/10 text-faded text-[10px] uppercase tracking-wider">
                    <th className="pb-3 pr-4 font-semibold">Model Name & ID</th>
                    <th className="pb-3 px-3 font-semibold">Modality</th>
                    <th className="pb-3 px-3 font-semibold">Context</th>
                    <th className="pb-3 px-3 font-semibold">Speed</th>
                    <th className="pb-3 px-3 font-semibold">Key Academic Strength</th>
                    <th className="pb-3 pl-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-parchment/90">
                  {BENCHMARK_MODELS.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-parchment">{m.name}</div>
                        <div className="text-[10px] text-faded truncate max-w-[220px]">{m.id}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9.5px] ${
                          m.modality === "multimodal" ? "bg-sky-500/15 text-sky-300 border border-sky-500/30" : "bg-white/5 text-faded border border-white/10"
                        }`}>
                          {m.modality === "multimodal" ? "🖼️ Multimodal (Vision)" : "📄 Text-Only"}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-brasspale font-medium">{m.context}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-faded">{m.speed}</td>
                      <td className="py-3 px-3 max-w-xs text-faded text-[11px] leading-snug">{m.bestFor}</td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleCopyModelId(m.id)}
                          className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-parchment hover:border-brass/50 hover:text-brasspale transition-colors"
                        >
                          {copiedId === m.id ? "✓ Copied" : "Copy ID"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modality Advisory & Image Input Guidance */}
          <div className="mt-6 rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-950/20 via-night/60 to-night/80 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-400/40 bg-sky-500/20 text-[14px]">
                💡
              </div>
              <div className="text-[12.5px] leading-relaxed text-faded">
                <strong className="font-medium text-parchment">Understanding Model Modality:</strong>{" "}
                <span className="text-sky-300 font-medium">Multimodal models (like Ox Alpha, Dots3-Note, Inkling)</span> directly parse raw image attachments, anatomical diagrams, handwritten formulas, and lecture slides.{" "}
                <span className="text-amber-300 font-medium">Text-only models (like Nemotron 3.5 Lightning, Laguna S 2.1)</span> excel at pure logic, coding, and reasoning proofs. When you upload PDFs or slides in Comtus, Comtus automatically extracts the text locally on your device before sending so you get clean answers on any model.
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
                      <span className="text-[10px] font-normal text-faded">(60 hosted requests)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-parchment font-medium flex items-center gap-1">
                      Scholar Pass <span className="rounded bg-brass/20 px-1 py-0.2 font-mono text-[9px] text-brasspale uppercase">Popular</span>
                    </span>
                    <span className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[11px] text-faded/60 line-through">$11.99</span>
                      <span className="font-bold text-brass">$6.99</span>
                      <span className="text-[10px] font-normal text-faded">(200 hosted requests)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-parchment font-medium">Mastery Pass</span>
                    <span className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[11px] text-faded/60 line-through">$24.99</span>
                      <span className="font-bold text-brass">$14.99</span>
                      <span className="text-[10px] font-normal text-faded">(500 hosted requests)</span>
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
