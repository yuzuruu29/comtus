import { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Power,
  Disc,
  CheckCircle2,
  Radio,
} from "lucide-react";
import { playProceduralSfx } from "../studio/companion/sfx";
import "./scholar-deck.css";

gsap.registerPlugin(ScrollTrigger);

interface RomCartridge {
  id: string;
  romName: string;
  discipline: string;
  topic: string;
  sourceDoc: string;
  socraticPrompt: string;
  socraticSteps: string[];
  flashcard: { q: string; a: string };
  proof: string;
}

const CARTRIDGES: RomCartridge[] = [
  {
    id: "med",
    romName: "USMLE-MED.ROM",
    discipline: "Medicine / Pathology",
    topic: "Pulmonary Embolism & V/Q Mismatch",
    sourceDoc: "Robbins_Pathology_10e.pdf §4.3 (p.118)",
    socraticPrompt: "45yo male presents with acute pleuritic chest pain and dyspnea after a 14-hour flight. PaO2 is 65 mmHg on room air.",
    socraticSteps: [
      "Step 1: Identify the underlying pathophysiology causing hypoxemia (V/Q mismatch due to dead-space ventilation).",
      "Step 2: Evaluate Wells Score criteria (immobility, tachycardia, lack of alternative diagnosis).",
      "Step 3: Determine definitive diagnostic imaging (CT Pulmonary Angiography vs V/Q Scan).",
    ],
    flashcard: {
      q: "What is the classic triad of pulmonary embolism presentation?",
      a: "Dyspnea (73%), Pleuritic Chest Pain (66%), and Cough/Hemoptysis (37%). EKG frequently shows Sinus Tachycardia or S1Q3T3 pattern.",
    },
    proof: "Derivation: Alveolar-arterial O2 gradient = P(A)O2 - P(a)O2. Calculated Aa gradient = 42 mmHg (Elevated, verifying intrinsic pulmonary pathology).",
  },
  {
    id: "nursing",
    romName: "NCLEX-NURSE.ROM",
    discipline: "Nursing / Clinical Triage",
    topic: "Post-Operative Prioritization",
    sourceDoc: "Saunders_NCLEX_9e.pdf §12.1 (p.245)",
    socraticPrompt: "You receive morning handover for four post-operative patients. Which patient requires your immediate first assessment?",
    socraticSteps: [
      "Step 1: Apply ABC (Airway, Breathing, Circulation) triage framework.",
      "Step 2: Differentiate expected post-op pain vs acute hemorrhage or airway compromise.",
      "Step 3: Prioritize thyroidectomy patient with stridor over knee arthroplasty reporting 7/10 pain.",
    ],
    flashcard: {
      q: "What is the immediate nursing intervention for suspected post-thyroidectomy laryngeal edema?",
      a: "Maintain high Fowler's position, immediately notify surgeon, and keep tracheostomy kit and suction at bedside.",
    },
    proof: "Protocol: In accordance with AACN Acute Care standards: Airway Patency (Class 1 Urgent) supersedes localized pain management (Class 3 Elective).",
  },
  {
    id: "stem",
    romName: "STEM-CALC.ROM",
    discipline: "Pure Mathematics / Analysis",
    topic: "Squeeze Theorem & Trigonometric Limits",
    sourceDoc: "Spivak_Calculus_4e.pdf §5.2 (p.84)",
    socraticPrompt: "Prove that lim(x->0) (sin x / x) = 1 strictly from the unit circle geometric definition.",
    socraticSteps: [
      "Step 1: Construct sector inequalities on the unit circle: cos(x) < (sin x / x) < 1 for x in (-pi/2, pi/2).",
      "Step 2: Apply the limit x -> 0 across the bounding functions cos(0) = 1 and 1 = 1.",
      "Step 3: Conclude by the Squeeze (Sandwich) Theorem that the limit must equal 1.",
    ],
    flashcard: {
      q: "What are the formal conditions required to apply the Squeeze Theorem?",
      a: "Given g(x) <= f(x) <= h(x) on an open interval around c, if lim g(x) = lim h(x) = L, then lim f(x) = L.",
    },
    proof: "Proof Q.E.D: cos(x) <= sin(x)/x <= 1. As x->0: 1 <= lim(sin x/x) <= 1 ==> lim(sin x / x) = 1.",
  },
  {
    id: "law",
    romName: "LAW-BAR.ROM",
    discipline: "Jurisprudence & Legal Logic",
    topic: "Proximate Cause & Foreseeability",
    sourceDoc: "Prosser_Keeton_Torts_5e.pdf §41 (p.263)",
    socraticPrompt: "Analyze liability under Palsgraf v. Long Island Railroad Co. regarding the scope of duty owed to unforeseeable plaintiffs.",
    socraticSteps: [
      "Step 1: Cardozo's majority opinion: Duty is relational. Negligence in the air is not a tort.",
      "Step 2: Establish whether the plaintiff was situated within the 'zone of reasonably foreseeable hazard'.",
      "Step 3: Contrast Andrews' dissent: Duty is owed to society at large; proximate cause is governed by directness and common sense.",
    ],
    flashcard: {
      q: "What is the core holding of Palsgraf regarding duty of care?",
      a: "A defendant is only liable for negligence if the plaintiff was within the foreseeable 'orbit of danger' created by the defendant's conduct.",
    },
    proof: "Restatement (Third) of Torts §29: An actor's liability is limited to physical harms that result from the risks that made the actor's conduct tortious.",
  },
];

