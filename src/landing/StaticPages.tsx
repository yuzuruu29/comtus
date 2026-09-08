import { Link } from "react-router-dom";

import Nav from "./Nav";
import Footer from "./Footer";
import "./landing.css";
import { BookOpen, Envelope, FileText, Shield, Sparkle } from "@phosphor-icons/react";

interface StaticPageLayoutProps {
  title: string;
  subtitle: string;
  icon?: typeof Shield;
  children: React.ReactNode;
}

export function StaticPageLayout({ title, subtitle, icon: Icon = BookOpen, children }: StaticPageLayoutProps) {
  return (
    <div className="landing-site">
      <Nav />
      <main className="landing-container landing-document">
        <div className="landing-document-header">
          <Icon size={28} weight="duotone" aria-hidden="true" />
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="landing-document-body">
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
      icon={Sparkle}
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
            <strong>3. Local-First Respect:</strong> Notebooks, documents, and history live in your device's IndexedDB; your own API keys stay strictly on-device, and purchased passes are verified by our server without ever exposing the underlying model key.
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
          1. Who We Are
        </h2>
        <p>
          Comtus (&ldquo;we&rdquo;, &ldquo;the service&rdquo;) is an AI study workspace operated from the Philippines.
          For questions about privacy or your personal data, contact{' '}
          <a href="mailto:support@comtus-ai.xyz" className="text-brass hover:underline">support@comtus-ai.xyz</a>.
          This notice is aligned with the Philippine Data Privacy Act of 2012 (RA 10173) and its Implementing Rules.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          2. Local-First Architecture
        </h2>
        <p>
          Comtus is built with a local-first philosophy. Your uploaded PDF textbooks, lecture slides, flashcards, generated mock exams, and conversation transcripts are stored directly inside your web browser's IndexedDB on your local device. We do not operate a central database of your study materials, and we do not require an account.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          3. What Leaves Your Device
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Model requests:</strong> when you chat, generate quizzes/exams, check solutions, or use voice features, the relevant text (your question, conversation context, and text extracted from sources in the active notebook) is transmitted to the AI provider you selected so it can generate a response.
          </li>
          <li>
            <strong>Hosted-pass telemetry:</strong> if you purchase a Smarter Models pass, we store only the minimum needed to operate it: a random pass identifier, its request quota/expiry counters, and your PayPal order id. We do not store your name, address, or card details — those live with PayPal.
          </li>
          <li>
            <strong>Analytics:</strong> aggregate, non-identifying product analytics are collected via Vercel Analytics (page views and visits).
          </li>
        </ul>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          4. Third-Party Processors
        </h2>
        <p>Your data touches these third parties only as needed to provide the feature you invoked:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>PayPal</strong> — payment processing for Smarter Models passes. PayPal receives your payment details and acts as the data controller for its own services.</li>
          <li><strong>Anthropic</strong> — hosts the Claude models behind paid Smarter Models passes; your prompts and source text are processed by Anthropic under their commercial data terms.</li>
          <li><strong>BYOK providers</strong> — with Bring-Your-Own-Key mode (OpenRouter, Groq, Cerebras, Google AI Studio, DeepSeek, Together, Nous, OpenCode Zen, Mistral, or your own custom endpoint), requests go directly to that provider under their privacy terms. For Zen and Mistral, requests relay through our server solely to reach their APIs.</li>
          <li><strong>Vercel</strong> — application hosting, serverless functions, and Vercel Analytics.</li>
          <li><strong>r.jina.ai</strong> — when you import a URL, the page is fetched through Jina's reader service to extract readable text.</li>
          <li><strong>Wikipedia / DuckDuckGo</strong> — public search results used when you enable web-grounded answers (relayed through our server).</li>
        </ul>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          5. Zero Unauthorized Model Training
        </h2>
        <p>
          Your study materials, notes, and questions are never used by Comtus to train public AI foundation models. Each model provider processes your requests under their respective data-use terms.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          6. API Keys & Credentials
        </h2>
        <p>
          Any API keys you provide (e.g. OpenRouter or custom endpoint keys) are stored solely in your local device storage (`localStorage`). They are never relayed to Comtus analytics or central databases. Purchased access passes are credentials stored locally on your devices; treat them like passwords, since anyone holding the token can use its quota.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          7. Retention
        </h2>
        <p>
          Local study data persists until you delete notebooks yourself or run the full purge described below. Server-side pass counters persist until the pass expires, after which they serve only audit/accounting purposes. PayPal retains transaction records per its own policies and applicable law.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          8. Your Rights
        </h2>
        <p>
          You have the rights to be informed, to access, to correct, to erase, to object, and to data portability with respect to your personal data. Because your study data lives locally, you can exercise access, portability, and erasure yourself at any time: export your notebooks in standard Markdown, JSON, PDF, or PowerPoint formats, or execute a complete, irreversible on-device purge with a single click in Settings. For anything else — including questions about server-side pass records or payments — email{' '}
          <a href="mailto:support@comtus-ai.xyz" className="text-brass hover:underline">support@comtus-ai.xyz</a>{' '}
          and we will respond within a reasonable period.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          9. International Transfers
        </h2>
        <p>
          Comtus itself operates from the Philippines, but the third parties listed above (Vercel, Anthropic, PayPal, model providers) process data in data centers located outside the Philippines. By using the service, you consent to these international transfers, which each processor safeguards under its own compliance program.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          10. Children
        </h2>
        <p>
          Comtus is intended for senior high school, university, and professional learners. We do not knowingly collect personal data from children under 13. Younger learners should use Comtus with guidance from a parent, guardian, or school.
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

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          4. Purchases, Delivery & Access Passes
        </h2>
        <p>
          Smarter Models passes are sold in US dollars and processed by PayPal. When PayPal confirms your payment, your access pass is issued automatically and activated in the app immediately — there is no waiting period or manual approval. A pass grants a fixed number of hosted model requests (shown on the plan before purchase) until its expiry date, counted per request at the server. Passes are personal credentials: sharing, reselling, or automating access with a pass is prohibited and may lead to suspension of the pass without refund.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          5. Refunds, Disputes & Taxes
        </h2>
        <p>
          If a pass does not work as described, contact{' '}
          <a href="mailto:support@comtus-ai.xyz" className="text-brass hover:underline">support@comtus-ai.xyz</a>{' '}
          within 14 days of purchase and we will refund passes that have seen little or no usage, or restore lost quota caused by a fault on our side. Refund requests outside this window are considered case by case. Opening a PayPal dispute instead of contacting us first may result in the associated pass being suspended pending resolution. Prices exclude any taxes, bank fees, or currency-conversion charges your payment provider may apply; you are responsible for those.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          6. Acceptable Use
        </h2>
        <p>
          You agree not to use Comtus to process unlawful content, to attack or overload our infrastructure, to circumvent quotas or rate limits, to resell hosted model access, or to share account-free credentials such as passes. We enforce fair-use throttling and per-pass request limits to keep the service available to everyone.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          7. Service Availability, Warranty & Suspension
        </h2>
        <p>
          Comtus is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied, including fitness for a particular purpose or exam outcome. Hosted models depend on third-party providers whose availability we do not control, and we may pause, throttle, or discontinue hosted access (with notice where practicable) for maintenance, abuse, cost protection, or provider-side changes. Generated study content can contain mistakes — always verify important material against your own sources.
        </p>

        <h2 className="font-display text-[1.5rem] font-[450] text-brasspale pt-4">
          8. Limitation of Liability & Governing Law
        </h2>
        <p>
          To the maximum extent permitted by law, Comtus's total liability arising from your use of the service is limited to the amount you paid us in the twelve months preceding the claim. These Terms are governed by the laws of the Republic of the Philippines. We may update these terms; material changes will be reflected on this page with an updated effective date, and continued use after changes constitutes acceptance.
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
      icon={Envelope}
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
            Email: <a href="mailto:support@comtus-ai.xyz" className="text-brass hover:underline">support@comtus-ai.xyz</a>
          </p>
          <p className="text-faded text-[13px]">
            We typically reply within 1–2 business days. For payment issues, include your PayPal order id (shown in the app right after checkout).
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
      icon={Sparkle}
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
