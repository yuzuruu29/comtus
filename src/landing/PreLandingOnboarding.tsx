import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";

import { ComtusEmblem } from "../components/brand/ComtusLogo";
import {
  SUBJECTS,
  GOALS,
  type SubjectOption,
  type GoalOption,
  PixelDeskScene,
} from "./OnboardingModal";
import {
  prefersReducedMotion,
  VELVET_DISSOLVE_EASE,
  STAGE_TRANSITION_EASE,
} from "./pixelMotion";
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Lightning, ShieldCheck, Sparkle, Target } from "@phosphor-icons/react";

export const ONBOARDING_SEEN_KEY = "comtus_onboarding_seen";

export interface PreLandingOnboardingProps {
  onComplete: (profile?: { subject: SubjectOption; goal: GoalOption }) => void;
  onSkip: () => void;
}

export default function PreLandingOnboarding({
  onComplete,
  onSkip,
}: PreLandingOnboardingProps) {
  const [step, setStep] = useState<number>(1);
  const [selectedSubject, setSelectedSubject] = useState<string>("nursing_med");
  const [selectedGoal, setSelectedGoal] = useState<string>("understand");
  const [isExiting, setIsExiting] = useState<boolean>(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const currentSubject =
    SUBJECTS.find((s) => s.id === selectedSubject) || SUBJECTS[0];
  const currentGoal =
    GOALS.find((g) => g.id === selectedGoal) || GOALS[0];

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  const handleExitToLanding = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    markSeen();

    if (prefersReducedMotion() || !rootRef.current) {
      onComplete({ subject: currentSubject, goal: currentGoal });
      return;
    }

    gsap.to(rootRef.current, {
      opacity: 0,
      y: -20,
      scale: 0.99,
      duration: 0.55,
      ease: VELVET_DISSOLVE_EASE,
      onComplete: () => {
        onComplete({ subject: currentSubject, goal: currentGoal });
      },
    });
  }, [isExiting, markSeen, currentSubject, currentGoal, onComplete]);

  const handleSkip = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    markSeen();

    if (prefersReducedMotion() || !rootRef.current) {
      onSkip();
      return;
    }

    gsap.to(rootRef.current, {
      opacity: 0,
      y: -20,
      duration: 0.45,
      ease: VELVET_DISSOLVE_EASE,
      onComplete: onSkip,
    });
  }, [isExiting, markSeen, onSkip]);

  const handleLaunchStudio = useCallback(() => {
    markSeen();
    try {
      sessionStorage.setItem(
        "comtus_kickstart",
        JSON.stringify({
          subject: currentSubject.label,
          goal: currentGoal.label,
          goalId: selectedGoal,
          prompt: "Begin Socratic study dialogue for this workspace",
        })
      );
    } catch {
      // Ignore storage errors
    }
    navigate("/studio");
  }, [markSeen, currentSubject, currentGoal, selectedGoal, navigate]);

  const goToNextStep = useCallback(() => {
    if (step < 3) {
      if (prefersReducedMotion() || !stageRef.current) {
        setStep((s) => s + 1);
        return;
      }

      gsap.to(stageRef.current, {
        opacity: 0,
        x: -16,
        duration: 0.22,
        ease: "power2.in",
        onComplete: () => {
          setStep((s) => s + 1);
          gsap.fromTo(
            stageRef.current,
            { opacity: 0, x: 16 },
            { opacity: 1, x: 0, duration: 0.35, ease: STAGE_TRANSITION_EASE }
          );
        },
      });
    } else {
      handleLaunchStudio();
    }
  }, [step, handleLaunchStudio]);

  const goToPrevStep = useCallback(() => {
    if (step > 1) {
      if (prefersReducedMotion() || !stageRef.current) {
        setStep((s) => s - 1);
        return;
      }

      gsap.to(stageRef.current, {
        opacity: 0,
        x: 16,
        duration: 0.22,
        ease: "power2.in",
        onComplete: () => {
          setStep((s) => s - 1);
          gsap.fromTo(
            stageRef.current,
            { opacity: 0, x: -16 },
            { opacity: 1, x: 0, duration: 0.35, ease: STAGE_TRANSITION_EASE }
          );
        },
      });
    }
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      } else if (e.key === "Enter" && !e.shiftKey) {
        // Prevent enter on buttons from double triggering
        if (
          document.activeElement?.tagName !== "BUTTON" &&
          document.activeElement?.tagName !== "A"
        ) {
          e.preventDefault();
          goToNextStep();
        }
      } else if (e.key === "ArrowLeft" && e.altKey) {
        e.preventDefault();
        goToPrevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSkip, goToNextStep, goToPrevStep]);

  // Initial stage reveal
  useEffect(() => {
    if (prefersReducedMotion() || !stageRef.current) return;
    gsap.fromTo(
      stageRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.6, ease: STAGE_TRANSITION_EASE }
    );
  }, []);

  return (
    <aside
      ref={rootRef}
      role="region"
      aria-label="Welcome and workspace setup"
      className="fixed inset-0 z-[250] flex flex-col justify-between bg-night text-parchment overflow-y-auto selection:bg-brass selection:text-night"
      style={{ imageRendering: "pixelated" }}
    >
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-hairline bg-night/95 px-4 py-3 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3">
          <ComtusEmblem size={24} breathe />
          <span className="font-display text-base font-bold tracking-[0.16em] text-parchment">
            COMTUS
          </span>
          <span className="hidden sm:inline-block font-mono text-[11px] text-faded uppercase tracking-wider pl-2 border-l border-hairline">
            Scholar Welcome
          </span>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 font-mono text-xs text-faded">
          <span
            className={`px-2 py-0.5 rounded-[2px] border transition-colors ${
              step === 1
                ? "border-brass text-brass bg-brass/10"
                : "border-hairline text-faded"
            }`}
          >
            01 Philosophy
          </span>
          <span className="text-hairline">/</span>
          <span
            className={`px-2 py-0.5 rounded-[2px] border transition-colors ${
              step === 2
                ? "border-brass text-brass bg-brass/10"
                : "border-hairline text-faded"
            }`}
          >
            02 Calibration
          </span>
          <span className="text-hairline">/</span>
          <span
            className={`px-2 py-0.5 rounded-[2px] border transition-colors ${
              step === 3
                ? "border-brass text-brass bg-brass/10"
                : "border-hairline text-faded"
            }`}
          >
            03 Launch
          </span>
        </div>

        {/* Skip Action */}
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Skip onboarding to landing page"
          className="group flex items-center gap-1.5 rounded-[2px] border border-hairline px-3 py-1.5 font-mono text-xs text-faded hover:border-brass hover:text-parchment transition-colors cursor-pointer min-h-[44px]"
        >
          <span>Skip to Overview</span>
          <span className="hidden sm:inline text-[10px] text-brass/70">[Esc]</span>
        </button>
      </header>

      {/* ── Main Interactive Stage ── */}
      <main
        ref={stageRef}
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 md:py-12"
      >
        {/* PHASE 1: Philosophy & Brand Introduction */}
        {step === 1 && (
          <div className="space-y-8 animate-fadeIn text-center sm:text-left">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-[2px] border border-brass/40 bg-brass/10 px-3 py-1 font-mono text-xs text-brass">
                <Sparkle size={14} className="text-brass" />
                <span>COGNITIVE INFRASTRUCTURE FOR SCHOLARS</span>
              </div>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-parchment leading-tight">
                Rough thought, polished.
              </h1>
              <p className="max-w-2xl text-base sm:text-lg text-faded leading-relaxed">
                Study in a warmer light. Comtus combines a tactile 16-bit
                scholar&apos;s desk with high-precision reasoning to transform
                complex coursework, lecture slides, and notes into durable
                understanding.
              </p>
            </div>

            {/* 3 Core Architecture Pillars */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
              <div className="rounded-[2px] border border-hairline bg-study p-4 transition-colors hover:border-brass/50">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[2px] border border-brass/30 bg-night text-brass">
                  <BookOpen size={18} />
                </div>
                <h2 className="font-display text-base font-bold text-parchment mb-1">
                  The Calibrated Desk
                </h2>
                <p className="text-xs text-faded leading-normal">
                  Distraction-free aged parchment interface with an interactive
                  desk companion that keeps your study sessions grounded.
                </p>
              </div>

              <div className="rounded-[2px] border border-hairline bg-study p-4 transition-colors hover:border-brass/50">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[2px] border border-brass/30 bg-night text-brass">
                  <Lightning size={18} />
                </div>
                <h2 className="font-display text-base font-bold text-parchment mb-1">
                  Cantor8 Architecture
                </h2>
                <p className="text-xs text-faded leading-normal">
                  Multi-model verified reasoning with strict grounding and
                  verifiable citations directly into your study materials.
                </p>
              </div>

              <div className="rounded-[2px] border border-hairline bg-study p-4 transition-colors hover:border-brass/50">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[2px] border border-brass/30 bg-night text-brass">
                  <ShieldCheck size={18} />
                </div>
                <h2 className="font-display text-base font-bold text-parchment mb-1">
                  Active Recall Drills
                </h2>
                <p className="text-xs text-faded leading-normal">
                  Generate defensible exam questions, Socratic analogies, and
                  rubric evaluations from your own slides and PDFs.
                </p>
              </div>
            </div>

            {/* Step 1 Call to Action */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <button
                type="button"
                onClick={goToNextStep}
                className="group flex w-full sm:w-auto items-center justify-center gap-3 rounded-[2px] border border-brass/80 bg-brass px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-night shadow-[0_4px_16px_rgba(227,176,75,0.25)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer min-h-[48px]"
              >
                <span>Calibrate Your Desk</span>
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>
              <span className="font-mono text-xs text-faded">
                Step 1 of 3 — Press [Enter] to continue
              </span>
            </div>
          </div>
        )}

        {/* PHASE 2: Calibration (Discipline & Study Goal) */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-parchment">
                  Calibrate Your Scholar&apos;s Desk
                </h1>
                <span className="font-mono text-xs text-brass">
                  Step 2 of 3
                </span>
              </div>
              <p className="text-sm text-faded">
                Select your academic discipline and primary focus. Watch your
                16-bit desk dynamically adapt.
              </p>
            </div>

            {/* 16-Bit Pixel Desk Centerpiece */}
            <div className="overflow-hidden rounded-[2px] border border-brass/40 bg-study shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
              <PixelDeskScene
                step={2}
                subject={currentSubject}
                goal={currentGoal}
              />
            </div>

            {/* ── Selection Grids ── */}
            <div className="space-y-5">
              {/* Discipline Selection */}
              <div>
                <div className="block font-mono text-xs uppercase tracking-wider text-faded mb-2.5">
                  1. Study Domain
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {SUBJECTS.map((s) => {
                    const isSelected = s.id === selectedSubject;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSubject(s.id)}
                        className={`flex items-start gap-2.5 rounded-[2px] border p-2.5 text-left transition-all cursor-pointer min-h-[48px] ${
                          isSelected
                            ? "border-brass bg-brass/15 text-parchment shadow-[inset_0_0_8px_rgba(227,176,75,0.2)]"
                            : "border-hairline bg-study text-faded hover:border-brass/40 hover:text-parchment"
                        }`}
                      >
                        <span className="text-xl select-none">{s.icon}</span>
                        <div className="min-w-0">
                          <div className="font-display text-xs font-bold text-parchment truncate">
                            {s.label}
                          </div>
                          <div className="text-[10px] text-faded truncate">
                            {s.tomeTitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Goal Selection */}
              <div>
                <div className="block font-mono text-xs uppercase tracking-wider text-faded mb-2.5">
                  2. Primary Learning Focus
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {GOALS.map((g) => {
                    const isSelected = g.id === selectedGoal;
                    const Icon = g.icon;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGoal(g.id)}
                        className={`flex items-center gap-2.5 rounded-[2px] border p-2.5 text-left transition-all cursor-pointer min-h-[44px] ${
                          isSelected
                            ? "border-brass bg-brass/15 text-parchment shadow-[inset_0_0_8px_rgba(227,176,75,0.2)]"
                            : "border-hairline bg-study text-faded hover:border-brass/40 hover:text-parchment"
                        }`}
                      >
                        <Icon
                          size={16}
                          className={
                            isSelected ? "text-brass shrink-0" : "text-faded shrink-0"
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-xs font-bold text-parchment truncate">
                            {g.label}
                          </div>
                          <div className="text-[10px] text-brass/80 font-mono">
                            {g.badge}
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={14} className="text-brass shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between border-t border-hairline pt-4">
              <button
                type="button"
                onClick={goToPrevStep}
                className="flex items-center gap-2 rounded-[2px] border border-hairline px-4 py-2 font-mono text-xs text-faded hover:border-brass hover:text-parchment transition-colors cursor-pointer min-h-[44px]"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={goToNextStep}
                className="group flex items-center gap-2 rounded-[2px] border border-brass/80 bg-brass px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-night shadow-[0_4px_12px_rgba(227,176,75,0.2)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
              >
                <span>Continue to Preview</span>
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </div>
          </div>
        )}

        {/* PHASE 3: Preview & Launch Choices */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-parchment">
                  Your Scholar Workspace is Primed
                </h1>
                <span className="font-mono text-xs text-brass">
                  Step 3 of 3
                </span>
              </div>
              <p className="text-sm text-faded">
                The lamp is burning, your discipline tome is bound, and the
                Cantor8 engine is calibrated. Choose how you would like to begin.
              </p>
            </div>

            {/* Fully Illuminated Pixel Desk Scene */}
            <div className="overflow-hidden rounded-[2px] border border-brass/50 bg-study shadow-[0_16px_48px_rgba(0,0,0,0.7)]">
              <PixelDeskScene
                step={3}
                subject={currentSubject}
                goal={currentGoal}
              />
            </div>

            {/* Summary Configuration Card */}
            <div className="rounded-[2px] border border-hairline bg-study p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2.5">
                <span className="font-mono text-xs text-faded uppercase tracking-wider">
                  Calibrated Study Configuration
                </span>
                <span className="font-mono text-[11px] text-brass bg-brass/10 px-2 py-0.5 border border-brass/30">
                  Ready for Session
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[11px] text-faded font-mono">
                    Discipline Tome:
                  </span>
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-parchment">
                    <span>{currentSubject.icon}</span>
                    <span>{currentSubject.label}</span>
                  </div>
                  <p className="text-[11px] text-faded">
                    {currentSubject.desc}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-faded font-mono">
                    Primary Objective:
                  </span>
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-parchment">
                    <Target size={14} className="text-brass" />
                    <span>{currentGoal.label}</span>
                  </div>
                  <p className="text-[11px] text-brass/80 font-mono">
                    Mode: {currentGoal.badge}
                  </p>
                </div>
              </div>
            </div>

            {/* Dual Exit Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={goToPrevStep}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-[2px] border border-hairline px-4 py-3 font-mono text-xs text-faded hover:border-brass hover:text-parchment transition-colors cursor-pointer min-h-[48px]"
              >
                <ArrowLeft size={14} />
                <span>Adjust Configuration</span>
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExitToLanding}
                  className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-[2px] border border-hairline bg-study px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-parchment hover:border-brass/60 hover:text-white transition-all cursor-pointer min-h-[48px]"
                >
                  <Compass size={14} className="text-brass" />
                  <span>Explore Landing Page</span>
                </button>

                <button
                  type="button"
                  onClick={handleLaunchStudio}
                  className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-[2px] border border-brass/80 bg-brass px-6 py-3 font-display text-xs font-bold uppercase tracking-wider text-night shadow-[0_4px_20px_rgba(227,176,75,0.3)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer min-h-[48px]"
                >
                  <Sparkle size={14} />
                  <span>Launch into Studio</span>
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Subtle Footer Note ── */}
      <footer className="border-t border-hairline bg-night/80 px-4 py-2 text-center font-mono text-[11px] text-faded">
        Comtus Precision-Instrument Console · Study in a warmer light.
      </footer>
    </aside>
  );
}
