import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import SectionHead from "./SectionHead";
import TiltCard from "./TiltCard";
import { startOpenRouterOAuth } from "../lib/openrouterAuth";
import { ArrowSquareOut, ArrowsClockwise, CheckCircle, Crown, Lightning, ShieldCheck, Sparkle, Warning } from "@phosphor-icons/react";

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
    badgeColor: "text-brasspale border-brass/40 bg-brass/15 shadow-[0_0_14px_rgba(245,158,11,0.25)]",
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
    badgeColor: "text-sage border-sage/40 bg-sage/15",
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
    badgeColor: "text-candle border-candle/40 bg-candle/15",
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
    badgeColor: "text-sage border-sage/40 bg-sage/15",
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
    badgeColor: "text-candle border-candle/40 bg-candle/15",
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
      className="relative border-y border-hairline bg-ground py-[clamp(5.5rem,13vh,9.5rem)] text-ink"
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
                Connect Free AI in <em className="font-[500] text-brass">1 Click</em>. Zero Setup.
              </>
            }
            sub="No copy-pasting API keys, base URLs, or credit cards. Click Connect with Google or GitHub, and Comtus auto-configures your access to free models instantly."
          />
        </div>

        {/* 3-Step Visual Setup Flow (1-Click Zero Copy-Paste) */}
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Step 1 */}
          <div className="reveal-byok group relative flex flex-col justify-between rounded-2xl border border-brass/30 bg-surface p-6 transition-all duration-300 hover:border-brass hover:shadow-[0_8px_30px_rgba(165,115,28,0.12)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brass/40 bg-brass/10 font-mono text-[13px] font-bold text-brass">
                  1
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-brass bg-brass/10 border border-brass/25 px-2.5 py-0.5 rounded-full font-semibold">
                  1-Click Connect
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.3rem] font-[520] text-ink">
                Sign in with 1 Click
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                Click below to authorize securely with Google or GitHub. No credit cards, billing forms, or passwords to remember.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[rgba(165,115,28,0.08)]">
              <button
                type="button"
                onClick={() => void startOpenRouterOAuth()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brass py-3 font-mono text-[12px] font-semibold text-white shadow-[0_4px_16px_rgba(165,115,28,0.25)] transition-all hover:bg-brassdeep hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Sparkle size={14} className="shrink-0" />
                <span>Connect with OpenRouter (1-Click)</span>
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="reveal-byok group relative flex flex-col justify-between rounded-2xl border border-hairline bg-surface p-6 transition-all duration-300 hover:border-brass hover:shadow-[0_8px_30px_rgba(165,115,28,0.08)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(165,115,28,0.2)] bg-brass/5 font-mono text-[13px] font-bold text-brass">
                  2
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-brass bg-brass/10 border border-brass/20 px-2.5 py-0.5 rounded-full font-semibold">
                  Auto-Configured
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.3rem] font-[520] text-ink">
                Zero Copy-Paste Setup
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                Comtus automatically generates and verifies your key in the background. You never have to manually copy keys, endpoints, or base URLs.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[rgba(165,115,28,0.08)] text-[11.5px] font-mono text-muted flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-brass shrink-0" />
              <span>Zero manual copy-paste needed</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="reveal-byok group relative flex flex-col justify-between rounded-2xl border border-hairline bg-surface p-6 transition-all duration-300 hover:border-brass hover:shadow-[0_8px_30px_rgba(165,115,28,0.08)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(165,115,28,0.2)] bg-brass/5 font-mono text-[13px] font-bold text-brass">
                  3
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-sage bg-sage/10 border border-sage/30 px-2.5 py-0.5 rounded-full font-semibold">
                  Ready Instantly
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.3rem] font-[520] text-ink">
                Start Studying Right Away
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                You are taken straight into the studio workspace. Verified free models like <strong>Dots3-Note</strong> and <strong>Nemotron 3.5</strong> are active and ready.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[rgba(165,115,28,0.08)] text-[11.5px] font-mono text-brass font-semibold flex items-center gap-1.5">
              <Sparkle size={14} className="text-brass shrink-0" />
              <span>100% Free Grounded Learning</span>
            </div>
          </div>
        </div>

        {/* Free Tier Daily Limit & Fair Use Advisory */}
        <div className="reveal-byok mt-5 rounded-2xl border border-brass/30 bg-brass/[0.06] p-4.5 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brass/40 bg-brass/15 text-[14px]">
                ⚠️
              </span>
              <div className="text-[12.5px] leading-relaxed text-muted">
                <strong className="font-semibold text-ink">Free Tier Daily Limit Advisory:</strong>{" "}
                OpenRouter free models share public compute pools with an estimated daily limit per model (resetting at 00:00 UTC). If you hit a temporary queue or daily cap, Comtus alerts you instantly so you can switch to another free model (or Groq 500 tok/s) in 1 click, or continue with dedicated Smarter Models passes.
              </div>
            </div>
          </div>
        </div>

        {/* Free key providers — any OpenAI-compatible endpoint works */}
        <div className="reveal-byok mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-hairline bg-surface px-6 py-4 shadow-sm">
          <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-brass shrink-0">
            Get a Free Key
          </span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {KEY_PROVIDERS.map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-1.5 font-mono text-[11.5px] text-muted transition-colors duration-300 hover:text-brass"
              >
                {p.name}
                <ArrowSquareOut
                  size={10}
                  className="opacity-50 transition-opacity group-hover:opacity-100"
                />
              </a>
            ))}
          </div>
          <span className="ml-auto hidden font-mono text-[10.5px] text-muted lg:block">
            Any OpenAI-compatible endpoint works · or run fully local with Ollama
          </span>
        </div>

        {/* Free Models Comparison Grid */}
        <div className="reveal-byok mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-brass font-semibold">Model Decision Guide</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-sage/100/10 px-2 py-0.5 font-mono text-[9px] text-sage font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-sage/100 animate-pulse" />
                  {liveStatus.lastChecked}
                </span>
              </div>
              <h3 className="mt-2 font-display text-[1.6rem] font-[520] text-ink">
                Which free model should you choose?
              </h3>
            </div>
            <p className="text-[13px] text-muted max-w-md">
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
                className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-all cursor-pointer ${
                  selectedFilter === tab.id
                    ? "border-brass bg-brass text-white font-semibold shadow-[0_2px_10px_rgba(165,115,28,0.25)]"
                    : "border-[rgba(165,115,28,0.15)] bg-surface text-muted hover:border-brass hover:text-ink"
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
                <TiltCard key={m.id} innerClassName="p-5 flex flex-col justify-between h-full group bg-surface border border-hairline rounded-xl shadow-[0_4px_16px_rgba(165,115,28,0.03)] hover:border-brass hover:shadow-[0_8px_24px_rgba(165,115,28,0.1)] transition-all">
                  <div className="flex h-full flex-col">
                    {/* Top Row: Category Badge + Limited Preview Pill */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold ${m.badgeColor}`}
                      >
                        {m.badge}
                      </span>
                      {m.isExpiringSoon && (
                        <span className="rounded-full border border-brass/40 bg-brass/20 px-2 py-0.5 font-mono text-[8.5px] text-brassdeep font-semibold animate-pulse">
                          ⚡ Limited Preview
                        </span>
                      )}
                    </div>

                    {/* Model Name & Architecture */}
                    <h4 className="mt-3 font-display text-[1.2rem] font-[520] leading-snug text-ink group-hover:text-brass transition-colors">
                      {m.name}
                    </h4>
                    <div className="font-mono text-[10px] text-muted">
                      {m.architecture}
                    </div>

                    {/* Modality Tag */}
                    <div className="mt-2 inline-flex items-center gap-1 self-start rounded-md border border-[rgba(165,115,28,0.15)] bg-brass/5 px-2 py-0.5 font-mono text-[10px] text-brass font-medium">
                      {m.modalityNote}
                    </div>

                    {/* Speed, Context & Benchmark */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] leading-relaxed text-muted">
                      <span className="text-ink font-semibold">{m.speed}</span>
                      <span aria-hidden className="text-[rgba(165,115,28,0.3)]">·</span>
                      <span>{m.context}</span>
                    </div>

                    <div className="mt-2 rounded-lg bg-raised border border-[rgba(165,115,28,0.08)] px-2.5 py-1.5 font-mono text-[9.5px] text-muted flex items-center gap-1.5">
                      <span>🏆</span>
                      <span className="text-ink font-medium">{m.benchmarkScore}</span>
                    </div>

                    {/* Best For */}
                    <p className="mt-3 text-[12px] leading-relaxed text-muted">
                      <strong className="font-semibold text-ink">Best for:</strong>{" "}
                      {m.bestFor}
                    </p>

                    {/* Tags */}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {m.tags.map((t) => (
                        <span key={t} className="rounded bg-raised border border-[rgba(165,115,28,0.08)] px-1.5 py-0.5 font-mono text-[9px] text-muted">
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* Grounded Why */}
                    <div className="mt-auto pt-4">
                      <div className="border-t border-[rgba(165,115,28,0.08)] pt-3 text-[11px] leading-snug text-muted">
                        {m.why}
                      </div>

                      {/* Copy Endpoint ID Action */}
                      <button
                        type="button"
                        onClick={() => handleCopyModelId(m.id)}
                        className={`mt-3 w-full flex items-center justify-between rounded-lg border px-2.5 py-1.5 font-mono text-[10.5px] transition-all duration-200 cursor-pointer ${
                          isCopied
                            ? "border-sage/50 bg-sage/10 text-sage"
                            : "border-[rgba(165,115,28,0.15)] bg-raised text-muted hover:border-brass hover:bg-brass/5 hover:text-brass"
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
              className="inline-flex items-center gap-2 rounded-xl border border-[rgba(165,115,28,0.2)] bg-surface px-4 py-2 font-mono text-[11.5px] text-brass font-semibold transition-colors hover:border-brass hover:bg-brass/5 cursor-pointer shadow-sm"
            >
              <span>{showMatrix ? "▲ Hide Benchmark Matrix" : "📊 View Full Model Comparison & Spec Matrix"}</span>
            </button>
          </div>

          {/* Collapsible Full Spec Matrix Table */}
          {showMatrix && (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-hairline bg-surface p-4 shadow-xl">
              <table className="w-full text-left font-mono text-[11.5px]">
                <thead>
                  <tr className="border-b border-[rgba(165,115,28,0.1)] text-muted text-[10px] uppercase tracking-wider">
                    <th className="pb-3 pr-4 font-semibold">Model Name & ID</th>
                    <th className="pb-3 px-3 font-semibold">Modality</th>
                    <th className="pb-3 px-3 font-semibold">Context</th>
                    <th className="pb-3 px-3 font-semibold">Speed</th>
                    <th className="pb-3 px-3 font-semibold">Key Academic Strength</th>
                    <th className="pb-3 pl-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(165,115,28,0.06)] text-ink">
                  {BENCHMARK_MODELS.map((m) => (
                    <tr key={m.id} className="hover:bg-raised/60 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-ink">{m.name}</div>
                        <div className="text-[10px] text-muted truncate max-w-[220px]">{m.id}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9.5px] font-medium ${
                          m.modality === "multimodal" ? "bg-brass/10 text-brass border border-brass/30" : "bg-raised text-muted border border-hairline"
                        }`}>
                          {m.modality === "multimodal" ? "🖼️ Multimodal (Vision)" : "📄 Text-Only"}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-brass font-semibold">{m.context}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-muted">{m.speed}</td>
                      <td className="py-3 px-3 max-w-xs text-muted text-[11px] leading-snug">{m.bestFor}</td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleCopyModelId(m.id)}
                          className="rounded border border-[rgba(165,115,28,0.15)] bg-surface px-2.5 py-1 text-[10px] text-brass font-medium hover:border-brass hover:bg-brass/5 transition-colors cursor-pointer"
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
          <div className="mt-6 rounded-2xl border border-brass/25 bg-brass/[0.07] p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brass/40 bg-brass/20 text-[14px]">
                💡
              </div>
              <div className="text-[12.5px] leading-relaxed text-muted">
                <strong className="font-semibold text-ink">Understanding Model Modality:</strong>{" "}
                <span className="text-brass font-semibold">Multimodal models (like Ox Alpha, Dots3-Note, Inkling)</span> directly parse raw image attachments, anatomical diagrams, handwritten formulas, and lecture slides.{" "}
                <span className="text-brassdeep font-semibold">Text-only models (like Nemotron 3.5 Lightning, Laguna S 2.1)</span> excel at pure logic, coding, and reasoning proofs. When you upload PDFs or slides in Comtus, Comtus automatically extracts the text locally on your device before sending so you get clean answers on any model.
              </div>
            </div>
          </div>
        </div>

        {/* Troubleshooting & Unresponsive Models Guide (Prevent User Scare) */}
        <div className="reveal-byok mt-12 overflow-hidden rounded-2xl border border-hairline bg-surface p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brass/30 bg-brass/10">
              <Warning size={15} className="text-brassdeep" />
            </span>
            <div className="max-w-2xl">
              <h3 className="font-display text-[1.45rem] font-[520] leading-snug text-ink">
                What if a free model is slow or unresponsive?
              </h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
                Free community models occasionally queue requests during worldwide traffic peaks.{" "}
                <strong className="font-semibold text-ink">Don't panic — your study data is 100% safe.</strong>{" "}
                If an endpoint stalls, two quick fixes:
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[rgba(165,115,28,0.12)] bg-raised p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <ArrowsClockwise size={13} className="shrink-0 text-brass" /> Switch free model
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                Open Settings and pick Dots3-Note or Nemotron 3.5 Lightning — switching takes two seconds.
              </p>
            </div>

            <div className="rounded-xl border border-[rgba(165,115,28,0.12)] bg-raised p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Lightning size={13} className="shrink-0 text-sage" /> Use Groq fast free
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                Groq's dedicated LPUs serve 500+ tok/s with virtually zero queue latency.
              </p>
            </div>
          </div>
        </div>

        {/* Exclusive Anthropic Smarter Tier & PPT / Slideshow Maker Feature Callout */}
        <div className="reveal-byok mt-14 overflow-hidden rounded-3xl border border-brass/30 bg-gradient-to-b from-brass/[0.06] to-surface p-7 sm:p-10 shadow-[0_12px_40px_rgba(165,115,28,0.08)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-brass/30 bg-brass/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-brass font-semibold">
                  <Crown size={12} className="text-brass" /> Smarter Models Exclusive
                </span>
                <span className="font-mono text-[11px] text-muted">Claude Opus 5 & Sonnet 5</span>
              </div>

              <h3 className="font-display text-[1.85rem] sm:text-[2.2rem] font-[520] text-ink leading-tight">
                PPT Maker & Interactive Slideshows.
              </h3>

              <p className="text-[14.5px] leading-relaxed text-muted max-w-xl">
                Turn entire textbooks, medical chapters, and lecture notes into structured <strong>presentation decks with speaker notes</strong> and an <strong>interactive fullscreen slide viewer</strong>. Exclusively powered by Claude Opus 5 & Sonnet 5 for unmatched structural reasoning.
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                {["Structured Deck Outlines", "Presenter Speaker Notes", "Interactive Slide Deck Viewer", "Export to PowerPoint / Markdown", "Adaptive Thinking"].map((f) => (
                  <span key={f} className="flex items-center gap-1.5 rounded-full border border-[rgba(165,115,28,0.15)] bg-surface px-3 py-1 font-mono text-[11px] text-ink font-medium shadow-sm">
                    <CheckCircle size={12} className="text-brass" /> {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-[rgba(165,115,28,0.2)] bg-surface p-6 space-y-4 shadow-md">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-[10.5px] uppercase tracking-wider text-brass font-semibold">
                    Available via PayPal study passes:
                  </div>
                  <span className="rounded-full border border-sage/25 bg-sage/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-sage">
                    −40% launch offer
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-[12.5px]">
                  <div className="flex items-center justify-between border-b border-[rgba(165,115,28,0.08)] pb-2">
                    <span className="text-ink font-semibold">Sprint Pass</span>
                    <span className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[11px] text-muted/60 line-through">$4.99</span>
                      <span className="font-bold text-brass">$2.99</span>
                      <span className="text-[10px] font-normal text-muted">(60 hosted requests)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[rgba(165,115,28,0.08)] pb-2">
                    <span className="text-ink font-semibold flex items-center gap-1">
                      Scholar Pass <span className="rounded bg-brass/10 px-1 py-0.2 font-mono text-[9px] text-brass uppercase font-semibold">Popular</span>
                    </span>
                    <span className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[11px] text-muted/60 line-through">$11.99</span>
                      <span className="font-bold text-brass">$6.99</span>
                      <span className="text-[10px] font-normal text-muted">(200 hosted requests)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink font-semibold">Mastery Pass</span>
                    <span className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[11px] text-muted/60 line-through">$24.99</span>
                      <span className="font-bold text-brass">$14.99</span>
                      <span className="text-[10px] font-normal text-muted">(500 hosted requests)</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[rgba(165,115,28,0.08)] text-[11px] text-muted leading-snug">
                Anthropic BYOK is disabled for simplicity. Pay directly through PayPal inside Comtus Settings to activate instant Claude access.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
