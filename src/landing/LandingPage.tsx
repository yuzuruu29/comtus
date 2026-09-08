import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, BookOpen, CaretDown, Check, FileText, Lamp } from "@phosphor-icons/react";
import { Button, Segmented } from "../ui";
import { startOpenRouterOAuth } from "../lib/openrouterAuth";
import { useMotionMode } from "../studio/fx";
import Nav from "./Nav";
import Footer from "./Footer";
import OnboardingModal from "./OnboardingModal";
import StudyMotion from "./StudyMotion";
import StudyFieldGuide from "./StudyFieldGuide";
import "./landing.css";

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

function DeskPreview() {
  const [mode, setMode] = useState<"understand" | "practice">("understand");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const sample = SAMPLE_QUESTIONS[questionIndex];

  return (
    <div className="landing-preview" aria-label="Interactive sample notebook">
      <div className="landing-preview-bar">
        <div className="landing-preview-title">
          <BookOpen size={22} weight="duotone" aria-hidden="true" />
          <span>Learning & memory</span>
        </div>
        <span className="landing-preview-label">Interactive preview</span>
      </div>
      <div className="landing-preview-desk">
        <aside className="landing-preview-sources" aria-label="Sample source">
          <div className="landing-preview-pane-title"><FileText size={16} aria-hidden="true" /> Your source</div>
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
              onChange={setMode}
              options={[{ value: "understand", label: "Understand" }, { value: "practice", label: "Practise" }]}
            />
            <span className="landing-preview-grounded"><Lamp size={15} aria-hidden="true" /> From your source</span>
          </div>
          {mode === "understand" ? (
            <div className="landing-preview-conversation">
              <div className="landing-sample-question"><span>You</span><p>{sample.question}</p></div>
              <div className="landing-sample-answer" key={questionIndex}>
                <div className="landing-answer-byline"><Lamp size={19} weight="duotone" aria-hidden="true" /><span>Comtus</span></div>
                <p>{sample.answer} <a className="landing-citation" href="#sample-source" aria-label="View source, Study notes page 12">1</a></p>
                <p className="landing-answer-takeaway">{sample.takeaway}</p>
              </div>
              <div className="landing-sample-prompts">
                <span>Try a sample question</span>
                {SAMPLE_QUESTIONS.map(({ question }, index) => (
                  <button key={question} type="button" aria-pressed={questionIndex === index} onClick={() => setQuestionIndex(index)}>{question}</button>
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
                      onClick={() => setAnswerIndex(index)}
                    >
                      <span className="landing-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                      <span>{option}</span>
                      {answerIndex === index && index === 1 && <Check size={18} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="landing-practice-feedback" role="status">
                {answerIndex === null
                  ? "Choose an answer. There is room to get it wrong here."
                  : answerIndex === 1
                    ? "Exactly. You are bringing the idea to mind without looking. Check your notes afterwards to fill in any gaps."
                    : "Try again. Retrieval means bringing the idea to mind without looking at your notes."}
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
  const motionMode = useMotionMode();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  const connectOpenRouter = async () => {
    setConnecting(true);
    setConnectionError("");
    try {
      await startOpenRouterOAuth();
    } catch {
      setConnectionError("The connection could not be opened. Try again, or add your key in Studio under AI Models.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="landing-site landing-home" data-motion={motionMode}>
      <a className="landing-skip-link" href="#landing-main">Skip to content</a>
      <Nav onLanding />
      <main id="landing-main">
        <section className="landing-hero landing-container" id="hero" aria-labelledby="landing-title">
          <div className="landing-hero-intro">
            <div className="landing-hero-editorial">
              <p className="landing-eyebrow"><span aria-hidden="true" /> A study companion for curious minds</p>
              <h1 id="landing-title">
                <span className="landing-title-rough">Rough thought,</span>{" "}
                <em>polished.<svg viewBox="0 0 400 26" fill="none" aria-hidden="true"><path pathLength="1" d="M8 18C86 5 244 3 386 9M56 23C178 13 264 15 338 17" /></svg></em>
              </h1>
              <div className="landing-hero-copy">
                <p className="landing-hero-lead">Make something of<br />everything you’re learning.</p>
                <p>Bring your notes, readings, and questions. Find the connections, follow the sources, and practise what stays.</p>
                <div className="landing-hero-actions">
                  <Link to="/studio" className="btn btn-primary btn-md landing-open-desk">Open Studio<ArrowUpRight size={19} aria-hidden="true" /></Link>
                  <button className="landing-text-button" type="button" onClick={() => setOnboardingOpen(true)}>Set up with a guide</button>
                </div>
                <span className="landing-hero-note">Your materials. A desk of your own.</span>
              </div>
            </div>
            <StudyMotion motionMode={motionMode} />
          </div>
          <div className="landing-hero-bottom"><span>From a page full of notes to a head full of ideas.</span><a href="#try-the-desk">Try a little studying<ArrowDown size={16} aria-hidden="true" /></a></div>
        </section>

        <section className="landing-demo-section" id="try-the-desk" aria-labelledby="landing-demo-title">
          <div className="landing-container">
            <div className="landing-demo-heading" data-landing-reveal><div><p className="landing-eyebrow">A moment at your desk</p><h2 id="landing-demo-title">See the connection.<br /><em>Then make it yours.</em></h2></div><p>A source on one side. A new way of seeing it on the other.<br />Try an answer or a practice question below.</p></div>
            <div data-landing-reveal>
              <DeskPreview />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-section landing-container landing-method" aria-labelledby="landing-method-title">
          <div className="landing-section-heading" data-landing-reveal>
            <p className="landing-eyebrow">Follow your curiosity</p>
            <h2 id="landing-method-title">Less scattered.<br /><em>More understood.</em></h2>
            <p>A notebook holds the whole study session together, from your first question to your next practice round.</p>
          </div>
          <ol className="landing-workflow">
            <li data-landing-reveal><span aria-hidden="true">01</span><div><h3>Bring the chapter.</h3><p>Add a PDF, a document, a link, or a few notes. Keep the materials for a subject in one notebook.</p></div></li>
            <li data-landing-reveal><span aria-hidden="true">02</span><div><h3>Follow the question.</h3><p>Ask about a difficult idea. Read the explanation beside your material and follow its citations back to the source.</p></div></li>
            <li data-landing-reveal><span aria-hidden="true">03</span><div><h3>Find out what stayed.</h3><p>Make a quiz or a set of flashcards. Use what you miss to decide where to spend your next few minutes.</p></div></li>
          </ol>
        </section>

        <StudyFieldGuide />

        <section id="model-access" className="landing-section landing-container landing-access" aria-labelledby="landing-access-title">
          <div className="landing-section-heading" data-landing-reveal>
            <h2 id="landing-access-title">Your desk.<br /><em>Your choice of AI.</em></h2>
            <p>Explore Studio, then connect a model when you are ready to ask questions or generate study material.</p>
            <Button variant="secondary" loading={connecting} onClick={() => void connectOpenRouter()}>Connect OpenRouter</Button>
            {connectionError && <p className="landing-connection-error" role="alert">{connectionError}</p>}
          </div>
          <div className="landing-access-notes">
            <div data-landing-reveal><h3>Choose how you connect.</h3><p>Connect your OpenRouter account, or add an existing provider key in Studio under <strong>AI Models</strong>. Free model availability and usage limits are set by the provider. Optional hosted access is also available there.</p></div>
            <div data-landing-reveal><h3>Your notebook lives on your device.</h3><p>Comtus keeps your notebooks and imported material in local browser storage. When you use an AI feature, your question and relevant source text are sent to the model provider you choose.</p><Link to="/privacy" className="landing-text-link">Read how your data is handled</Link></div>
          </div>
        </section>

        <section id="faq" className="landing-section landing-container landing-faq" aria-labelledby="landing-faq-title">
          <div className="landing-section-heading" data-landing-reveal><h2 id="landing-faq-title">A few things<br /><em>you might wonder.</em></h2><p>Need a hand getting started? <Link to="/study-companion" className="landing-text-link">Read the study guide</Link> or <button type="button" className="landing-text-button" onClick={() => setOnboardingOpen(true)}>set up your desk</button>.</p></div>
          <div className="landing-faq-list">
            <details data-landing-reveal><summary>What can I bring into a notebook?<CaretDown size={18} aria-hidden="true" /></summary><p>You can import PDFs, Word documents, plain text and Markdown, paste your notes, or add a web link. Keep related materials together so your questions and practice stay connected to the same subject.</p></details>
            <details data-landing-reveal><summary>Do I need an AI account to get started?<CaretDown size={18} aria-hidden="true" /></summary><p>You can open Studio and organise a notebook before connecting a model. For answers and generated study material, connect an AI provider in AI Models. OpenRouter connection, your own provider key, and optional hosted access are available.</p></details>
            <details data-landing-reveal><summary>How do I check an answer?<CaretDown size={18} aria-hidden="true" /></summary><p>Follow an answer’s citations to the supporting text in your sources. AI can still make mistakes, so check important claims against the original material. Your source is always part of the study process.</p></details>
            <details data-landing-reveal><summary>Can I use it for exam preparation?<CaretDown size={18} aria-hidden="true" /></summary><p>Studio includes quizzes, mock exams, flashcards, and study guides. Build practice from your own review materials and use the answer explanations to revisit difficult topics.</p></details>
            <details data-landing-reveal><summary>Will my notebooks appear on another device?<CaretDown size={18} aria-hidden="true" /></summary><p>Notebooks are stored on the device and browser where you create them. Export a backup to keep a separate copy. Clearing browser storage can remove your local study data.</p></details>
          </div>
        </section>
        <div className="landing-closing landing-container" data-landing-reveal><p>Bring one chapter.<br /><em>Start there.</em></p><Link to="/studio" className="btn btn-primary btn-md landing-open-desk">Open Studio<ArrowUpRight size={19} aria-hidden="true" /></Link></div>
      </main>
      <Footer />
      <OnboardingModal isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}
