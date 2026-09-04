import { useState, useEffect, useRef, useId } from "react";
import { useNavigate } from "react-router-dom";

import { PixelButton, PixelBadge } from "../components/pixel/PixelUI";
import "./landing.css";
import { ArrowLeft, ArrowRight, BookOpen, Check, FileText, GraduationCap, Sparkle, Target, TreeStructure, X } from "@phosphor-icons/react";

export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface SubjectOption {
  id: string;
  label: string;
  shortLabel: string;
  tomeTitle: string;
  desc: string;
  icon: string;
  tomeColor: string;
  tomeLightColor: string;
  trimColor: string;
}

export interface GoalOption {
  id: string;
  label: string;
  badge: string;
  desc: string;
  icon: typeof BookOpen;
}

export const SUBJECTS: SubjectOption[] = [
  {
    id: "nursing_med",
    label: "Medicine & Nursing",
    shortLabel: "Medicine",
    tomeTitle: "Emerald Clinical Grimoire",
    desc: "Pharmacology, anatomy, clinical reasoning & NCLEX/USMLE prep",
    icon: "🩺",
    tomeColor: "#165B33",
    tomeLightColor: "#228B22",
    trimColor: "#E3B04B",
  },
  {
    id: "stem_eng",
    label: "STEM & Engineering",
    shortLabel: "STEM",
    tomeTitle: "Gilded Blueprint Codex",
    desc: "Calculus, physics, algorithms, circuits & formal proofs",
    icon: "⚙️",
    tomeColor: "#4A2E1B",
    tomeLightColor: "#7D5312",
    trimColor: "#E3B04B",
  },
  {
    id: "law_gov",
    label: "Law & Governance",
    shortLabel: "Law",
    tomeTitle: "Gilded Juris Corpus",
    desc: "Statutes, case doctrine, constitutional briefs & bar exam review",
    icon: "⚖️",
    tomeColor: "#741B1B",
    tomeLightColor: "#9B2C2C",
    trimColor: "#E3B04B",
  },
  {
    id: "bus_acc",
    label: "Business & Accounting",
    shortLabel: "Business",
    tomeTitle: "Burnished Commerce Ledger",
    desc: "Financial modeling, valuation, corporate strategy & accounting",
    icon: "📊",
    tomeColor: "#7B4A12",
    tomeLightColor: "#B7791F",
    trimColor: "#F7D486",
  },
  {
    id: "hum_soc",
    label: "Humanities & Social Sciences",
    shortLabel: "Humanities",
    tomeTitle: "Aged Scholar Folio",
    desc: "Philosophy, literature, historiography & essay synthesis",
    icon: "📚",
    tomeColor: "#4A3324",
    tomeLightColor: "#744E36",
    trimColor: "#E8DEC8",
  },
  {
    id: "other",
    label: "General & Other Subjects",
    shortLabel: "General",
    tomeTitle: "Velvet Night Compendium",
    desc: "Interdisciplinary research, open inquiry & customized study",
    icon: "🎓",
    tomeColor: "#2A1F4E",
    tomeLightColor: "#44337A",
    trimColor: "#E3B04B",
  },
];

export const GOALS: GoalOption[] = [
  {
    id: "understand",
    label: "Understand a difficult topic",
    badge: "Socratic Intuition",
    desc: "Step-by-step logic, analogies, and Socratic breakdowns",
    icon: BookOpen,
  },
  {
    id: "organize",
    label: "Organize my notes & slides",
    badge: "Note Synthesis",
    desc: "Clean outlines, summaries, and structured study guides",
    icon: TreeStructure,
  },
  {
    id: "quiz",
    label: "Practice rapid quiz drills",
    badge: "Active Recall",
    desc: "Active recall questions with defensible rationales",
    icon: Target,
  },
  {
    id: "exam",
    label: "Prepare for a major exam",
    badge: "Exam Blueprint",
    desc: "Full-length timed simulation & blueprint weighting",
    icon: GraduationCap,
  },
  {
    id: "essay",
    label: "Review & grade an essay draft",
    badge: "Rubric Grading",
    desc: "Rubric criteria scores and constructive critiques",
    icon: FileText,
  },
];

