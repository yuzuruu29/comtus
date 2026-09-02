import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Sparkle,
  BookOpen,
  Brain,
  Layers,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Star,
  Compass,
  PlayCircle,
  GraduationCap,
  Laptop,
  Cpu,
  FileUp,
  Lock,
} from "lucide-react";
import "./comtus-showcase.css";

gsap.registerPlugin(ScrollTrigger);

// ── Types & Data ────────────────────────────────────────────────────────────

type ConsoleMode = "socratic" | "flashcards" | "proof" | "byok";

export interface StudyCardData {
  id: string;
  title: string;
  desc: string;
  metric: string;
  tag: string;
  icon: typeof Sparkle;
  previewType: string;
}

export const COMTUS_CARDS_LEFT: StudyCardData[] = [
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
    previewType: "flashcards",
  },
  {
    id: "card-3",
    title: "STEP-BY-STEP PROOF ENGINE",
    desc: "Rigorous step validation for calculus, physics, and logic derivations with instant error isolation on scratchpad.",
    metric: "Proof Accuracy (99.1%) · 42,000+ Steps",
    tag: "Symbolic Reasoning",
    icon: CheckCircle2,
    previewType: "proof",
  },
  {
    id: "card-4",
    title: "THE 4-STAGE LEARNING LOOP",
    desc: "Understand → Organize → Practice → Master. Transform scattered notes into defensible knowledge you remember under pressure.",
    metric: "Loop Completion (97.8%) · 4-Phase System",
    tag: "Cognitive System",
    icon: Compass,
    previewType: "loop",
  },
  {
    id: "card-5",
    title: "LIVE INTERACTIVE PRODUCT DEMO",
    desc: "Experience real-time lecture note breakdowns, hydroelectric analogies, and practice quizzes with instant rationale reveals.",
    metric: "Scored Practice (100%) · Real Rationales",
    tag: "Interactive Demo",
    icon: PlayCircle,
    previewType: "demo",
  },
  {
    id: "card-6",
    title: "ACADEMIC INTEGRITY BY DESIGN",
    desc: "Hints first, answers second. Source-grounded citations and rubric-based essay coaching that never replaces genuine student thinking.",
    metric: "Pedagogical Rigor · Defensible Work",
    tag: "Academic Integrity",
    icon: GraduationCap,
    previewType: "integrity",
  },
  {
    id: "card-7",
    title: "NATIVE DESKTOP COMPANION APP",
    desc: "Standalone desktop workspace for macOS and Windows. 100% offline-ready with local IndexedDB and direct model routing.",
    metric: "Offline Ready (100%) · Native Desk",
    tag: "Desktop Companion",
    icon: Laptop,
    previewType: "desktop",
  },
];

