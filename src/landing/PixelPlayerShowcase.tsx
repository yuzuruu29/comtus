import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Sparkle, BookOpen, Brain, Layers, CheckCircle2, ShieldCheck, ArrowRight, Star } from "lucide-react";
import "./pixel-player.css";

gsap.registerPlugin(ScrollTrigger);

// ── Types & Data ────────────────────────────────────────────────────────────

type ConsoleMode = "socratic" | "flashcards" | "proof" | "byok";

interface StudyCardData {
  id: string;
  title: string;
  desc: string;
  metric: string;
  tag: string;
  icon: typeof Sparkle;
  previewType: "socratic" | "cards" | "proof" | "byok" | "boards" | "cozy";
}

const STUDY_CARDS_LEFT: StudyCardData[] = [
  {
    id: "card-1",
    title: "SOCRATIC INQUIRY & ACTIVE RECALL",
    desc: "Master complex curricula through adaptive question trees and stepped dialectic probes, not passive text skimming.",
    metric: "Mastery Pass (98.4%) · 14,200+ Sessions",
    tag: "Active Recall",
    icon: Brain,
    previewType: "socratic",
  },
  {
    id: "card-2",
    title: "SMART FLASHCARDS & LEITNER DRILLS",
    desc: "Automated spaced repetition queue with 16-bit card flips, keyboard-only speed drills, and confidence weighting.",
    metric: "Retention Rate (94.2%) · 85,000+ Cards",
    tag: "Spaced Retention",
    icon: Layers,
    previewType: "cards",
  },
  {
    id: "card-3",
    title: "STEP-BY-STEP PROOF & MATH ENGINE",
    desc: "Rigorous step validation for calculus, physics, and logic derivations with instant error isolation on scratchpad.",
    metric: "Proof Accuracy (99.1%) · 42,000+ Steps",
    tag: "Symbolic Reasoning",
    icon: CheckCircle2,
    previewType: "proof",
  },
];

const STUDY_CARDS_RIGHT: StudyCardData[] = [
  {
    id: "card-4",
    title: "MULTI-MODEL BYOK WORKBENCH",
    desc: "Zero vendor lock-in. Switch between Claude 3.7 Sonnet, DeepSeek R1, GPT-4o, or run local models completely offline.",
    metric: "Privacy Verified (100%) · Local SQLite",
    tag: "Open Ecosystem",
    icon: ShieldCheck,
    previewType: "byok",
  },
  {
    id: "card-5",
    title: "CURRICULUM & BOARD BLUEPRINTS",
    desc: "Pre-calibrated mastery tracks tailored for USMLE, NCLEX, Bar Exam, CFA, and university STEM examinations.",
    metric: "Exam Readiness (96.7%) · 340+ Syllabi",
    tag: "Board Calibration",
    icon: BookOpen,
    previewType: "boards",
  },
  {
    id: "card-6",
    title: "16-BIT COZY SCHOLAR DESK",
    desc: "Draggable brass lamp companion, ambient lofi study soundscapes, and focus tracking on warm daylight parchment.",
    metric: "Delight Score (99.9%) · Offline-Safe",
    tag: "Focus Atmosphere",
    icon: Sparkle,
    previewType: "cozy",
  },
];

// ── Web Audio Synth (Tactile Retro Click) ────────────────────────────────────

