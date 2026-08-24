import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight, BookOpen, Target, Sparkles, FolderTree, FileText, GraduationCap } from "lucide-react";
import "./landing.css";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUBJECTS = [
  { id: "nursing_med", label: "Medicine & Nursing", icon: "🩺" },
  { id: "stem_eng", label: "STEM & Engineering", icon: "⚙️" },
  { id: "bus_acc", label: "Business & Accounting", icon: "📊" },
  { id: "law_gov", label: "Law & Governance", icon: "⚖️" },
  { id: "hum_soc", label: "Humanities & Social Sciences", icon: "📚" },
  { id: "other", label: "General & Other Subjects", icon: "🎓" },
];

const GOALS = [
  { id: "understand", label: "Understand a difficult topic", icon: BookOpen, desc: "Step-by-step logic, analogies, and Socratic breakdowns" },
  { id: "organize", label: "Organize my notes & slides", icon: FolderTree, desc: "Clean outlines, summaries, and structured study guides" },
  { id: "quiz", label: "Practice rapid quiz drills", icon: Target, desc: "Active recall questions with defensible rationales" },
  { id: "exam", label: "Prepare for a major exam", icon: GraduationCap, desc: "Full-length timed simulation & blueprint weighting" },
  { id: "essay", label: "Review & grade an essay draft", icon: FileText, desc: "Rubric criteria scores and constructive critiques" },
];

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState<number>(1);
  const [selectedSubject, setSelectedSubject] = useState<string>("nursing_med");
  const [selectedGoal, setSelectedGoal] = useState<string>("understand");
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const modalRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  const handleLaunch = () => {
    // We can store the kickstart intent in sessionStorage or localStorage
    try {
      const subjectObj = SUBJECTS.find((s) => s.id === selectedSubject);
      const goalObj = GOALS.find((g) => g.id === selectedGoal);
      sessionStorage.setItem(
        "comtus_kickstart",
        JSON.stringify({
          subject: subjectObj?.label || "General Study",
          goal: goalObj?.label || "Understand",
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
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-night/85 p-4 backdrop-blur-xl animate-fadeIn"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/15 bg-study p-6 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.7)] text-parchment"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-faded hover:text-parchment transition-colors"
        >
          <X size={15} />
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6 font-mono text-[11px] uppercase tracking-wider text-brasspale">
          <span>Step {step} of 3</span>
          <span className="text-white/20">/</span>
          <span>
            {step === 1
              ? "Select Subject"
              : step === 2
              ? "Choose Learning Goal"
              : "Kickstart Workspace"}
          </span>
        </div>

        {/* Step 1: Subject */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 id="onboarding-title" className="font-display text-[1.6rem] font-[430] leading-snug">
              What are you studying right now?
            </h3>
            <p className="text-[13.5px] text-faded">
              Comtus tailors its reasoning depth, terminology, and exam blueprints to your discipline.
            </p>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-2">
              {SUBJECTS.map((sub) => (
                <button
                  type="button"
                  key={sub.id}
                  onClick={() => setSelectedSubject(sub.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 text-left text-[13.5px] transition-all cursor-pointer ${
                    selectedSubject === sub.id
                      ? "border-brass bg-brass/15 text-parchment shadow-[0_0_20px_rgba(227,176,75,0.15)] font-medium"
                      : "border-white/[0.08] bg-white/[0.02] text-faded hover:border-white/20 hover:text-parchment"
                  }`}
                >
                  <span className="text-lg">{sub.icon}</span>
                  <span>{sub.label}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-full grad-lamp px-6 py-2.5 text-[13.5px] font-semibold text-night"
              >
                <span>Continue</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Goal */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-display text-[1.6rem] font-[430] leading-snug">
              What do you want help with first?
            </h3>
            <p className="text-[13.5px] text-faded">
              Pick your primary objective for this session.
            </p>

            <div className="space-y-2 pt-1">
              {GOALS.map((g) => {
                const Icon = g.icon;
                const isSelected = selectedGoal === g.id;
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => setSelectedGoal(g.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-brass bg-brass/15 text-parchment shadow-[0_0_15px_rgba(227,176,75,0.15)]"
                        : "border-white/[0.08] bg-white/[0.02] text-faded hover:border-white/20 hover:text-parchment"
                    }`}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                      <Icon size={14} className={isSelected ? "text-brass" : "text-faded"} />
                    </span>
                    <div>
                      <div className="text-[13.5px] font-medium text-parchment">{g.label}</div>
                      <div className="text-[12px] text-faded">{g.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-mono text-[12px] text-faded hover:text-parchment"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-full grad-lamp px-6 py-2.5 text-[13.5px] font-semibold text-night"
              >
                <span>Next Step</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Material or Initial Prompt */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-display text-[1.6rem] font-[430] leading-snug">
              What topic or material are we tackling?
            </h3>
            <p className="text-[13.5px] text-faded">
              Type a concept, paste messy notes, or jump right into an open workspace.
            </p>

            <div className="pt-2">
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="e.g., Photosynthesis light reactions, Nursing pharmacology drug dosages, or paste lecture notes here..."
                rows={4}
                className="w-full rounded-2xl border border-white/15 bg-night/80 p-4 text-[13.5px] text-parchment placeholder-faded/50 outline-none focus:border-brass/60"
              />
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="font-mono text-[12px] text-faded hover:text-parchment"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleLaunch}
                className="inline-flex items-center gap-2 rounded-full grad-lamp px-7 py-3 text-[14px] font-semibold text-night shadow-[0_8px_30px_rgba(227,176,75,0.3)] hover:shadow-[0_12px_40px_rgba(227,176,75,0.4)]"
              >
                <Sparkles size={15} />
                <span>Launch Study Workspace</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