export const PROMPT_SUGGESTIONS = [
  "Explain core mechanisms with an intuitive clinical or real-world analogy",
  "Generate 5 high-yield active recall quiz questions with rationales",
  "Synthesize lecture slides into an exam-focused cheat sheet",
];

interface PixelDeskSceneProps {
  step: number;
  subject: SubjectOption;
  goal: GoalOption;
}

/**
 * 16-Bit Pixel Desk Scene
 * Dynamically renders the scholar's desk:
 * Step 1: Leather-bound discipline tome on wooden desk (lamp unlit).
 * Step 2: Brass lamp ignites with warm amber light cone & filament flares.
 * Step 3: Scholar's quill & inkwell appear with illuminated study ambiance.
 */
export function PixelDeskScene({ step, subject, goal }: PixelDeskSceneProps) {
  const isLampLit = step >= 2;
  const hasQuill = step >= 3;
  const sceneRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={sceneRef}
      role="img"
      aria-label={`16-bit Pixel Desk: ${subject.label} tome on desk, ${
        isLampLit ? "battery fully charged" : "battery in standby"
      }, ${hasQuill ? "quill ready" : "awaiting quill"}`}
      className="relative w-full h-[120px] sm:h-[135px] overflow-hidden border-b border-hairline bg-night select-none group shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]"
      style={{ imageRendering: "pixelated" }}
    >
      {/* 16-Bit SVG Scene */}
      <svg
        viewBox="0 0 360 120"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
        style={{ shapeRendering: "crispEdges" }}
      >
        <defs>
          {/* Battery Ambient Glow Gradient */}
          <radialGradient id="lampGlow" cx="240" cy="58" r="75" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" stopOpacity="0.75" />
            <stop offset="35%" stopColor="#E3B04B" stopOpacity="0.4" />
            <stop offset="70%" stopColor="#B88428" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0B0F1A" stopOpacity="0" />
          </radialGradient>

          {/* Dither pattern for wall texture */}
          <pattern id="deskDither" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="1" height="1" fill="#1A2136" fillOpacity="0.3" />
            <rect x="2" y="2" width="1" height="1" fill="#1A2136" fillOpacity="0.3" />
          </pattern>
        </defs>

        {/* ── Background Wall & Bookshelf Silhouette ── */}
        <rect x="0" y="0" width="360" height="78" fill="#0B0F1A" />
        <rect x="0" y="0" width="360" height="78" fill="url(#deskDither)" />

        {/* Background Shelf */}
        <rect x="15" y="18" width="120" height="4" fill="#1A2136" />
        <rect x="15" y="22" width="120" height="2" fill="#0B0F1A" />
        {/* Background Shelf Books */}
        <rect x="22" y="8" width="7" height="10" fill="#222C44" />
        <rect x="31" y="6" width="9" height="12" fill="#4A2E1B" />
        <rect x="42" y="9" width="6" height="9" fill="#171F32" />
        <rect x="50" y="5" width="8" height="13" fill="#B88428" />
        <rect x="60" y="7" width="10" height="11" fill="#E3B04B" />
        <rect x="72" y="8" width="8" height="10" fill="#222C44" />
        <rect x="82" y="6" width="6" height="12" fill="#78B084" />
        <rect x="90" y="10" width="14" height="8" fill="#171F32" />

        {/* Ambient Starlight Windowpane (Top Right) */}
        <rect x="315" y="10" width="30" height="30" fill="#1A2136" />
        <rect x="317" y="12" width="12" height="12" fill="#0B0F1A" />
        <rect x="331" y="12" width="12" height="12" fill="#0B0F1A" />
        <rect x="317" y="26" width="12" height="12" fill="#0B0F1A" />
        <rect x="331" y="26" width="12" height="12" fill="#0B0F1A" />
        <rect x="322" y="16" width="2" height="2" fill="#E3B04B" />
        <rect x="336" y="21" width="2" height="2" fill="#F7D486" />

        {/* ── Wooden Scholar Desk ── */}
        {/* Desk top bevel highlight */}
        <rect x="0" y="78" width="360" height="2" fill="#5A3822" />
        {/* Desk wooden surface */}
        <rect x="0" y="80" width="360" height="30" fill="#3D2617" />
        {/* Wood grain lines */}
        <rect x="10" y="84" width="70" height="1" fill="#2A1B10" opacity="0.6" />
        <rect x="120" y="88" width="110" height="1" fill="#4A2E1B" opacity="0.8" />
        <rect x="260" y="83" width="90" height="1" fill="#2A1B10" opacity="0.6" />
        <rect x="40" y="94" width="180" height="1" fill="#2A1B10" opacity="0.7" />
        {/* Desk front bottom shadow edge */}
        <rect x="0" y="110" width="360" height="10" fill="#1A1108" />

        {/* ── Dynamic Layer 1: The Leather-Bound Tome ── */}
        <g id="sceneTome">
          {/* Desk contact shadow */}
          <rect x="58" y="88" width="76" height="5" fill="#0B0F1A" fillOpacity="0.65" />

          {/* Tome Backing / Leather Spine */}
          <rect x="62" y="52" width="68" height="36" fill="#1A1108" />
          <rect x="64" y="54" width="64" height="32" fill={subject.tomeColor} />
          <rect x="66" y="56" width="60" height="28" fill={subject.tomeLightColor} fillOpacity="0.4" />

          {/* Raised Spine Ribs */}
          <rect x="62" y="58" width="5" height="2" fill="#1A1108" />
          <rect x="62" y="68" width="5" height="2" fill="#1A1108" />
          <rect x="62" y="78" width="5" height="2" fill="#1A1108" />

          {/* Parchment Page Edges */}
          <rect x="68" y="81" width="57" height="4" fill="#E8DEC8" />
          <rect x="69" y="82" width="55" height="1" fill="#D4C5A9" />
          <rect x="69" y="84" width="55" height="1" fill="#F5F0E6" />

          {/* Gold Trim Corner Brackets */}
          <rect x="67" y="56" width="4" height="2" fill={subject.trimColor} />
          <rect x="67" y="56" width="2" height="4" fill={subject.trimColor} />
          <rect x="121" y="56" width="4" height="2" fill={subject.trimColor} />
          <rect x="123" y="56" width="2" height="4" fill={subject.trimColor} />
          <rect x="67" y="77" width="4" height="2" fill={subject.trimColor} />
          <rect x="67" y="75" width="2" height="4" fill={subject.trimColor} />
          <rect x="121" y="77" width="4" height="2" fill={subject.trimColor} />
          <rect x="123" y="75" width="2" height="4" fill={subject.trimColor} />

          {/* Central Discipline Sigil Emboss */}
          <rect x="91" y="64" width="12" height="12" fill={subject.trimColor} />
          <rect x="93" y="66" width="8" height="8" fill={subject.tomeColor} />
          <rect x="96" y="69" width="2" height="2" fill={subject.trimColor} />

          {/* Silk Bookmark Ribbon */}
          <path d="M 95 85 L 98 96 L 95 94 L 92 96 Z" fill="#C85848" />
        </g>

        {/* ── Dynamic Layer 2: 16-Bit Warm Brass Battery Companion ── */}
        <g id="sceneLamp">
          {/* Contact Shadow on Desk */}
          <ellipse cx="240" cy="85" rx="20" ry="4" fill="#0B0F1A" fillOpacity="0.75" />

          {/* Terminal Cap */}
          <rect x="234" y="36" width="12" height="4" fill="#94A3B8" stroke="#1A1108" strokeWidth="1" />
          <rect x="236" y="37" width="8" height="1" fill="#E2E8F0" />

          {/* Chassis Outline */}
          <rect x="222" y="40" width="36" height="44" rx="4" fill="#1A1108" />

          {/* Warm Brass Body */}
          <rect x="224" y="42" width="32" height="40" rx="3" fill="#B88428" />
          <rect x="225" y="43" width="3" height="38" fill="#F7D486" />
          <rect x="252" y="43" width="3" height="38" fill="#7D5312" />

          {/* Digital LED Screen */}
          <rect x="229" y="47" width="22" height="16" rx="2" fill="#080B12" stroke="#1F160E" strokeWidth="1" />

          {isLampLit ? (
            <>
              {/* Active / Glowing Face */}
              <rect x="232" y="51" width="4" height="4" fill="#FDE047" className="anim-px-flicker" />
              <rect x="244" y="51" width="4" height="4" fill="#FDE047" className="anim-px-flicker" />
              <rect x="236" y="58" width="8" height="2" rx="1" fill="#FDE047" />

              {/* Charging Level Bars */}
              <g transform="translate(229, 67)">
                <rect x="0" y="0" width="22" height="8" rx="1" fill="#1F160E" />
                <rect x="2" y="2" width="4" height="4" fill="#78B084" className="anim-px-flicker" />
                <rect x="7" y="2" width="4" height="4" fill="#78B084" className="anim-px-flicker" />
                <rect x="12" y="2" width="4" height="4" fill="#FDE047" className="anim-px-flicker" />
                <rect x="17" y="2" width="3" height="4" fill="#FDE047" />
              </g>

              {/* Radiant Light Cone */}
              <circle cx="240" cy="58" r="65" fill="url(#lampGlow)" className="anim-px-flicker" />

              {/* Desk Amber Reflection */}
              <ellipse cx="240" cy="85" rx="36" ry="8" fill="#E3B04B" fillOpacity="0.22" />

              {/* Electric Sparks */}
              <rect x="218" y="44" width="2" height="2" fill="#FDE047" className="anim-px-breathe" />
              <rect x="262" y="52" width="2" height="2" fill="#FFE066" className="anim-px-flicker" />
              <rect x="246" y="32" width="2" height="2" fill="#FDE047" opacity="0.8" />
            </>
          ) : (
            <>
              {/* Standby Dim Face */}
              <rect x="233" y="52" width="3" height="2" fill="#4A3622" />
              <rect x="244" y="52" width="3" height="2" fill="#4A3622" />
              <rect x="238" y="58" width="4" height="1" fill="#4A3622" />

              {/* Single Standby Bar */}
              <g transform="translate(229, 67)">
                <rect x="0" y="0" width="22" height="8" rx="1" fill="#1F160E" />
                <rect x="2" y="2" width="4" height="4" fill="#4A3622" />
              </g>
            </>
          )}
        </g>

        {/* ── Dynamic Layer 3: Scholar's Quill & Inkpot ── */}
        {hasQuill && (
          <g id="sceneQuill">
            {/* Inkpot Glass Body */}
            <rect x="156" y="78" width="14" height="8" fill="#1A1108" />
            <rect x="157" y="79" width="12" height="6" fill="#171F32" />
            <rect x="158" y="80" width="10" height="4" fill="#080B12" />
            {/* Inkpot Rim Highlight */}
            <rect x="159" y="77" width="8" height="2" fill="#E3B04B" />

            {/* Inset Gold Ferrule & Feather Quill */}
            <line x1="163" y1="79" x2="182" y2="46" stroke="#E3B04B" strokeWidth="2" />
            {/* Feather Vane */}
            <polygon points="174,58 186,40 181,42 170,56" fill="#F5F0E6" />
            <polygon points="176,57 185,42 182,44 172,56" fill="#E8DEC8" />
            <polygon points="172,54 178,45 175,47 169,53" fill="#D4C5A9" />

            {/* Inscription Scroll beside Inkpot */}
            <rect x="175" y="82" width="28" height="8" fill="#E8DEC8" />
            <rect x="176" y="84" width="24" height="1" fill="#4A2E1B" opacity="0.6" />
            <rect x="176" y="87" width="18" height="1" fill="#4A2E1B" opacity="0.6" />
          </g>
        )}
      </svg>

      {/* ── Overlay Badges & Stepped HUD ── */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
        <PixelBadge variant={isLampLit ? "brass" : "neutral"} size="sm">
          {step === 1 ? "Domain Setup" : step === 2 ? "Goal Calibrated" : "Workspace Initialized"}
        </PixelBadge>
        {isLampLit && (
          <span className="hidden sm:inline-flex text-[10px] font-mono text-brasspale bg-night/80 px-1.5 py-0.5 border border-brass/30">
            {goal.badge}
          </span>
        )}
      </div>

      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-faded bg-night/85 px-2 py-0.5 border border-hairline flex items-center gap-1">
        <span>Tome:</span>
        <span className="text-parchment font-semibold">{subject.shortLabel}</span>
      </div>
    </div>
  );
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState<number>(1);
  const [selectedSubject, setSelectedSubject] = useState<string>("nursing_med");
  const [selectedGoal, setSelectedGoal] = useState<string>("understand");
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const modalRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const headingId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentSubject = SUBJECTS.find((s) => s.id === selectedSubject) || SUBJECTS[0];
  const currentGoal = GOALS.find((g) => g.id === selectedGoal) || GOALS[0];

  const handleLaunch = () => {
    try {
      sessionStorage.setItem(
        "comtus_kickstart",
        JSON.stringify({
          subject: currentSubject.label,
          goal: currentGoal.label,
          goalId: selectedGoal,
          prompt: inputPrompt.trim(),
        })
      );
    } catch {}
    onClose();
    navigate("/studio");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-night/85 p-3 sm:p-4 backdrop-blur-md animate-fadeIn overflow-y-auto"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-xl my-auto overflow-hidden rounded-[2px] border border-brass/40 bg-study text-parchment shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_0_1px_rgba(227,176,75,0.2)]"
        style={{ imageRendering: "pixelated" }}
      >
        {/* Close Button (Touch target >= 44px) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-[2px] border border-hairline bg-night/80 text-faded hover:border-brass hover:text-parchment transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* ── 16-Bit Pixel Art Scene Preview ── */}
        <PixelDeskScene
          step={step}
          subject={currentSubject}
          goal={currentGoal}
        />

        {/* ── Modal Content Container ── */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Step Breadcrumb Header */}
          <div className="flex items-center justify-between border-b border-hairline pb-2.5">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-brass">
              <span className="font-semibold">Step {step} of 3</span>
              <span className="text-muted/40">/</span>
              <span className="text-faded">
                {step === 1
                  ? "Discipline Domain"
                  : step === 2
                  ? "Pedagogical Objective"
                  : "Workspace Seed"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => s <= step && setStep(s)}
                  aria-label={`Go to step ${s}`}
                  className={`h-2 transition-all rounded-[1px] ${
                    s === step
                      ? "w-6 bg-brass"
                      : s < step
                      ? "w-3 bg-sage cursor-pointer"
                      : "w-3 bg-shelf border border-hairline"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              STEP 1: DISCIPLINE SELECTION
              ══════════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-3.5 animate-fadeIn">
              <div>
                <h3 id={headingId} className="font-display text-[1.4rem] sm:text-[1.55rem] font-semibold text-parchment leading-tight">
                  What discipline are you studying?
                </h3>
                <p className="text-[13px] text-faded mt-1">
                  Select your academic discipline to configure reasoning depth and curriculum blueprints.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Study discipline"
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1"
              >
                {SUBJECTS.map((sub) => {
                  const isSelected = selectedSubject === sub.id;
                  return (
                    <button
                      type="button"
                      key={sub.id}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setSelectedSubject(sub.id);
                      }}
                      className={`flex items-center gap-3 rounded-[2px] border p-3 text-left transition-all cursor-pointer min-h-[48px] ${
                        isSelected
                          ? "border-brass bg-shelf text-parchment shadow-[2px_2px_0px_var(--color-night),inset_0_0_0_1px_var(--color-brass)]"
                          : "border-hairline bg-study text-faded hover:border-muted hover:text-parchment"
                      }`}
                    >
                      <span className="text-xl shrink-0 p-1.5 rounded-[2px] bg-night border border-hairline">
                        {sub.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-mono font-medium text-parchment flex items-center justify-between">
                          <span className="truncate">{sub.label}</span>
                          {isSelected && <Check size={14} className="text-brass shrink-0 ml-1" />}
                        </div>
                        <div className="text-[11px] text-faded truncate">{sub.tomeTitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-hairline">
                <span className="text-[11.5px] font-mono text-faded">
                  Discipline set · Step 1 of 3
                </span>
                <PixelButton
                  variant="brass"
                  size="md"
                  rightIcon={<ArrowRight size={14} />}
                  onClick={() => setStep(2)}
                >
                  Continue
                </PixelButton>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              STEP 2: CALIBRATE PEDAGOGICAL GOAL
              ══════════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-3.5 animate-fadeIn">
              <div>
                <h3 id={headingId} className="font-display text-[1.4rem] sm:text-[1.55rem] font-semibold text-parchment leading-tight">
                  What is your primary study objective?
                </h3>
                <p className="text-[13px] text-faded mt-1">
                  Calibrate the cognitive workspace for active recall, exam simulations, or Socratic breakdown.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Learning objective"
                className="space-y-2 pt-1"
              >
                {GOALS.map((g) => {
                  const Icon = g.icon;
                  const isSelected = selectedGoal === g.id;
                  return (
                    <button
                      type="button"
                      key={g.id}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setSelectedGoal(g.id);
                      }}
                      className={`flex w-full items-start gap-3 rounded-[2px] border p-2.5 sm:p-3 text-left transition-all cursor-pointer min-h-[48px] ${
                        isSelected
                          ? "border-brass bg-shelf text-parchment shadow-[2px_2px_0px_var(--color-night),inset_0_0_0_1px_var(--color-brass)]"
                          : "border-hairline bg-study text-faded hover:border-muted hover:text-parchment"
                      }`}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-hairline bg-night">
                        <Icon size={14} className={isSelected ? "text-brass" : "text-faded"} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[13px] font-mono font-medium text-parchment truncate">{g.label}</div>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[1px] border shrink-0 ${
                            isSelected
                              ? "border-brass/60 text-brass bg-brass/10"
                              : "border-hairline text-faded bg-night"
                          }`}>
                            {g.badge}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-faded line-clamp-1">{g.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-hairline">
                <PixelButton
                  variant="ghost"
                  size="md"
                  leftIcon={<ArrowLeft size={14} />}
                  onClick={() => setStep(1)}
                >
                  Back
                </PixelButton>
                <PixelButton
                  variant="brass"
                  size="md"
                  rightIcon={<ArrowRight size={14} />}
                  onClick={() => setStep(3)}
                >
                  Next Step
                </PixelButton>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              STEP 3: INITIALIZE WORKSPACE
              ══════════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-3.5 animate-fadeIn">
              <div>
                <h3 id={headingId} className="font-display text-[1.4rem] sm:text-[1.55rem] font-semibold text-parchment leading-tight">
                  What topic or material are we tackling?
                </h3>
                <p className="text-[13px] text-faded mt-1">
                  Enter your topic or paste lecture notes to seed the cognitive workspace.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <textarea
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder="e.g., Photosynthesis light reactions, Nursing pharmacology drug dosages, or paste lecture notes here..."
                  rows={3}
                  className="w-full rounded-[2px] border border-hairline bg-night p-3 text-[13px] font-mono text-parchment placeholder-faded/60 outline-none focus:border-brass focus:ring-1 focus:ring-brass"
                />

                {/* Prompt Suggestions */}
                <div className="space-y-1">
                  <div className="text-[10.5px] font-mono uppercase tracking-wider text-faded">
                    Suggested Inscriptions:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_SUGGESTIONS.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setInputPrompt(preset)}
                        className="text-[11px] font-mono px-2 py-1 rounded-[1px] border border-hairline bg-shelf text-faded hover:text-parchment hover:border-brass/50 transition-colors text-left"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-hairline">
                <PixelButton
                  variant="ghost"
                  size="md"
                  leftIcon={<ArrowLeft size={14} />}
                  onClick={() => setStep(2)}
                >
                  Back
                </PixelButton>
                <PixelButton
                  variant="brass"
                  size="lg"
                  leftIcon={<Sparkle size={15} />}
                  onClick={handleLaunch}
                  className="shadow-[0_4px_20px_rgba(227,176,75,0.25)]"
                >
                  Launch Study Workspace
                </PixelButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

