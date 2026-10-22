import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, GraduationCap, Target, TreeStructure } from "@phosphor-icons/react";
import { Button, Dialog, Input } from "../ui";
import { createNotebook } from "../lib/db";
import "./landing.css";
import { ICON } from "../ui/iconScale";

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
}

export interface GoalOption {
  id: string;
  label: string;
  badge: string;
  desc: string;
  icon: typeof BookOpen;
}

export const SUBJECTS: SubjectOption[] = [
  { id: "nursing_med", label: "Medicine & Nursing", shortLabel: "Medicine", tomeTitle: "Clinical study", desc: "Anatomy, pharmacology, and nursing practice", icon: "🩺" },
  { id: "stem_eng", label: "STEM & Engineering", shortLabel: "STEM", tomeTitle: "Science and engineering", desc: "Mathematics, physics, and engineering", icon: "⚙️" },
  { id: "law_gov", label: "Law & Governance", shortLabel: "Law", tomeTitle: "Legal study", desc: "Statutes, case law, and governance", icon: "⚖️" },
  { id: "bus_acc", label: "Business & Accounting", shortLabel: "Business", tomeTitle: "Business study", desc: "Finance, accounting, and business", icon: "📊" },
  { id: "hum_soc", label: "Humanities & Social Sciences", shortLabel: "Humanities", tomeTitle: "Humanities study", desc: "Literature, history, and social sciences", icon: "📚" },
  { id: "other", label: "General & Other Subjects", shortLabel: "General", tomeTitle: "Your study topic", desc: "A course, an exam, or a topic of your own", icon: "🎓" },
];

export const GOALS: GoalOption[] = [
  { id: "understand", label: "Understand a difficult topic", badge: "Understand", desc: "Ask questions about your material", icon: BookOpen },
  { id: "organize", label: "Organize my notes & slides", badge: "Organise", desc: "Create an outline or a study guide", icon: TreeStructure },
  { id: "quiz", label: "Practice rapid quiz drills", badge: "Practise", desc: "Test yourself and review the explanations", icon: Target },
  { id: "exam", label: "Prepare for a major exam", badge: "Exam preparation", desc: "Build practice from your review materials", icon: GraduationCap },
  { id: "essay", label: "Review & grade an essay draft", badge: "Essay feedback", desc: "Review your argument and supporting evidence", icon: FileText },
];

export const PROMPT_SUGGESTIONS = ["Learning and memory", "Financial accounting", "Research methods"];

export function PixelDeskScene({ subject, goal }: { step: number; subject: SubjectOption; goal: GoalOption }) {
  return (
    <div className="landing-setup-legacy" aria-hidden="true">
      <BookOpen size={ICON.xxl} />
      <span>{subject.shortLabel} notebook</span>
      <span>{goal.badge}</span>
    </div>
  );
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const topicId = useId();
  const hintId = useId();
  const navigate = useNavigate();

  const close = () => {
    if (!pending) onClose();
  };

  const createDesk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = topic.trim();
    if (!title || pending) return;
    setPending(true);
    setError("");
    try {
      const notebook = await createNotebook(title);
      onClose();
      navigate(`/studio/${notebook.id}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "The notebook could not be created. Try again.");
      setPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={close} title="Set up your study desk">
      <form className="landing-setup" aria-label="Create a study notebook" aria-busy={pending} onSubmit={(event) => void createDesk(event)}>
        <p className="landing-setup-intro">Start with one topic. Your notebook will keep its sources, questions, and practice together.</p>
        <div className="landing-setup-field">
          <label htmlFor={topicId}>Notebook topic</label>
          <Input id={topicId} value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={80} required disabled={pending} placeholder="e.g. Learning and memory" aria-describedby={hintId} />
          <p id={hintId}>A course, an exam, or a topic. You can rename it later.</p>
        </div>
        <div className="landing-setup-suggestions" aria-label="Example topics">
          {PROMPT_SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" disabled={pending} onClick={() => setTopic(suggestion)}>{suggestion}</button>)}
        </div>
        <div className="landing-setup-next">
          <h3>Then, inside your notebook</h3>
          <ol>
            <li><span>Add your material</span><p>Import a PDF, add a link, or paste your notes.</p></li>
            <li><span>Follow a question</span><p>Connect an AI model and ask about your sources.</p></li>
            <li><span>Make time to practise</span><p>Choose a quiz, flashcards, or a study guide at the desk.</p></li>
          </ol>
        </div>
        {error && <p className="landing-setup-error" role="alert">{error}</p>}
        <div className="landing-setup-actions">
          <Button variant="ghost" onClick={close} disabled={pending}>Not now</Button>
          <Button type="submit" disabled={!topic.trim()} loading={pending}>{pending ? "Creating notebook…" : "Create notebook"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
