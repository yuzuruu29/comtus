import { useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, Pause, Play } from "@phosphor-icons/react";
import { useMediaQuery } from "../lib/useMediaQuery";
import type { MotionState } from "../lib/pixelMotion";
import "./study-motion.css";
import { ICON } from "../ui/iconScale";

const STEPS = [
  { id: "gather", label: "Gather", caption: "A chapter. A question. Somewhere to begin." },
  { id: "connect", label: "Connect", caption: "Follow an idea back to the words that matter." },
  { id: "recall", label: "Recall", caption: "Close the page. See what comes back." },
] as const;

export default function StudyMotion({ motionMode }: { motionMode: MotionState }) {
  const root = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [replay, setReplay] = useState(0);
  const [hasManualStep, setHasManualStep] = useState(false);
  const [visible, setVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const allowsMotion = motionMode === "full" && !reducedMotion;
  const playing = autoplay && allowsMotion && visible && documentVisible;
  const step = STEPS[activeStep];

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    if (observer) observer.observe(element);
    else setVisible(true);
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setActiveStep((current) => (current + 1) % STEPS.length), 4500);
    return () => window.clearTimeout(timer);
  }, [playing, activeStep, replay]);

  return (
    <figure
      className="study-motion"
      ref={root}
      data-step={step.id}
      data-playing={playing}
      data-arrive={!hasManualStep}
      data-motion={allowsMotion ? "full" : "none"}
      aria-label="An illustrated study session"
    >
      <div key={replay} className="study-motion-stage" aria-hidden="true">
        <div className="study-motion-disc"><span>Room for a little<br /><em>understanding.</em></span></div>

        <div className="study-motion-source study-motion-paper">
          <div className="study-motion-paper-meta"><span>Reading notes</span><span>04</span></div>
          <h3>On learning<br />& remembering</h3>
          <div className="study-motion-source-columns">
            <p>Learning leaves a trace. Returning to an idea helps us find that trace again.</p>
            <p>A question opens a different path through familiar material.</p>
          </div>
          <div className="study-motion-source-quote">“What stays with us?”</div>
          <div className="study-motion-source-rules" />
          <span className="study-motion-page-number">12</span>
        </div>

        <div className="study-motion-notebook study-motion-paper">
          <span className="study-motion-binding" />
          <span className="study-motion-ribbon" />
          <div className="study-motion-paper-meta"><span>A notebook of ideas</span><span>Comtus</span></div>
          <h3>The shape<br />of a <em>memory.</em></h3>
          <p className="study-motion-notebook-deck">A thought becomes yours<br />when you can bring it back.</p>
          <svg className="study-motion-neuron" viewBox="0 0 280 155" fill="none">
            <path d="M136 104C122 80 103 64 81 47M135 102C148 82 165 63 190 48M135 102C137 70 137 55 134 28M135 104C105 102 82 114 56 131M136 104C159 114 181 124 209 132" />
            <path d="M81 47L69 22M81 47L52 48M190 48L205 24M190 48L218 51M134 28L118 13M134 28L150 10M56 131L33 126M209 132L237 119" />
            <circle cx="135" cy="104" r="19" className="study-motion-neuron-core" />
            <circle cx="135" cy="104" r="7" />
            <circle cx="69" cy="22" r="5" /><circle cx="52" cy="48" r="4" />
            <circle cx="205" cy="24" r="5" /><circle cx="218" cy="51" r="4" />
            <circle cx="118" cy="13" r="4" /><circle cx="150" cy="10" r="5" />
            <circle cx="33" cy="126" r="4" /><circle cx="237" cy="119" r="5" />
            <path d="M73 79C83 99 100 113 113 119M169 92C180 78 200 71 224 73" className="study-motion-neuron-note" />
            <text x="31" y="92">connect</text><text x="196" y="91">recall</text>
          </svg>
          <div className="study-motion-highlight"><span>Recall is a kind of rehearsal.</span></div>
          <p className="study-motion-notebook-foot">Put the page aside. Explain it in your own words.</p>
          <div className="study-motion-citation"><span>1</span> Reading notes, p. 12</div>
          <span className="study-motion-page-number">A thought, taking shape.</span>
        </div>

        <div className="study-motion-concept study-motion-paper">
          <span className="study-motion-concept-pin" />
          <div className="study-motion-paper-meta">The connection</div>
          <p>Familiar<br />isn’t the same<br />as <em>remembered.</em></p>
          <svg viewBox="0 0 155 18" fill="none"><path d="M4 12C42 3 86 3 149 8M83 16C105 11 130 9 153 12" /></svg>
        </div>

        <svg className="study-motion-thread" viewBox="0 0 600 470" fill="none">
          <path pathLength="1" d="M117 272C45 292 50 360 154 348C194 343 191 312 220 310M404 327C524 310 565 211 529 176" />
          <path pathLength="1" d="M522 181L529 175L535 184M213 304L222 309L216 317" />
        </svg>

        <div className="study-motion-practice">
          <div className="study-motion-practice-turn">
            <div className="study-motion-practice-face study-motion-practice-front">
              <div className="study-motion-paper-meta"><span>A little practice</span></div>
              <p>What makes<br />a memory <em>stay?</em></p>
              <span className="study-motion-practice-foot">One question, from your notes.</span>
            </div>
            <div className="study-motion-practice-face study-motion-practice-back">
              <div className="study-motion-paper-meta"><span>In your own words</span><span>✓</span></div>
              <p>Bring it back.<br /><em>Then give it time.</em></p>
              <span className="study-motion-practice-foot">Retrieval + space to return.</span>
            </div>
          </div>
        </div>
        <div className="study-motion-pencil"><span>COMTUS</span></div>
        <div className="study-motion-margin-note">the good part<br />is what you keep.</div>
      </div>

      <figcaption className="study-motion-caption">
        <div className="study-motion-caption-copy"><span>Illustrative sample</span><p>{step.caption}</p></div>
        <div className="study-motion-controls">
          <div className="study-motion-steps" role="group" aria-label="Study session steps">
            {STEPS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={activeStep === index}
                onClick={() => { setActiveStep(index); setAutoplay(false); setHasManualStep(true); }}
              >
                <span className="study-motion-step-number" aria-hidden="true">0{index + 1}</span>{item.label}
                {activeStep === index && <span key={`${step.id}-${playing}-${replay}`} className="study-motion-progress" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="study-motion-playback">
            <button
              type="button"
              onClick={() => setAutoplay((current) => !current)}
              aria-label={autoplay && allowsMotion ? "Pause motion" : "Play motion"}
              title={allowsMotion ? (autoplay ? "Pause motion" : "Play motion") : "Motion is off in your preferences"}
              disabled={!allowsMotion}
            >
              {autoplay && allowsMotion ? <Pause size={ICON.lg} weight="fill" aria-hidden="true" /> : <Play size={ICON.lg} weight="fill" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => { setActiveStep(0); setAutoplay(true); setHasManualStep(false); setReplay((current) => current + 1); }}
              aria-label="Replay study sequence"
              title="Replay study sequence"
            >
              <ArrowCounterClockwise size={ICON.lg} aria-hidden="true" />
            </button>
          </div>
        </div>
      </figcaption>
    </figure>
  );
}
