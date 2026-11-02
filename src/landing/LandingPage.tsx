import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, BookOpen, CaretDown, Check, FilePdf, FileText, Lamp, LinkSimple, NotePencil } from "@phosphor-icons/react";
import { Button, Segmented } from "../ui";
import { startOpenRouterOAuth } from "../lib/openrouterAuth";
import { useMotionMode } from "../studio/fx";
import Nav from "./Nav";
import Footer from "./Footer";
import OnboardingModal from "./OnboardingModal";
import StudyFieldGuide from "./StudyFieldGuide";
import DesktopSection from "./DesktopSection";
import { usePublicPageEntry } from "./usePublicPageEntry";
import { useSmoothScroll } from "./useSmoothScroll";
import "./landing.css";
import "./landing-motion.css";
import { ICON } from "../ui/iconScale";

const SAMPLE_QUESTIONS = [
  {
    question: "Why practise recall instead of rereading?",
    answer: "Rereading can make an idea feel familiar. Retrieval practice asks you to bring it to mind without looking, so you can see what you remember and what needs another look.",
    takeaway: "Close the notes. Explain the idea. Then check what you missed.",
  },
  {
    question: "How can I try this with my own notes?",
    answer: "Read a short section, put it aside, and explain the main idea in your own words. Reopen your notes to check the explanation, then give the difficult parts another try.",
    takeaway: "The useful part is the attempt to remember, followed by checking.",
  },
] as const;

const PRACTICE_OPTIONS = [
  "Read the same paragraph again",
  "Close your notes and explain the idea",
  "Highlight an important sentence",
] as const;

/** Two rows of the subjects people sit board exams in. They drift in opposite
 *  directions as the page is read; the caption carries the meaning. */
const SUBJECT_ROWS = [
  ["Pharmacology", "Statics", "Auditing", "Child development", "Thermodynamics", "Anatomy & physiology", "Taxation", "Philippine history"],
  ["Obligations & contracts", "Hydraulics", "Microbiology", "Assessment of learning", "Financial reporting", "Calculus", "Maternal care", "Organic chemistry"],
] as const;

/** The three missed answers in the sample score, by position. */
const MISSED = new Set([3, 6, 8]);

