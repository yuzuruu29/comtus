import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { playProceduralSfx } from "../studio/companion/sfx";
import { Cpu, Database, GitBranch, Pulse, SealCheck } from "@phosphor-icons/react";

gsap.registerPlugin(ScrollTrigger);

interface TelemetryModule {
  id: string;
  code: string;
  tag: string;
  title: string;
  metric: string;
  metricLabel: string;
  detail: string;
  liveSnippet: string;
  icon: typeof SealCheck;
}

const MODULES: TelemetryModule[] = [
  {
    id: "citations",
    code: "MOD.01",
    tag: "Citation Engine",
    title: "Deterministic Page Anchoring",
    metric: "100%",
    metricLabel: "Page-level source fidelity",
    detail: "Every paragraph is bound to exact page coordinates in your textbooks, notes, and research PDFs.",
    liveSnippet: "Doc.pdf:p.42 §3.1 -> Source Anchor Verified (Score 0.998)",
    icon: SealCheck,
  },
  {
    id: "socratic",
    code: "MOD.02",
    tag: "Dialectic Engine",
    title: "Stepped Socratic Reasoning",
    metric: "0%",
    metricLabel: "Passive answer hallucination",
    detail: "Forces active cognitive recall through stepped question branches, diagnosing logical gaps.",
    liveSnippet: "Step 3/4: Premise Verified -> Probing Foundation Gap",
    icon: GitBranch,
  },
  {
    id: "privacy",
    code: "MOD.03",
    tag: "Data Sovereignty",
    title: "Local-First Vault Architecture",
    metric: "Offline",
    metricLabel: "IndexedDB + Dexie Storage",
    detail: "Your course notes and documents remain on your machine. Zero telemetry and zero cloud lock-in.",
    liveSnippet: "Local Vault: 100% On-Device · 0 KB Telemetry Sent",
    icon: Database,
  },
  {
    id: "routing",
    code: "MOD.04",
    tag: "Compute Infrastructure",
    title: "Multi-Model BYOK Routing",
    metric: "18ms",
    metricLabel: "Direct API dispatch latency",
    detail: "Seamlessly switch between Claude 3.7 Sonnet, DeepSeek R1, GPT-4o, or local Ollama with zero markup.",
    liveSnippet: "Direct Dispatch -> Claude 3.7 / DeepSeek R1 / Ollama Ready",
    icon: Cpu,
  },
];

export default function CognitiveTelemetryGrid() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Staggered Entrance
      gsap.fromTo(
        cardsRef.current,
        { opacity: 0, y: 32, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>, index: number) => {
    const card = cardsRef.current[index];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(4px)`;
  };

  const handlePointerLeave = (index: number) => {
    const card = cardsRef.current[index];
    if (!card) return;
    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
  };

  return (
    <div
      ref={rootRef}
      className="relative z-10 mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-12"
      aria-label="Cognitive Engine Telemetry Grid"
    >
      {/* Top Header Label */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brasspale opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brass" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] font-semibold text-brass">
            COMTUS · COGNITIVE TELEMETRY & SPECIFICATIONS
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11.5px] font-mono text-muted">
          <span className="flex items-center gap-1.5">
            <Pulse size={12} className="text-brass" />
            <span>Architecture: Local-First / BYOK</span>
          </span>
          <span className="hidden sm:inline text-brass/30">|</span>
          <span className="hidden sm:inline">Zero Vendor Lock-In</span>
        </div>
      </div>

      {/* 4-Column High-Density Telemetry Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((mod, i) => {
          const Icon = mod.icon;
          const isActive = activeModule === mod.id;

          return (
            <div
              key={mod.id}
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
              onPointerMove={(e) => handlePointerMove(e, i)}
              onPointerLeave={() => handlePointerLeave(i)}
              onMouseEnter={() => {
                setActiveModule(mod.id);
                try {
                  playProceduralSfx("click");
                } catch {
                  /* sfx mute */
                }
              }}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-300 backdrop-blur-md cursor-pointer ${
                isActive
                  ? "border-brass bg-surface shadow-[0_12px_36px_-6px_color-mix(in_srgb,var(--brass)_18%,transparent),0_0_24px_color-mix(in_srgb,var(--brasspale)_22%,transparent)]"
                  : "border-hairline bg-surface/80 hover:border-brass/50 hover:bg-surface shadow-sm"
              }`}
              style={
                {
                  "--mouse-x": "50%",
                  "--mouse-y": "50%",
                } as React.CSSProperties
              }
            >
              {/* Cursor Spotlight Glow Effect */}
              <div
                className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), color-mix(in srgb, var(--brasspale) 22%, transparent), transparent 70%)",
                }}
              />

              {/* Top Row: Code Badge & Category */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] font-bold tracking-wider text-brass bg-brass/10 px-2 py-0.5 rounded">
                    {mod.code}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-muted tracking-wide">
                    {mod.tag}
                  </span>
                </div>

                {/* Main Stat & Icon */}
                <div className="mt-5 flex items-baseline justify-between">
                  <div className="font-display text-[2rem] font-[600] tracking-tight text-ink group-hover:text-brass transition-colors">
                    {mod.metric}
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brass/10 text-brass group-hover:bg-brass group-hover:text-night transition-all duration-300">
                    <Icon size={18} />
                  </div>
                </div>

                <div className="mt-0.5 font-mono text-[11.5px] font-medium text-brass">
                  {mod.metricLabel}
                </div>

                <h3 className="mt-4 font-display text-[15px] font-[550] text-ink leading-snug">
                  {mod.title}
                </h3>

                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  {mod.detail}
                </p>
              </div>

              {/* Bottom Live Snippet Trace */}
              <div className="mt-6 border-t border-hairline pt-3">
                <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink bg-brass/[0.06] p-2 rounded-lg border border-hairline">
                  <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse shrink-0" />
                  <span className="truncate">{mod.liveSnippet}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
