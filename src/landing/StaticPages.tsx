import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, BookOpen, FileText, Mail, Sparkles } from "lucide-react";
import Footer from "./Footer";
import "./landing.css";

interface StaticPageLayoutProps {
  title: string;
  subtitle: string;
  icon?: typeof Shield;
  children: React.ReactNode;
}

export function StaticPageLayout({ title, subtitle, icon: Icon = BookOpen, children }: StaticPageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-ground text-ink selection:bg-brass selection:text-night">
      <div className="grain" aria-hidden />

      {/* Floating Back Navigation Header */}
      <header className="fixed inset-x-0 top-5 z-[100] mx-auto flex w-max items-center gap-3 rounded-full border border-white/10 bg-night/65 px-5 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 font-mono text-[12px] text-faded hover:text-parchment transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Back to Home</span>
        </button>
        <span className="text-white/20">|</span>
        <Link to="/studio" className="font-mono text-[12px] text-brasspale hover:underline">
          Open Studio →
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-32 sm:pt-40">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brass/30 bg-brass/10 text-brasspale">
            <Icon size={20} />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass/80">
            Comtus Documentation
          </span>
        </div>

        <h1 className="mt-4 font-display text-[clamp(2.4rem,5.5vw,3.8rem)] font-[420] text-parchment leading-tight">
          {title}
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-faded max-w-2xl">
          {subtitle}
        </p>

        <div className="mt-12 space-y-8 rounded-[2rem] border border-white/[0.08] bg-study/40 p-7 sm:p-12 text-[14.5px] leading-relaxed text-parchment/90 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export function AboutPage() {
  return (
    <StaticPageLayout
      title="About Comtus"
      subtitle="The story of a thinking study companion, built for the quiet hours of deliberate study."
      icon={Sparkles}
    >
      <div className="space-y-6">
        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale">
          Name & Heritage
        </h2>
        <p>
          <strong>Comtus</strong> originates from the Latin <em>comptus</em>: &ldquo;adorned, polished, refined; carefully arranged.&rdquo; It is the past participle of <em>comere</em> (&ldquo;to care for, to arrange&rdquo;) and kin to <em>computus</em>, the medieval scholarly discipline of precise astronomical and calendrical calculation.
        </p>
        <p>
          We believe studying is an authentic craft. Rough thoughts — highlighted notes, half-formed questions, messy lecture slides — are worked and reworked until they shine. Comtus provides the quiet midnight desk where this deep thinking happens.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          Core Product Principles
        </h2>
        <ul className="space-y-3">
          <li>
            <strong>1. Grounded or Silent:</strong> Answers cite your uploaded sources. Where sources are silent, Comtus says so rather than hallucinating facts.
          </li>
          <li>
            <strong>2. Visible Reasoning:</strong> Thinking is a first-class user interface surface, not a concealed loading spinner.
          </li>
          <li>
            <strong>3. Local-First Respect:</strong> Notebooks, documents, and history live in your device's IndexedDB; your API keys stay strictly on-device.
          </li>
          <li>
            <strong>4. Pedagogy over Shortcuts:</strong> Designed to help students arrive at true understanding through Socratic questioning and active recall.
          </li>
        </ul>
      </div>
    </StaticPageLayout>
  );
}

export function PrivacyPage() {
  return (
    <StaticPageLayout
      title="Privacy Policy"
      subtitle="How Comtus protects your educational materials, notes, and personal data."
      icon={Shield}
    >
      <div className="space-y-6">
        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale">
          1. Local-First Architecture
        </h2>
        <p>
          Comtus is built with a local-first philosophy. Your uploaded PDF textbooks, lecture slides, flashcards, generated mock exams, and conversation transcripts are stored directly inside your web browser's IndexedDB on your local device.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          2. Zero Unauthorized Model Training
        </h2>
        <p>
          Your study materials, notes, and questions are never used by Comtus to train public AI foundation models. When using Bring-Your-Own-Key (BYOK) providers such as OpenRouter or Groq, requests are transmitted directly via TLS to the selected model provider under their respective API data privacy terms.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          3. API Keys & Credentials
        </h2>
        <p>
          Any API keys you provide (e.g. OpenRouter or custom endpoint keys) are stored solely in your local device storage (`localStorage`). They are never relayed to Comtus analytics or central databases.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          4. Complete Data Deletion & Export
        </h2>
        <p>
          You retain full ownership of your data. You can export your notebooks at any time in standard Markdown, JSON, PDF, or PowerPoint formats, or execute a complete, irreversible on-device purge with a single click in Settings.
        </p>
      </div>
    </StaticPageLayout>
  );
}