function SubjectRibbon() {
  return (
    <div className="landing-ribbon">
      <p className="landing-container landing-ribbon-caption">For whatever you are reviewing.</p>
      <div className="landing-ribbon-rows" aria-hidden="true">
        {SUBJECT_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="landing-ribbon-row">
            {/* Written twice so the drift never shows the end of the line. */}
            <div className="landing-ribbon-track">
              {[...row, ...row].map((subject, index) => <span key={index}>{subject}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Small paper props beside each step. Illustration only: the step's own
 *  heading and paragraph say everything, so these stay out of the reading order. */
function StepSources() {
  return (
    <div className="landing-artifact landing-artifact-sources" aria-hidden="true">
      <span><FilePdf size={ICON.md} />Chapter 4, Membranes.pdf</span>
      <span><NotePencil size={ICON.md} />Lecture 6 notes</span>
      <span><LinkSimple size={ICON.md} />Osmosis, explained</span>
    </div>
  );
}

function StepCitation() {
  return (
    <div className="landing-artifact landing-artifact-cite" aria-hidden="true">
      <p className="landing-artifact-answer">Water moves toward the side with more dissolved solute.<span>2</span></p>
      <p className="landing-artifact-passage"><span>Lecture 6, p. 3</span>Osmosis is the movement of water across a membrane <mark>toward the higher solute concentration</mark>.</p>
    </div>
  );
}

function StepScore() {
  return (
    <div className="landing-artifact landing-artifact-score" aria-hidden="true">
      <div className="landing-artifact-score-head"><strong>7</strong><span>of 10 remembered</span></div>
      <div className="landing-artifact-ticks">
        {Array.from({ length: 10 }, (_, index) => <span key={index} data-missed={MISSED.has(index)} style={{ "--i": index } as CSSProperties} />)}
      </div>
      <p>Revisit <em>tonicity</em> and <em>active transport</em> tomorrow.</p>
    </div>
  );
}

/** A pen stroke under the one phrase the headline leans on. Decorative: the
 *  words carry the meaning, so it stays out of the accessibility tree. The
 *  path is normalised (pathLength 1) so CSS can draw it with a dash offset. */
function InkUnderline() {
  return (
    <svg className="landing-ink-underline" viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M3 11 C 54 4, 98 15, 152 9 S 246 5, 297 10" pathLength={1} />
    </svg>
  );
}

function DeskPreview() {
  const [mode, setMode] = useState<"understand" | "practice">("understand");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  // The sample opens already written. Its answers only animate once the
  // visitor has asked for a different one, so nothing waits on an introduction.
  const [touched, setTouched] = useState(false);
  const sample = SAMPLE_QUESTIONS[questionIndex];

  return (
    <div className="landing-preview" role="region" aria-label="Interactive sample notebook" data-touched={touched}>
      <div className="landing-preview-bar">
        <div className="landing-preview-title">
          <BookOpen size={ICON.xxl} weight="duotone" aria-hidden="true" />
          <div><span className="landing-preview-overline">A sample notebook</span><span>Learning & memory</span></div>
        </div>
        <span className="landing-preview-label">Try it here. No setup needed.</span>
      </div>
      <div className="landing-preview-desk">
        <aside className="landing-preview-sources" aria-label="Sample source">
          <div className="landing-preview-pane-title"><FileText size={ICON.md} aria-hidden="true" /> The reading<span>01 source</span></div>
          <article id="sample-source" className="landing-sample-page" tabIndex={-1}>
            <div className="landing-page-reference"><span>Study notes</span><span>p. 12</span></div>
            <h3>Learning by remembering</h3>
            <p>Reading is a place to begin. To find out what you understand, try recalling it without the page in front of you.</p>
            <p><mark>Retrieval practice means bringing information to mind without looking at the source.</mark></p>
            <p>Read a short section. Put it aside and explain the idea in your own words. Then check your notes and return to what you missed.</p>
            <span className="landing-page-end" aria-hidden="true">12</span>
          </article>
        </aside>
        <div className="landing-preview-work">
          <div className="landing-preview-controls">
            <Segmented
              aria-label="Explore the sample notebook"
              value={mode}
              onChange={(next) => { setTouched(true); setMode(next); }}
              options={[{ value: "understand", label: "Understand" }, { value: "practice", label: "Practise" }]}
            />
            <span className="landing-preview-grounded"><Lamp size={ICON.md} aria-hidden="true" /> Source in sight</span>
          </div>
          {mode === "understand" ? (
            <div className="landing-preview-conversation">
              <div className="landing-sample-question"><span>You</span><p>{sample.question}</p></div>
              <div className="landing-sample-answer" aria-live="polite" aria-atomic="true">
                <div key={`byline-${questionIndex}`} className="landing-answer-byline"><Lamp size={ICON.xl} weight="duotone" aria-hidden="true" /><span>Comtus</span></div>
                <p key={`answer-${questionIndex}`}>{sample.answer} <a className="landing-citation" href="#sample-source" aria-label="View source, Study notes page 12">1</a></p>
                <p key={`takeaway-${questionIndex}`} className="landing-answer-takeaway">{sample.takeaway}</p>
              </div>
              <div className="landing-sample-prompts">
                <span>Try a sample question</span>
                {SAMPLE_QUESTIONS.map(({ question }, index) => (
                  <button key={question} type="button" aria-pressed={questionIndex === index} onClick={() => { if (index === questionIndex) return; setTouched(true); setQuestionIndex(index); }}>{question}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="landing-preview-practice">
              <p className="landing-practice-intro">A moment to test the idea.</p>
              <fieldset>
                <legend>Which action is retrieval practice?</legend>
                <div className="landing-practice-options">
                  {PRACTICE_OPTIONS.map((option, index) => (
                    <button
                      type="button"
                      key={option}
                      aria-pressed={answerIndex === index}
                      className={answerIndex === index ? (index === 1 ? "is-correct" : "is-incorrect") : ""}
                      onClick={() => { setTouched(true); setAnswerIndex(index); }}
                    >
                      <span className="landing-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                      <span>{option}</span>
                      {answerIndex === index && index === 1 && <Check size={ICON.lg} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="landing-practice-feedback" role="status">
                <span key={answerIndex ?? "idle"}>
                  {answerIndex === null
                    ? "Choose an answer. There is room to get it wrong here."
                    : answerIndex === 1
                      ? "Exactly. You are bringing the idea to mind without looking. Check your notes afterwards to fill in any gaps."
                      : "Try again. Retrieval means bringing the idea to mind without looking at your notes."}
                </span>
              </p>
              <a href="#sample-source" className="landing-text-link">Revisit the source</a>
            </div>
          )}
        </div>
      </div>
      <div className="landing-preview-footnote"><span>Sample content, made for this preview.</span><span>Your own study starts with your sources.</span></div>
    </div>
  );
}

export default function LandingPage() {
  const titleRef = usePublicPageEntry();
  const motionMode = useMotionMode();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  useSmoothScroll(motionMode === "full");

  const connectOpenRouter = async () => {
    setConnecting(true);
    setConnectionError("");
    try {
      await startOpenRouterOAuth();
    } catch {
      setConnectionError("The connection could not be opened. Try again, or add your key at the desk under AI Models.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="landing-site landing-home" data-motion={motionMode}>
      <a className="landing-skip-link" href="#landing-main">Skip to content</a>
      <Nav onLanding />
      <main id="landing-main" tabIndex={-1}>
        <section className="landing-hero" id="hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero-editorial">
            <p className="landing-hero-signature">A personal study workspace</p>
            <div className="landing-hero-intro">
              <h1 ref={titleRef} id="landing-title" tabIndex={-1}>
                <span className="landing-line"><span className="landing-line-text">From reading it</span></span>{" "}
                <span className="landing-line"><span className="landing-line-text">to <em className="landing-ink-word">knowing it.<InkUnderline /></em></span></span>
              </h1>
              <div className="landing-hero-copy">
                <p className="landing-hero-lead">Your sources, clearer answers, and the practice that makes it stick. Together in a notebook of your own.</p>
                <div className="landing-hero-actions">
                  <Link to="/studio" className="btn btn-primary btn-md landing-open-desk">Open the desk</Link>
                  <a className="landing-text-link" href="#try-the-desk">Try the notebook<ArrowDown size={ICON.lg} aria-hidden="true" /></a>
                </div>
                <p className="landing-hero-note">Start with your material. Connect an AI model when you’re ready.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-demo-section" id="try-the-desk" aria-labelledby="landing-demo-title">
          <div className="landing-container">
            <div className="landing-demo-heading"><h2 id="landing-demo-title">A little studying, right here.</h2><p>Ask. Check the source. Try remembering.</p></div>
            <div className="landing-preview-stage"><DeskPreview /></div>
            <div className="landing-demo-afterword"><p>Rough thought, polished.</p><button className="landing-text-button" type="button" onClick={() => setOnboardingOpen(true)}>Set up with a guide</button></div>
          </div>
        </section>

        <SubjectRibbon />

        <section id="how-it-works" className="landing-section landing-container landing-method" aria-labelledby="landing-method-title">
          <div className="landing-section-heading landing-method-heading" data-landing-reveal>
            <h2 id="landing-method-title">Keep the thread<br />of your <em>thinking.</em></h2>
            <p>From the sentence that stops you to the answer you can explain. Give the whole study session one place to live.</p>
          </div>
          <ol className="landing-workflow">
            <li data-landing-reveal>
              <span className="landing-step-number" data-n="01" aria-hidden="true">01</span>
              <div className="landing-step-copy"><h3>Bring the chapter.</h3><p>PDFs, documents, links, and your own notes. Collect the material for a subject in one notebook.</p></div>
              <StepSources />
            </li>
            <li data-landing-reveal>
              <span className="landing-step-number" data-n="02" aria-hidden="true">02</span>
              <div className="landing-step-copy"><h3>Stay with the question.</h3><p>Work through a difficult idea. Follow an answer’s citations back to the passage that supports it.</p></div>
              <StepCitation />
            </li>
            <li data-landing-reveal>
              <span className="landing-step-number" data-n="03" aria-hidden="true">03</span>
              <div className="landing-step-copy"><h3>Find out what stayed.</h3><p>Turn your material into practice. Use the questions you miss to choose what to revisit.</p></div>
              <StepScore />
            </li>
          </ol>
        </section>

        <StudyFieldGuide />

        <section id="model-access" className="landing-section landing-container landing-access" aria-labelledby="landing-access-title">
          <div className="landing-section-heading" data-landing-reveal>
            <h2 id="landing-access-title">A notebook here.<br /><em>AI on your terms.</em></h2>
            <p>Explore the desk, then connect a model when you are ready to ask questions or generate study material.</p>
            <Button variant="secondary" loading={connecting} onClick={() => void connectOpenRouter()}>Connect OpenRouter</Button>
            {connectionError && <p className="landing-connection-error" role="alert">{connectionError}</p>}
          </div>
          <div className="landing-access-notes">
            <div data-landing-reveal><h3>Choose how you connect.</h3><p>Connect your OpenRouter account, or add an existing provider key at the desk under <strong>AI{" "}Models</strong>. Free model availability and usage limits are set by the provider. Optional hosted access is also available there.</p></div>
            <div data-landing-reveal><h3>Your notebook lives on your device.</h3><p>Comtus keeps your notebooks and imported material in local browser storage. When you use an AI feature, your question and relevant source text are sent to the model provider you choose.</p><Link to="/privacy" className="landing-text-link">Read how your data is handled</Link></div>
          </div>
        </section>

        <DesktopSection />

        <section id="faq" className="landing-section landing-container landing-faq" aria-labelledby="landing-faq-title">
          <div className="landing-section-heading" data-landing-reveal><h2 id="landing-faq-title">Good questions.<br /><em>Clear answers.</em></h2><p>Need a hand getting started? <Link to="/study-companion" className="landing-text-link">Read the study guide</Link> or <button type="button" className="landing-text-button" onClick={() => setOnboardingOpen(true)}>set up your desk</button>.</p></div>
          <div className="landing-faq-list">
            <details data-landing-reveal><summary>What can I bring into a notebook?<CaretDown size={ICON.lg} aria-hidden="true" /></summary><p>You can import PDFs, Word documents, plain text and Markdown, paste your notes, or add a web link. Keep related materials together so your questions and practice stay connected to the same subject.</p></details>
            <details data-landing-reveal><summary>Do I need an AI account to get started?<CaretDown size={ICON.lg} aria-hidden="true" /></summary><p>You can open the desk and organise a notebook before connecting a model. For answers and generated study material, connect an AI provider in AI Models. OpenRouter connection, your own provider key, and optional hosted access are available.</p></details>
            <details data-landing-reveal><summary>How do I check an answer?<CaretDown size={ICON.lg} aria-hidden="true" /></summary><p>Follow an answer’s citations to the supporting text in your sources. AI can still make mistakes, so check important claims against the original material. Your source is always part of the study process.</p></details>
            <details data-landing-reveal><summary>Can I use it for exam preparation?<CaretDown size={ICON.lg} aria-hidden="true" /></summary><p>The desk includes quizzes, mock exams, flashcards, and study guides. Build practice from your own review materials and use the answer explanations to revisit difficult topics.</p></details>
            <details data-landing-reveal><summary>Will my notebooks appear on another device?<CaretDown size={ICON.lg} aria-hidden="true" /></summary><p>Notebooks are stored on the device and browser where you create them. Export a backup to keep a separate copy. Clearing browser storage can remove your local study data.</p></details>
            <details data-landing-reveal><summary>Is there an app to install?<CaretDown size={ICON.lg} aria-hidden="true" /></summary><p>Yes. Comtus Desktop for Windows and macOS is a download in the desktop section above. A setup guide inside the app connects Ollama so the model runs on your own machine, and hosted Claude access stays an optional top-up.</p></details>
          </div>
        </section>
        {/* The page ends at night: the closing and the footer take the Lamplight
            palette, and one lamp comes up behind the last line as it is read. */}
        <div className="theme-lamplight landing-nightfall">
          <div className="landing-closing" data-landing-reveal><div className="landing-container landing-closing-inner"><p>One chapter.<br /><em>A good place to start.</em></p><div><Link to="/studio" className="btn btn-primary btn-md landing-open-desk">Open the desk</Link><span>Make room for what comes next.</span></div></div></div>
        </div>
      </main>
      <Footer lamplight />
      <OnboardingModal isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}