function playRetroClick(freq = 440, type: OscillatorType = "square") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // Ignore audio errors if audio context blocked by browser
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function PixelPlayerShowcase() {
  const [activeMode, setActiveMode] = useState<ConsoleMode>("socratic");
  const [socraticChoice, setSocraticChoice] = useState<number | null>(null);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [activeModel, setActiveModel] = useState<string>("Claude 3.7 Sonnet");

  const containerRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  // 3D Tilt on Mouse Move (Desktop only)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!consoleRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = consoleRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = (-y / (rect.height / 2)) * 8;
    const rotateY = (x / (rect.width / 2)) * 8;
    consoleRef.current.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!consoleRef.current) return;
    consoleRef.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  }, []);

  // Controls Handlers
  const handleNextMode = useCallback(() => {
    playRetroClick(520, "triangle");
    const modes: ConsoleMode[] = ["socratic", "flashcards", "proof", "byok"];
    const nextIdx = (modes.indexOf(activeMode) + 1) % modes.length;
    setActiveMode(modes[nextIdx]);
    setSocraticChoice(null);
    setFlashcardFlipped(false);
  }, [activeMode]);

  const handlePrevMode = useCallback(() => {
    playRetroClick(380, "triangle");
    const modes: ConsoleMode[] = ["socratic", "flashcards", "proof", "byok"];
    const prevIdx = (modes.indexOf(activeMode) - 1 + modes.length) % modes.length;
    setActiveMode(modes[prevIdx]);
    setSocraticChoice(null);
    setFlashcardFlipped(false);
  }, [activeMode]);

  const handleActionButtonA = useCallback(() => {
    playRetroClick(660, "square");
    if (activeMode === "socratic") {
      setSocraticChoice((prev) => (prev === null ? 0 : (prev + 1) % 2));
    } else if (activeMode === "flashcards") {
      setFlashcardFlipped((prev) => !prev);
    } else if (activeMode === "byok") {
      const models = ["Claude 3.7 Sonnet", "DeepSeek R1", "GPT-4o", "Local Llama 3"];
      const next = (models.indexOf(activeModel) + 1) % models.length;
      setActiveModel(models[next]);
    }
  }, [activeMode, activeModel]);

  const handleActionButtonB = useCallback(() => {
    playRetroClick(330, "sine");
    if (activeMode === "flashcards") {
      setFlashcardFlipped((prev) => !prev);
    } else if (activeMode === "socratic") {
      setSocraticChoice(null);
    }
  }, [activeMode]);

  // GSAP ScrollTrigger Dual-Column Parallax
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      if (leftColRef.current && rightColRef.current && containerRef.current) {
        gsap.to(leftColRef.current, {
          y: "-45vh",
          ease: "none",
          scrollTrigger: {
            trigger: ".pps-gallery-section",
            start: "top top",
            end: "bottom bottom",
            scrub: 1.2,
          },
        });

        gsap.to(rightColRef.current, {
          y: "-75vh",
          ease: "none",
          scrollTrigger: {
            trigger: ".pps-gallery-section",
            start: "top top",
            end: "bottom bottom",
            scrub: 1.6,
          },
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="pixel-player-showcase" aria-label="Comtus Interactive Scholar Console Showcase">
      {/* ── 1. Hero Title & Floating Pixel Stickers ──────────────────────────── */}
      <div className="pps-hero-section">
        <div className="pps-subheader-pill">
          <Sparkle className="w-4 h-4 text-[#A5731C]" />
          <span>THE 16-BIT AI STUDY COMPANION IN</span>
        </div>

        <div className="pps-header-block">
          <h2 className="pps-heading-h1">
            DAYLIGHT PAPER <br />
            <span className="pps-highlight">&amp; PIXEL CRAFT</span>
          </h2>

          {/* Floating Pixel Scholar Sticker Sprites */}
          <div className="pps-sticker pps-sticker-lamp" title="16-Bit Banker's Lamp">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <path d="M18 6h12v4H18z" fill="#79510F" />
              <path d="M12 10h24v8H12z" fill="#4B8A5A" />
              <path d="M16 14h16v4H16z" fill="#78B084" />
              <path d="M22 18h4v16h-4z" fill="#A5731C" />
              <path d="M14 34h20v6H14z" fill="#79510F" />
              <path d="M10 40h28v4H10z" fill="#5C3D1E" />
            </svg>
          </div>

          <div className="pps-sticker pps-sticker-tome" title="Leatherbound Tome">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <path d="M8 8h28v32H8z" fill="#4A2E1B" />
              <path d="M12 12h20v24H12z" fill="#FCFAF4" />
              <path d="M16 16h12v2H16zM16 22h12v2H16zM16 28h8v2H16z" fill="#1B2334" />
              <path d="M36 12h4v24h-4z" fill="#A5731C" />
            </svg>
          </div>

          <div className="pps-sticker pps-sticker-mug" title="Steaming Scholar Tea">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <path d="M14 16h16v20H14z" fill="#FCFAF4" />
              <path d="M30 20h6v12h-6z" fill="none" stroke="#D3C9B4" strokeWidth="4" />
              <path d="M18 8c0 2 2 4 2 4s2-2 2-4" stroke="#A5731C" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M24 6c0 2 2 4 2 4s2-2 2-4" stroke="#A5731C" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div className="pps-sticker pps-sticker-quill" title="Feather Quill">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <path d="M32 6c-8 6-12 14-16 24l-4 8 8-4c10-4 18-8 24-16-4-8-8-12-12-12z" fill="#F7D486" />
              <path d="M12 38l-4 4 4-1z" fill="#1B2334" />
            </svg>
          </div>

          <div className="pps-sticker pps-sticker-seal" title="Wax Seal of Mastery">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <circle cx="24" cy="24" r="18" fill="#C85848" />
              <circle cx="24" cy="24" r="14" fill="#A03B2E" />
              <path d="M24 16l2.5 5 5.5.8-4 3.9.9 5.3-4.9-2.6-4.9 2.6.9-5.3-4-3.9 5.5-.8z" fill="#F7D486" />
            </svg>
          </div>

          <div className="pps-sticker pps-sticker-star" title="Spark of Diligence">
            <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow">
              <path d="M16 2l3 11 11 3-11 3-3 11-3-11-11-3 11-3z" fill="#E3B04B" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── 2. Sticky 200vh Console Section ──────────────────────────────────── */}
      <div className="pps-console-track">
        <div className="pps-console-sticky" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          {/* Angled Background Watermark */}
          <div className="pps-watermark" aria-hidden="true">
            ROUGH THOUGHT, POLISHED · STUDY IN A WARMER LIGHT
          </div>

          {/* Left Side Info Card */}
          <div className="pps-side-info">
            <div className="pps-side-badge">
              <Brain className="w-3.5 h-3.5" />
              <span>Interactive Console</span>
            </div>
            <h3 className="pps-side-title">Live Manuscript Terminal</h3>
            <p className="pps-side-desc">
              Experience the core Comtus study loops directly on the interactive console. Switch between Socratic Inquiry, Flashcard Drills, Proof Verification, and BYOK Models.
            </p>
          </div>

          {/* Centerpiece 16-Bit Study Console Device */}
          <div className="pps-console-device-wrap">
            <div ref={consoleRef} className="pps-console-device" role="region" aria-label="16-Bit Study Console">
              {/* Screen Bezel */}
              <div className="pps-screen-bezel">
                <div className="pps-screen-header">
                  <span>COMTUS-16 · {activeMode.toUpperCase()}</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#78B084] animate-pulse" />
                    ONLINE
                  </span>
                </div>

                <div className="pps-screen-body">
                  <div className="pps-screen-scanline" />

                  {/* Mode 1: Socratic Dialogue */}
                  {activeMode === "socratic" && (
                    <div className="flex flex-col gap-2 relative z-10 text-xs">
                      <div className="text-[#E3B04B] font-mono">Q: What triggers Long-Term Potentiation?</div>
                      <div className="text-[#A5B4CB] leading-relaxed">
                        To consolidate memory across hippocampal synapses, what ionic event must occur at the NMDA receptor?
                      </div>
                      <div className="flex flex-col gap-1.5 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            playRetroClick(440);
                            setSocraticChoice(0);
                          }}
                          className={`text-left p-1.5 rounded border transition-colors ${
                            socraticChoice === 0
                              ? "bg-[#78B084]/20 border-[#78B084] text-[#78B084]"
                              : "bg-[#171F32] border-[#33405F] text-[#F5F0E6] hover:border-[#E3B04B]"
                          }`}
                        >
                          A) Magnesium block expulsion via depolarization
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playRetroClick(300);
                            setSocraticChoice(1);
                          }}
                          className={`text-left p-1.5 rounded border transition-colors ${
                            socraticChoice === 1
                              ? "bg-[#C85848]/20 border-[#C85848] text-[#E5A8A0]"
                              : "bg-[#171F32] border-[#33405F] text-[#F5F0E6] hover:border-[#E3B04B]"
                          }`}
                        >
                          B) Passive sodium diffusion without glutamate
                        </button>
                      </div>
                      {socraticChoice === 0 && (
                        <div className="text-[11px] text-[#78B084] font-mono mt-1">
                          ✓ Correct! Strong depolarization repels Mg2+, allowing Ca2+ influx.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 2: Flashcards */}
                  {activeMode === "flashcards" && (
                    <div
                      onClick={() => {
                        playRetroClick(500);
                        setFlashcardFlipped(!flashcardFlipped);
                      }}
                      className="flex flex-col items-center justify-center min-h-[140px] text-center cursor-pointer p-2 relative z-10"
                    >
                      <div className="text-[10px] font-mono text-[#E3B04B] mb-1">
                        CARD 04/28 · CLICK OR PRESS A TO FLIP
                      </div>
                      {!flashcardFlipped ? (
                        <div>
                          <div className="text-sm font-semibold text-[#F5F0E6] mb-1">Hebbian Plasticity</div>
                          <div className="text-xs text-[#A5B4CB]">What is the neurobiological core rule of learning?</div>
                        </div>
                      ) : (
                        <div className="bg-[#171F32] p-2 rounded border border-[#78B084]">
                          <div className="text-xs text-[#78B084] font-medium leading-relaxed">
                            "Neurons that fire together wire together." Simultaneous activation strengthens synaptic efficacy.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 3: Proof Engine */}
                  {activeMode === "proof" && (
                    <div className="flex flex-col gap-1.5 relative z-10 text-xs font-mono">
                      <div className="text-[#E3B04B]">PROOF: Euler's Identity</div>
                      <div className="bg-[#171F32] p-1.5 rounded border border-[#33405F] text-[#A5B4CB]">
                        1. e^(ix) = cos(x) + i·sin(x)
                      </div>
                      <div className="bg-[#171F32] p-1.5 rounded border border-[#33405F] text-[#A5B4CB]">
                        2. Substitute x = π → e^(iπ) = -1 + 0
                      </div>
                      <div className="bg-[#78B084]/20 p-1.5 rounded border border-[#78B084] text-[#78B084]">
                        3. e^(iπ) + 1 = 0 [Q.E.D. VERIFIED]
                      </div>
                    </div>
                  )}

                  {/* Mode 4: Multi-Model BYOK */}
                  {activeMode === "byok" && (
                    <div className="flex flex-col gap-2 relative z-10 text-xs font-mono">
                      <div className="text-[#E3B04B]">ACTIVE INFERENCE PROVIDER</div>
                      <div className="bg-[#171F32] p-2 rounded border border-[#E3B04B] text-[#F5F0E6]">
                        Model: <span className="text-[#78B084] font-semibold">{activeModel}</span>
                        <div className="text-[10px] text-[#A5B4CB] mt-1">
                          Latency: 280ms · Zero-Data Retention · Local Vault
                        </div>
                      </div>
                      <div className="text-[10px] text-[#A5B4CB]">
                        Press (A) to switch between Anthropic, DeepSeek, OpenAI &amp; Local Llama.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Physical Tactile Controls */}
              <div className="pps-console-controls">
                {/* D-Pad */}
                <div className="pps-dpad" aria-label="D-Pad navigation">
                  <button type="button" onClick={handlePrevMode} className="pps-dpad-btn pps-dpad-up" aria-label="D-Pad Up">▲</button>
                  <button type="button" onClick={handleNextMode} className="pps-dpad-btn pps-dpad-down" aria-label="D-Pad Down">▼</button>
                  <button type="button" onClick={handlePrevMode} className="pps-dpad-btn pps-dpad-left" aria-label="D-Pad Left">◀</button>
                  <button type="button" onClick={handleNextMode} className="pps-dpad-btn pps-dpad-right" aria-label="D-Pad Right">▶</button>
                  <div className="pps-dpad-btn pps-dpad-center" />
                </div>

                {/* Action Buttons A / B */}
                <div className="pps-action-btns">
                  <button
                    type="button"
                    onClick={handleActionButtonB}
                    className="pps-action-btn btn-b"
                    title="Button B (Undo / Flip)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={handleActionButtonA}
                    className="pps-action-btn"
                    title="Button A (Select / Action)"
                  >
                    A
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side Stacked Instruction Badges */}
          <div className="pps-instruction-wrap">
            <div className="pps-instruction-pill">SCROLL</div>
            <div className="pps-instruction-pill highlight">THE CONSOLE</div>
            <div className="pps-instruction-pill">TO REVEAL BLUEPRINTS</div>
          </div>
        </div>
      </div>

      {/* ── 3. Parallax Dual-Column Cards Gallery (300vh) ────────────────────── */}
      <div className="pps-gallery-section">
        <div className="pps-gallery-sticky">
          {/* Vertical Desk Slat Background Stripes */}
          <div className="pps-slat-background" aria-hidden="true">
            <div className="pps-slat-col" />
            <div className="pps-slat-col" />
            <div className="pps-slat-col" />
            <div className="pps-slat-col" />
            <div className="pps-slat-col" />
          </div>

          {/* Staggered Dual Column Cards */}
          <div className="pps-cards-container">
            {/* Left Column */}
            <div ref={leftColRef} className="pps-column-left">
              {STUDY_CARDS_LEFT.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.id} className="pps-card">
                    <div className="pps-card-top">
                      <div className="pps-card-preview">
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                          <Icon className="w-10 h-10 text-[#A5731C] mb-2" />
                          <span className="font-mono text-xs text-[#5C3D1E] uppercase tracking-wider">
                            {card.tag}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pps-card-bottom">
                      <div className="pps-card-tear-line" />
                      <h4 className="pps-card-title">{card.title}</h4>
                      <p className="pps-card-desc">{card.desc}</p>
                      <div className="pps-card-meta">
                        <Star className="w-3.5 h-3.5 fill-[#A5731C] text-[#A5731C]" />
                        <span>{card.metric}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Right Column */}
            <div ref={rightColRef} className="pps-column-right">
              {STUDY_CARDS_RIGHT.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.id} className="pps-card">
                    <div className="pps-card-top">
                      <div className="pps-card-preview">
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                          <Icon className="w-10 h-10 text-[#A5731C] mb-2" />
                          <span className="font-mono text-xs text-[#5C3D1E] uppercase tracking-wider">
                            {card.tag}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pps-card-bottom">
                      <div className="pps-card-tear-line" />
                      <h4 className="pps-card-title">{card.title}</h4>
                      <p className="pps-card-desc">{card.desc}</p>
                      <div className="pps-card-meta">
                        <Star className="w-3.5 h-3.5 fill-[#A5731C] text-[#A5731C]" />
                        <span>{card.metric}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Sticky Bottom CTA */}
          <div className="pps-sticky-cta-wrap">
            <Link to="/studio" className="pps-cta-button">
              <span>OPEN THE STUDIO</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