export function TermsPage() {
  return (
    <StaticPageLayout
      title="Terms of Service"
      subtitle="Standard guidelines and educational use terms for Comtus."
      icon={FileText}
    >
      <div className="space-y-6">
        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale">
          1. Educational Purpose
        </h2>
        <p>
          Comtus is provided as an AI study companion and learning workspace designed to assist students and professionals in understanding academic materials, preparing for exams, and reviewing source documents.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          2. Academic Honesty & User Responsibility
        </h2>
        <p>
          Users are responsible for complying with the honor codes and academic integrity policies of their respective educational institutions. Comtus is engineered to facilitate study, active recall, and conceptual understanding, and must not be used for unauthorized exam completion or prohibited academic misconduct.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          3. User Content Ownership
        </h2>
        <p>
          You retain all rights and intellectual property in the notes, PDFs, and study materials you import into Comtus.
        </p>
      </div>
    </StaticPageLayout>
  );
}

export function ResponsibleAIPage() {
  return (
    <StaticPageLayout
      title="Responsible AI & Academic Integrity"
      subtitle="Our pedagogical commitment to supporting learning rather than replacing it."
      icon={BookOpen}
    >
      <div className="space-y-6">
        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale">
          The Comtus Learning Commitment
        </h2>
        <p>
          Modern education is challenged by AI tools that prioritize immediate answers over student learning. Comtus takes a fundamentally different stand: <strong>we build AI that teaches, challenges, and reinforces understanding.</strong>
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          Core AI Behaviors
        </h2>
        <ul className="space-y-3">
          <li>
            <strong>• Hints First:</strong> When encountering complex questions, Comtus scaffolds reasoning by providing progressive hints before revealing full solutions.
          </li>
          <li>
            <strong>• Source Grounding:</strong> Claims are backed by citations pointing directly to page numbers and section headers in your uploaded course syllabus and readings.
          </li>
          <li>
            <strong>• Socratic Inquiry:</strong> Comtus asks clarifying and conceptual check questions to ensure students grasp core principles rather than memorizing surface facts.
          </li>
          <li>
            <strong>• Constructive Essay Critiques:</strong> Essay feedback is structured around objective rubrics (Thesis, Evidence, Organization) to guide iterative student rewriting.
          </li>
        </ul>
      </div>
    </StaticPageLayout>
  );
}

export function ContactPage() {
  return (
    <StaticPageLayout
      title="Contact & Support"
      subtitle="Reach out to the Comtus engineering and educational team."
      icon={Mail}
    >
      <div className="space-y-6">
        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale">
          Get in Touch
        </h2>
        <p>
          Have questions about using Comtus for your university courses, licensure review centers, or study groups? We welcome your feedback, bug reports, and suggestions.
        </p>
        <div className="rounded-xl border border-white/10 bg-night/70 p-5 space-y-2">
          <div className="font-mono text-[11px] uppercase tracking-wider text-brasspale">
            Community & Support
          </div>
          <p className="text-parchment">
            Email: <a href="mailto:support@comtus.ai" className="text-brass hover:underline">support@comtus.ai</a>
          </p>
          <p className="text-faded text-[13px]">
            Open issues & feature discussions are also available on our GitHub repository.
          </p>
        </div>
      </div>
    </StaticPageLayout>
  );
}

export function StudyCompanionPage() {
  return (
    <StaticPageLayout
      title="AI Study Companion for Students"
      subtitle="The comprehensive guide to studying smarter with Comtus: Understand, Organize, Practice, and Master."
      icon={Sparkles}
    >
      <div className="space-y-6">
        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale">
          What is an AI Study Companion?
        </h2>
        <p>
          An AI Study Companion is more than a chatbot. It is an intelligent learning environment designed around the cognitive workflow of education: turning disorganized textbooks, scattered lecture notes, and difficult lessons into deep, long-term mastery.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          The Four Stages of Mastery
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
          <div className="rounded-xl border border-white/10 bg-night/60 p-4">
            <h4 className="font-display text-parchment font-medium">1. Understand</h4>
            <p className="mt-1 text-[13px] text-faded">
              Deconstruct difficult topics with intuitive analogies, step-by-step logic, and Socratic follow-ups.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-night/60 p-4">
            <h4 className="font-display text-parchment font-medium">2. Organize</h4>
            <p className="mt-1 text-[13px] text-faded">
              Synthesize lecture notes, PDFs, and slide decks into structured outlines and comprehensive study guides.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-night/60 p-4">
            <h4 className="font-display text-parchment font-medium">3. Practice</h4>
            <p className="mt-1 text-[13px] text-faded">
              Test your understanding with active recall drills, flashcards, and full-length timed mock exams.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-night/60 p-4">
            <h4 className="font-display text-parchment font-medium">4. Master</h4>
            <p className="mt-1 text-[13px] text-faded">
              Identify knowledge gaps, target weak areas, and build unshakable retention before exam day.
            </p>
          </div>
        </div>

        <div className="pt-6 text-center">
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 rounded-full grad-lamp px-8 py-3 text-[14px] font-semibold text-night shadow-md hover:shadow-lg"
          >
            <span>Start Studying with Comtus</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </StaticPageLayout>
  );
}