export const COMTUS_CARDS_RIGHT: StudyCardData[] = [
  {
    id: "card-8",
    title: "MULTI-MODEL BYOK WORKBENCH",
    desc: "Zero vendor lock-in. Switch between Claude 3.7 Sonnet, DeepSeek R1, GPT-4o, or run local models completely offline.",
    metric: "Privacy Verified (100%) · Local SQLite",
    tag: "Open Ecosystem",
    icon: ShieldCheck,
    previewType: "byok",
  },
  {
    id: "card-9",
    title: "CURRICULUM & BOARD BLUEPRINTS",
    desc: "Pre-calibrated mastery tracks tailored for USMLE, NCLEX, PNLE, Bar Exam, CPA, and university STEM examinations.",
    metric: "Exam Readiness (96.7%) · 340+ Syllabi",
    tag: "Board Calibration",
    icon: BookOpen,
    previewType: "boards",
  },
  {
    id: "card-10",
    title: "16-BIT COZY SCHOLAR DESK",
    desc: "Draggable warm brass battery companion, ambient lofi study soundscapes, and focus tracking on warm daylight parchment.",
    metric: "Delight Score (99.9%) · Offline-Safe",
    tag: "Focus Atmosphere",
    icon: Sparkle,
    previewType: "cozy",
  },
  {
    id: "card-11",
    title: "3-PANE STUDIO WORKSPACE",
    desc: "Integrated Sources, Grounded Chat with visible thinking pass, and Studio drill panes in a single seamless console.",
    metric: "Source Grounded · Dexie IndexedDB",
    tag: "Studio Workspace",
    icon: Layers,
    previewType: "studio",
  },
  {
    id: "card-12",
    title: "WHY COMTUS VS GENERIC CHAT",
    desc: "Persistent course notebooks, defensive rationales, and exact page citations versus temporary chat logs and unverified answers.",
    metric: "6x Deep Study · Course Notebooks",
    tag: "Active Learning",
    icon: Cpu,
    previewType: "why",
  },
  {
    id: "card-13",
    title: "IMPORT YOUR ENTIRE STUDY STACK",
    desc: "Ingest PDFs, lecture slides, DOCX files, and NotebookLM JSON exports into a unified, local-first search and quiz index.",
    metric: "Zero Friction · Multi-Format Import",
    tag: "Stack Ingestion",
    icon: FileUp,
    previewType: "import",
  },
  {
    id: "card-14",
    title: "LOCAL-FIRST TRUST & PRIVACY",
    desc: "Your course materials, notes, and API keys stay on your machine. Zero cloud data harvesting and zero training on student data.",
    metric: "Zero Cloud Hoarding · On-Device Keys",
    tag: "Data Sovereignty",
    icon: Lock,
    previewType: "trust",
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

// ── Card Graphic Renderer ───────────────────────────────────────────────────

function CardPreviewGraphic({ type, tag, icon: Icon }: { type: string; tag: string; icon: typeof Sparkle }) {
  switch (type) {
    case "socratic":
      return (
        <div className="cs-preview-socratic-tree">
          <div className="cs-preview-bubble">Q: What causes Hebbian firing?</div>
          <div className="cs-preview-choice">✓ Simultaneous pre/post activation</div>
          <div className="text-[9px] text-[#78B084] font-mono">▸ Spaced drill queue: Level 4</div>
        </div>
      );

    case "flashcards":
      return (
        <div className="cs-preview-flashcard">
          <div className="text-[10px] font-mono text-[#A5731C] font-bold">CARD 12/48</div>
          <div className="text-xs font-semibold text-[#1B2334] mt-1">Glutamate Excitotoxicity</div>
          <div className="cs-preview-leitner-dots">
            <span className="cs-preview-dot active" />
            <span className="cs-preview-dot active" />
            <span className="cs-preview-dot active" />
            <span className="cs-preview-dot" />
            <span className="cs-preview-dot" />
          </div>
        </div>
      );

    case "proof":
      return (
        <div className="cs-preview-proof-box">
          <div>1. e^(iθ) = cos θ + i sin θ</div>
          <div>2. θ = π → e^(iπ) = -1</div>
          <div className="text-[#E3B04B] font-bold">3. e^(iπ) + 1 = 0 [Q.E.D.]</div>
        </div>
      );

    case "loop":
      return (
        <div className="cs-preview-loop-grid">
          <div className="cs-preview-loop-node active">01 Understand</div>
          <div className="cs-preview-loop-node">02 Organize</div>
          <div className="cs-preview-loop-node">03 Practice</div>
          <div className="cs-preview-loop-node active">04 Master</div>
        </div>
      );

    case "demo":
      return (
        <div className="cs-preview-socratic-tree">
          <div className="cs-preview-bubble">Bio 101: Cellular Respiration</div>
          <div className="flex gap-2">
            <span className="cs-preview-chip active">Notes</span>
            <span className="cs-preview-chip">Analogy</span>
            <span className="cs-preview-chip">Quiz</span>
          </div>
          <div className="text-[9px] text-[#A5731C] font-mono">Hydroelectric Dam Analogy Active</div>
        </div>
      );

    case "integrity":
      return (
        <div className="flex flex-col items-center justify-center text-center gap-1">
          <div className="flex items-center gap-2 bg-[#FCFAF4] border border-[#D3C9B4] px-3 py-1 rounded font-mono text-[10px] text-[#5C3D1E]">
            <GraduationCap className="w-3.5 h-3.5 text-[#A5731C]" />
            <span>Source Citation: Slide 18 · Bio 101</span>
          </div>
          <span className="text-[9px] text-[#78B084] font-mono font-bold">Hints First · Rubric-Graded</span>
        </div>
      );

    case "desktop":
      return (
        <div className="flex flex-col items-center justify-center gap-1.5 w-full">
          <div className="flex gap-2">
            <span className="cs-preview-chip active">macOS .dmg</span>
            <span className="cs-preview-chip active">Windows .exe</span>
          </div>
          <span className="text-[10px] text-[#5C3D1E] font-mono font-semibold">100% Offline-Ready · Local SQLite</span>
        </div>
      );

    case "byok":
      return (
        <div className="cs-preview-model-chips">
          <span className="cs-preview-chip active">Claude 3.7</span>
          <span className="cs-preview-chip">DeepSeek R1</span>
          <span className="cs-preview-chip">GPT-4o</span>
          <span className="cs-preview-chip">Local Llama 3</span>
        </div>
      );

    case "boards":
      return (
        <div className="cs-preview-board-bars">
          <div className="cs-preview-bar-row">
            <span>PNLE Nursing</span>
            <div className="cs-preview-bar-track"><div className="cs-preview-bar-fill" style={{ width: "92%" }} /></div>
            <span>92%</span>
          </div>
          <div className="cs-preview-bar-row">
            <span>LET Teachers</span>
            <div className="cs-preview-bar-track"><div className="cs-preview-bar-fill" style={{ width: "88%" }} /></div>
            <span>88%</span>
          </div>
          <div className="cs-preview-bar-row">
            <span>Civil Eng</span>
            <div className="cs-preview-bar-track"><div className="cs-preview-bar-fill" style={{ width: "76%" }} /></div>
            <span>76%</span>
          </div>
        </div>
      );

    case "cozy":
      return (
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <path d="M20 4h8v4h-8z" fill="#94A3B8" />
              <path d="M12 8h24v34H12z" fill="#1A1108" />
              <path d="M14 10h20v30H14z" fill="#B88428" />
              <path d="M14 10h3v30h-3z" fill="#F7D486" />
              <path d="M17 14h14v16H17z" fill="#080B12" />
              <path d="M19 18h2v3h-2zM27 18h2v3h-2z" fill="#FDE047" />
              <path d="M22 24h4v1h-4z" fill="#FDE047" />
              <path d="M18 33h3v3h-3zM23 33h3v3h-3z" fill="#78B084" />
              <path d="M28 33h3v3h-3z" fill="#FDE047" />
            </svg>
          </div>
          <div className="font-mono text-xs text-brass">
            <div>16-Bit Battery Companion</div>
            <div className="text-[10px] text-brasspale">Fully Charged · Study Companion</div>
          </div>
        </div>
      );

    case "studio":
      return (
        <div className="cs-preview-studio-diorama">
          <div className="cs-preview-diorama-col">
            <span>Sources</span>
            <span className="text-[8px] text-[#78B084]">PDF / DOCX</span>
          </div>
          <div className="cs-preview-diorama-col center">
            <span>Reasoning Chat</span>
            <span className="text-[8px] text-[#E3B04B]">Socratic</span>
          </div>
          <div className="cs-preview-diorama-col">
            <span>Studio</span>
            <span className="text-[8px] text-[#78B084]">Drills</span>
          </div>
        </div>
      );

    case "why":
      return (
        <div className="cs-preview-loop-grid">
          <div className="cs-preview-loop-node text-red-700 bg-red-50 border-red-200">
            Generic Chat <br /><span className="text-[8px] opacity-75">Temporary Logs</span>
          </div>
          <div className="cs-preview-loop-node active">
            Comtus Studio <br /><span className="text-[8px] opacity-75">Course Notebooks</span>
          </div>
        </div>
      );

    case "import":
      return (
        <div className="flex flex-wrap gap-2 justify-center items-center font-mono text-[10px]">
          <span className="px-2 py-1 bg-[#FCFAF4] border border-[#D3C9B4] rounded text-[#5C3D1E] font-bold">.PDF</span>
          <span className="px-2 py-1 bg-[#FCFAF4] border border-[#D3C9B4] rounded text-[#5C3D1E] font-bold">.DOCX</span>
          <span className="px-2 py-1 bg-[#FCFAF4] border border-[#D3C9B4] rounded text-[#5C3D1E] font-bold">.MD</span>
          <span className="px-2 py-1 bg-[#EAE4D6] border border-[#A5731C] rounded text-[#A5731C] font-bold">NotebookLM</span>
        </div>
      );

    case "trust":
      return (
        <div className="flex items-center justify-center gap-2 font-mono text-xs text-[#5C3D1E]">
          <Lock className="w-5 h-5 text-[#A5731C]" />
          <div>
            <div className="font-bold">IndexedDB Local Vault</div>
            <div className="text-[9px] text-[#78B084]">Zero Cloud Hoarding</div>
          </div>
        </div>
      );

    default:
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center">
          <Icon className="w-8 h-8 text-[#A5731C] mb-1" />
          <span className="font-mono text-[11px] text-[#5C3D1E] uppercase tracking-wider">{tag}</span>
        </div>
      );
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ComtusShowcase() {
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

  // GSAP ScrollTrigger Motion Choreography
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // 1. Hero Floating Stickers Multi-Rate Parallax
      const stickers = containerRef.current?.querySelectorAll(".cs-sticker");
      stickers?.forEach((stk, i) => {
        const speed = 25 + (i % 3) * 20;
        const dir = i % 2 === 0 ? -1 : 1;
        gsap.to(stk, {
          yPercent: dir * speed,
          ease: "none",
          scrollTrigger: {
            trigger: ".cs-hero-section",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      // 2. Dual-Column Differential Parallax (Desktop)
      if (window.innerWidth > 991 && leftColRef.current && rightColRef.current) {
        gsap.to(leftColRef.current, {
          y: -80,
          ease: "none",
          scrollTrigger: {
            trigger: ".cs-gallery-section",
            start: "top bottom",
            end: "bottom top",
            scrub: 1.2,
          },
        });

        gsap.to(rightColRef.current, {
          y: -140,
          ease: "none",
          scrollTrigger: {
            trigger: ".cs-gallery-section",
            start: "top bottom",
            end: "bottom top",
            scrub: 1.6,
          },
        });
      }

      // 3. Staggered Card Pop-in Reveal Triggers
      const cards = containerRef.current?.querySelectorAll(".cs-card");
      cards?.forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 35, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.65,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              once: true,
            },
          },
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="comtus-showcase" aria-label="Comtus 16-Bit Pixel Console & Study Blueprint Showcase">
      {/* ── 1. Hero Title & Floating Pixel Stickers ──────────────────────────── */}
      <div className="cs-hero-section">
        <div className="cs-subheader-pill">
          <Sparkle className="w-4 h-4 text-[#A5731C]" />
          <span>YOUR AI STUDY COMPANION</span>
        </div>

        <div className="cs-header-block">
          <h1 className="cs-heading-h1">
            COMTUS
            <span className="cs-highlight">Rough thought, polished.</span>
          </h1>

          {/* Floating Pixel Retro Scholar Stickers */}
          <div className="cs-sticker cs-sticker-battery" title="16-Bit Battery Companion">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <path d="M20 4h8v4h-8z" fill="#94A3B8" />
              <path d="M22 4h4v2h-4z" fill="#E2E8F0" />
              <path d="M12 8h24v34H12z" fill="#1A1108" />
              <path d="M14 10h20v30H14z" fill="#B88428" />
              <path d="M14 10h3v30h-3z" fill="#F7D486" />
              <path d="M17 14h14v16H17z" fill="#080B12" />
              <path d="M19 18h2v3h-2zM27 18h2v3h-2z" fill="#FDE047" />
              <path d="M20 18h1v1h-1zM28 18h1v1h-1z" fill="#FFFFFF" />
              <path d="M22 24h4v1h-4zM21 23h1v1h-1zM26 23h1v1h-1z" fill="#FDE047" />
              <path d="M18 33h3v3h-3zM23 33h3v3h-3z" fill="#78B084" />
              <path d="M28 33h3v3h-3z" fill="#FDE047" />
            </svg>
          </div>

          <div className="cs-sticker cs-sticker-tome" title="Antique Study Tome">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <path d="M8 8h28v32H8z" fill="#4A2E1B" />
              <path d="M12 12h20v24H12z" fill="#FCFAF4" />
              <path d="M16 16h12v2H16zM16 22h12v2H16zM16 28h8v2H16z" fill="#1B2334" />
              <path d="M36 12h4v24h-4z" fill="#A5731C" />
            </svg>
          </div>

          <div className="cs-sticker cs-sticker-mug" title="Steaming Study Tea">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <path d="M14 16h16v20H14z" fill="#FCFAF4" />
              <path d="M30 20h6v12h-6z" fill="none" stroke="#D3C9B4" strokeWidth="4" />
              <path d="M18 8c0 2 2 4 2 4s2-2 2-4" stroke="#A5731C" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M24 6c0 2 2 4 2 4s2-2 2-4" stroke="#A5731C" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div className="cs-sticker cs-sticker-quill" title="Feather Quill">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <path d="M32 6c-8 6-12 14-16 24l-4 8 8-4c10-4 18-8 24-16-4-8-8-12-12-12z" fill="#F7D486" />
              <path d="M12 38l-4 4 4-1z" fill="#1B2334" />
            </svg>
          </div>

          <div className="cs-sticker cs-sticker-seal" title="Wax Seal of Mastery">
            <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow">
              <circle cx="24" cy="24" r="18" fill="#C85848" />
              <circle cx="24" cy="24" r="14" fill="#A03B2E" />
              <path d="M24 16l2.5 5 5.5.8-4 3.9.9 5.3-4.9-2.6-4.9 2.6.9-5.3-4-3.9 5.5-.8z" fill="#F7D486" />
            </svg>
          </div>

          <div className="cs-sticker cs-sticker-star" title="Spark of Diligence">
            <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow">
              <path d="M16 2l3 11 11 3-11 3-3 11-3-11-11-3 11-3z" fill="#E3B04B" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── 2. Continuous Console Centerpiece Section ────────────────────────── */}
      <div className="cs-console-track">
        <div className="cs-console-sticky" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          {/* Angled Background Watermark */}
          <div className="cs-watermark" aria-hidden="true">
            ROUGH THOUGHT, POLISHED · STUDY IN A WARMER LIGHT
          </div>

          {/* Left Side Info Card */}
          <div className="cs-side-info">
            <div className="cs-side-badge">
              <Brain className="w-3.5 h-3.5" />
              <span>Interactive Console</span>
            </div>
            <h2 className="cs-side-title">Live 16-Bit Terminal</h2>
            <p className="cs-side-desc">
              Experience the core Comtus study loops directly on the interactive console. Switch between Socratic Inquiry, Flashcard Drills, Proof Verification, and BYOK Models.
            </p>
          </div>

          {/* Centerpiece 16-Bit Retro Console Device */}
          <div className="cs-console-device-wrap">
            <div ref={consoleRef} className="cs-console-device" role="region" aria-label="16-Bit Study Console">
              {/* Screen Bezel */}
              <div className="cs-screen-bezel">
                <div className="cs-screen-header">
                  <span>COMTUS-16 · {activeMode.toUpperCase()}</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#78B084] animate-pulse" />
                    ONLINE
                  </span>
                </div>

                <div className="cs-screen-body">
                  <div className="cs-screen-scanline" />

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
                    <button
                      type="button"
                      onClick={() => {
                        playRetroClick(500);
                        setFlashcardFlipped(!flashcardFlipped);
                      }}
                      aria-pressed={flashcardFlipped}
                      className="flex w-full flex-col items-center justify-center min-h-[140px] text-center cursor-pointer p-2 relative z-10 bg-transparent border-0"
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
                    </button>
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
              <div className="cs-console-controls">
                {/* D-Pad */}
                <div className="cs-dpad" aria-label="D-Pad navigation">
                  <button type="button" onClick={handlePrevMode} className="cs-dpad-btn cs-dpad-up" aria-label="D-Pad Up">▲</button>
                  <button type="button" onClick={handleNextMode} className="cs-dpad-btn cs-dpad-down" aria-label="D-Pad Down">▼</button>
                  <button type="button" onClick={handlePrevMode} className="cs-dpad-btn cs-dpad-left" aria-label="D-Pad Left">◀</button>
                  <button type="button" onClick={handleNextMode} className="cs-dpad-btn cs-dpad-right" aria-label="D-Pad Right">▶</button>
                  <div className="cs-dpad-btn cs-dpad-center" />
                </div>

                {/* Action Buttons A / B */}
                <div className="cs-action-btns">
                  <button
                    type="button"
                    onClick={handleActionButtonB}
                    className="cs-action-btn btn-b"
                    title="Button B (Undo / Flip)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={handleActionButtonA}
                    className="cs-action-btn"
                    title="Button A (Select / Action)"
                  >
                    A
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side Stacked Instruction Badges */}
          <div className="cs-instruction-wrap">
            <div className="cs-instruction-pill">SCROLL</div>
            <div className="cs-instruction-pill highlight">THE BLUEPRINTS</div>
            <div className="cs-instruction-pill">TO EXPLORE COMTUS</div>
          </div>
        </div>
      </div>

      {/* ── 3. Continuous Dual-Column Cards Gallery (14 Blueprints) ───────────── */}
      <div id="features" className="cs-gallery-section">
        <div className="cs-gallery-sticky">
          {/* Vertical Desk Slat Background Stripes */}
          <div className="cs-slat-background" aria-hidden="true">
            <div className="cs-slat-col" />
            <div className="cs-slat-col" />
            <div className="cs-slat-col" />
            <div className="cs-slat-col" />
            <div className="cs-slat-col" />
          </div>

          {/* Staggered Dual Column Cards */}
          <div className="cs-cards-container">
            {/* Left Column (7 Cards) */}
            <div ref={leftColRef} className="cs-column-left">
              {COMTUS_CARDS_LEFT.map((card) => (
                <article key={card.id} className="cs-card">
                  <div className="cs-card-top">
                    <div className="cs-card-preview">
                      <CardPreviewGraphic type={card.previewType} tag={card.tag} icon={card.icon} />
                    </div>
                  </div>

                  <div className="cs-card-bottom">
                    <div className="cs-card-tear-line" />
                    <h3 className="cs-card-title">{card.title}</h3>
                    <p className="cs-card-desc">{card.desc}</p>
                    <div className="cs-card-meta">
                      <Star className="w-3.5 h-3.5 fill-[#A5731C] text-[#A5731C]" />
                      <span>{card.metric}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Right Column (7 Cards) */}
            <div ref={rightColRef} className="cs-column-right">
              {COMTUS_CARDS_RIGHT.map((card) => (
                <article key={card.id} className="cs-card">
                  <div className="cs-card-top">
                    <div className="cs-card-preview">
                      <CardPreviewGraphic type={card.previewType} tag={card.tag} icon={card.icon} />
                    </div>
                  </div>

                  <div className="cs-card-bottom">
                    <div className="cs-card-tear-line" />
                    <h3 className="cs-card-title">{card.title}</h3>
                    <p className="cs-card-desc">{card.desc}</p>
                    <div className="cs-card-meta">
                      <Star className="w-3.5 h-3.5 fill-[#A5731C] text-[#A5731C]" />
                      <span>{card.metric}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Seamless Transition CTA */}
          <div className="cs-showcase-cta-bar">
            <Link to="/studio" className="cs-cta-button">
              <span>OPEN THE STUDIO</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