export default function ScholarConsoleDeck() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [powerOn, setPowerOn] = useState(true);
  const [selectedRom, setSelectedRom] = useState<RomCartridge>(CARTRIDGES[0]);
  const [activeMode, setActiveMode] = useState<"socratic" | "leitner" | "proof">("socratic");
  const [rotaryLevel, setRotaryLevel] = useState(3);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        rootRef.current,
        { opacity: 0, y: 40, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.9,
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

  const handleSelectRom = (rom: RomCartridge) => {
    try {
      playProceduralSfx("pop");
    } catch {}
    setSelectedRom(rom);
    setFlashcardFlipped(false);
  };

  const handleSetMode = (mode: "socratic" | "leitner" | "proof") => {
    try {
      playProceduralSfx("click");
    } catch {}
    setActiveMode(mode);
    setFlashcardFlipped(false);
  };

  const handleStepRotary = () => {
    try {
      playProceduralSfx("click");
    } catch {}
    setRotaryLevel((prev) => (prev >= 4 ? 1 : prev + 1));
  };

  const togglePower = () => {
    try {
      playProceduralSfx("ignite");
    } catch {}
    setPowerOn((prev) => !prev);
  };

  const handleFlipCard = () => {
    try {
      playProceduralSfx("flip");
    } catch {}
    setFlashcardFlipped((prev) => !prev);
  };

  return (
    <div
      ref={rootRef}
      className="relative z-10 mx-auto w-full max-w-6xl px-6 py-14"
      aria-label="Comtus Scholar Hardware Deck"
    >
      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <div className="mb-8 text-center sm:text-left flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#044AB3]/30 bg-[#044AB3]/10 px-3.5 py-1 text-[11px] font-mono font-bold text-[#044AB3] uppercase tracking-widest mb-3">
            <Radio size={12} className="text-[#044AB3] animate-pulse" />
            <span>INTERACTIVE HARDWARE SIMULATOR</span>
          </div>
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-[600] text-[#0B132B] tracking-tight">
            The Comtus Cognitive Console Deck
          </h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[#5A6A85]">
            Tactile, hardware-inspired cognitive learning interface. Switch curriculum ROMs, adjust dialectic reasoning depth, and test active recall directly.
          </p>
        </div>

        <div className="flex items-center gap-3 self-center sm:self-auto font-mono text-[11px] text-[#5A6A85]">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${powerOn ? "bg-emerald-500 shadow-[0_0_8px_#10B981]" : "bg-gray-400"}`} />
            <span>{powerOn ? "POWER: ONLINE" : "POWER: STANDBY"}</span>
          </span>
        </div>
      </div>

      {/* ── Main Physical Skewmorphic Console Chassis ──────────────────────── */}
      <div className="scholar-deck-chassis p-6 sm:p-8">
        {/* Decorative corner chassis screws */}
        <div className="deck-screw top-3 left-3" />
        <div className="deck-screw top-3 right-3" />
        <div className="deck-screw bottom-3 left-3" />
        <div className="deck-screw bottom-3 right-3" />

        {/* Chassis Top Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] font-extrabold tracking-[0.25em] text-[#6FE3FF]">
              COMTUS · DECK MK-IV
            </span>
            <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/70">
              SERIAL // 2026.89-C8
            </span>
          </div>

          {/* Power Rocker Switch */}
          <button
            type="button"
            onClick={togglePower}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1 font-mono text-[11px] font-bold transition-all cursor-pointer ${
              powerOn
                ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                : "border-gray-600 bg-gray-800/60 text-gray-400"
            }`}
          >
            <Power size={12} />
            <span>{powerOn ? "PWR: ON" : "PWR: OFF"}</span>
          </button>
        </div>

        {/* Grid: CRT Screen on Left, Controls & Cartridge Bay on Right */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ── CRT Monitor Screen Area (7 Cols) ─────────────────────────────── */}
          <div className="lg:col-span-8">
            <div className="crt-bezel">
              <div className={`crt-screen-glass ${!powerOn ? "is-off" : ""}`}>
                {/* Screen Header Telemetry */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3 font-mono text-[10.5px] text-[#6FE3FF]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6FE3FF] animate-pulse" />
                    <span>ROM: {selectedRom.romName}</span>
                  </div>
                  <span>MODE: {activeMode.toUpperCase()} // LVL.{rotaryLevel}</span>
                </div>

                {/* Main Screen Content based on Active Mode */}
                <div className="min-h-[200px] text-white">
                  <div className="mb-2">
                    <span className="font-mono text-[10px] uppercase text-[#6FE3FF]/80 tracking-wider">
                      {selectedRom.discipline} · {selectedRom.sourceDoc}
                    </span>
                    <h3 className="font-display text-[17px] font-[550] text-[#6FE3FF] mt-0.5">
                      {selectedRom.topic}
                    </h3>
                  </div>

                  {activeMode === "socratic" && (
                    <div className="space-y-2.5 mt-3">
                      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-[12.5px] leading-relaxed text-gray-200">
                        <strong className="text-[#6FE3FF] font-mono text-[11px] block mb-1">
                          [SOCRATIC CLINICAL PROMPT]
                        </strong>
                        {selectedRom.socraticPrompt}
                      </div>

                      <div className="space-y-1.5 font-mono text-[11.5px] text-gray-300">
                        {selectedRom.socraticSteps.slice(0, rotaryLevel).map((st, idx) => (
                          <div key={idx} className="flex items-start gap-2 bg-[#044AB3]/20 border border-[#044AB3]/30 p-2 rounded">
                            <span className="text-[#6FE3FF] font-bold">›</span>
                            <span>{st}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeMode === "leitner" && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handleFlipCard}
                        aria-pressed={flashcardFlipped}
                        className="w-full cursor-pointer rounded-xl border border-[#6FE3FF]/30 bg-white/[0.06] p-4 text-center hover:border-[#6FE3FF] transition-all shadow-inner"
                      >
                        <div className="font-mono text-[10.5px] text-[#6FE3FF] uppercase tracking-wider mb-2">
                          {flashcardFlipped ? "— FLASHCARD ANSWER (CLICK TO FLIP BACK) —" : "— FLASHCARD PROMPT (CLICK TO FLIP) —"}
                        </div>
                        <p className="text-[14px] font-medium leading-relaxed text-white">
                          {flashcardFlipped ? selectedRom.flashcard.a : selectedRom.flashcard.q}
                        </p>
                      </button>
                    </div>
                  )}

                  {activeMode === "proof" && (
                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 font-mono text-[12px] text-emerald-300">
                        <span className="text-white/60 block text-[10px] uppercase mb-1">[SYMBOLIC DERIVATION TRACE]</span>
                        {selectedRom.proof}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-[#6FE3FF]/80">
                        <CheckCircle2 size={13} className="text-emerald-400" />
                        <span>Intermediate Step Precision: 99.8% Grounded</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* CRT Scanline Footer Status */}
                <div className="mt-4 border-t border-white/10 pt-2 flex items-center justify-between font-mono text-[10px] text-white/50">
                  <span>COMTUS v0.3.1 // ON-DEVICE DEXIE</span>
                  <span>SYSTEM LATENCY: 14MS</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Hardware Controls & Cartridge Bay on Right (5 Cols) ──────────── */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-5">
            {/* 1. Mode Select Buttons (Pierre-Louis 3D Tactile Buttons) */}
            <div>
              <p
                id="cognitive-mode-heading"
                className="font-mono text-[10.5px] uppercase font-bold tracking-wider text-white/70 mb-2"
              >
                1. SELECT COGNITIVE MODE
              </p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="cognitive-mode-heading">
                <button
                  type="button"
                  onClick={() => handleSetMode("socratic")}
                  className={`deck-btn-3d btn-amber ${activeMode === "socratic" ? "is-active" : ""}`}
                >
                  Socratic
                </button>
                <button
                  type="button"
                  onClick={() => handleSetMode("leitner")}
                  className={`deck-btn-3d btn-emerald ${activeMode === "leitner" ? "is-active" : ""}`}
                >
                  Flashcard
                </button>
                <button
                  type="button"
                  onClick={() => handleSetMode("proof")}
                  className={`deck-btn-3d btn-purple ${activeMode === "proof" ? "is-active" : ""}`}
                >
                  Proof
                </button>
              </div>
            </div>

            {/* 2. Reasoning Depth Rotary Knob */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
              <div>
                <div className="font-mono text-[10.5px] uppercase font-bold tracking-wider text-white/70">
                  REASONING DEPTH
                </div>
                <div className="font-mono text-[13px] font-bold text-[#6FE3FF] mt-0.5">
                  LEVEL {rotaryLevel} / 4
                </div>
                <span className="text-[10.5px] font-mono text-white/50">
                  {rotaryLevel === 1 ? "Overview" : rotaryLevel === 2 ? "Standard" : rotaryLevel === 3 ? "Deep Probe" : "Full Proof"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleStepRotary}
                className="deck-rotary-dial"
                style={{ transform: `rotate(${(rotaryLevel - 1) * 90}deg)` }}
                title="Rotate Reasoning Depth"
                aria-label="Rotate Reasoning Depth"
              >
                <div className="w-2 h-2 rounded-full bg-white/20" />
              </button>
            </div>

            {/* 3. Insertable ROM Cartridge Bay (Pierrelouis Cassette Slot) */}
            <div className="deck-cartridge-bay">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10.5px] uppercase font-bold tracking-wider text-[#6FE3FF]">
                  2. CARTRIDGE ROM BAY
                </span>
                <span className="font-mono text-[9.5px] text-white/50">CLICK TO LOAD</span>
              </div>

              <div className="space-y-1.5">
                {CARTRIDGES.map((c) => {
                  const isInserted = selectedRom.id === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => handleSelectRom(c)}
                      aria-pressed={isInserted}
                      className={`deck-rom-chip ${isInserted ? "is-inserted" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <Disc size={13} className={isInserted ? "text-[#6FE3FF] animate-spin" : "text-white/40"} />
                        <span className="font-bold">{c.romName}</span>
                      </div>
                      <span className="text-[10px] text-white/50">{c.discipline.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
