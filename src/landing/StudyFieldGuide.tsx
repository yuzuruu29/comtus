import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowsClockwise } from "@phosphor-icons/react";
import "./study-field-guide.css";

export default function StudyFieldGuide() {
  const [answerOpen, setAnswerOpen] = useState(false);

  return (
    <section id="study-tools" className="field-guide" aria-labelledby="landing-tools-title">
      <div className="landing-container">
        <div className="field-guide-heading" data-landing-reveal>
          <p className="landing-eyebrow">From the Comtus field guide</p>
          <h2 id="landing-tools-title">There’s more than one way{" "}<br />into a <em>chapter.</em></h2>
          <p>Read a little. Follow a connection.{" "}<br />Find a question worth coming back to.</p>
        </div>

        <figure className="field-guide-figure">
          <div className="field-guide-art">
            <article className="field-guide-source">
              <div className="field-guide-source-meta"><span>Reading notes</span><span>12</span></div>
              <h3>Why do{" "}<br />we forget?</h3>
              <p>A familiar sentence can feel like something we know. But recognising an idea is different from bringing it to mind.</p>
              <p><mark>Put the page aside.{" "}<br />What can you explain?</mark></p>
              <div className="field-guide-source-tail"><span aria-hidden="true">↳</span> A good place to begin.</div>
            </article>

            <div className="field-guide-map" aria-labelledby="field-guide-map-title">
              <svg className="field-guide-branches" viewBox="0 0 700 460" preserveAspectRatio="none" fill="none" aria-hidden="true">
                <path className="field-guide-branch field-guide-branch-attention" pathLength="1" d="M309 214C254 202 275 156 225 135C193 122 155 133 128 121" />
                <path className="field-guide-branch field-guide-branch-meaning" pathLength="1" d="M387 213C437 184 411 143 448 110C474 87 514 98 535 78" />
                <path className="field-guide-branch field-guide-branch-retrieval" pathLength="1" d="M301 251C248 260 283 302 246 325C230 339 213 334 200 350" />
                <path className="field-guide-branch field-guide-branch-spacing" pathLength="1" d="M394 252C447 273 414 311 433 338C438 348 443 352 450 363" />
                <path className="field-guide-branch field-guide-map-underline" pathLength="1" d="M256 280C315 270 374 271 426 277M293 287C328 282 370 283 399 282" />
                <circle cx="128" cy="121" r="4" /><circle cx="535" cy="78" r="4" />
                <circle cx="200" cy="350" r="4" /><circle cx="450" cy="363" r="4" />
              </svg>
              <h3 id="field-guide-map-title">Learning{" "}<br /><em>& memory</em></h3>
              <p className="field-guide-map-label field-guide-attention"><strong>Attention</strong><span>Notice the useful part.</span></p>
              <p className="field-guide-map-label field-guide-meaning"><strong>Making meaning</strong><span>Connect it to what you know.</span></p>
              <p className="field-guide-map-label field-guide-retrieval"><strong>Retrieval</strong><span>Find it without the page.</span></p>
              <p className="field-guide-map-label field-guide-spacing"><strong>Spaced practice</strong><span>Leave room to return.</span></p>
              <span className="field-guide-map-note">an idea has more than one way in.</span>
            </div>

            <article className="field-guide-card" data-turned={answerOpen} aria-label="Sample recall card">
              <div className="field-guide-card-turn" data-turned={answerOpen}>
                <div className="field-guide-card-face field-guide-card-question" aria-hidden={answerOpen}>
                  <span className="field-guide-card-kicker">A question to keep</span>
                  <h3>Close the page.{" "}<br /><em>What stayed?</em></h3>
                  <p>How is recognising an idea different from recalling it?</p>
                </div>
                <div className="field-guide-card-face field-guide-card-answer" aria-hidden={!answerOpen}>
                  <span className="field-guide-card-kicker">One way to explain it</span>
                  <h3>Familiar isn’t{" "}<br /><em>remembered.</em></h3>
                  <p>Recognition uses a clue in front of you. Recall brings the idea to mind without that clue.</p>
                </div>
              </div>
              <button type="button" aria-pressed={answerOpen} onClick={() => setAnswerOpen((current) => !current)}>
                Turn the card<ArrowsClockwise size={18} aria-hidden="true" />
              </button>
            </article>
          </div>
          <figcaption>Illustrative study material. A source, a connection, a way to practise.</figcaption>
        </figure>

        <div className="field-guide-next" data-landing-reveal>
          <p>Your own chapter will take a different shape.</p>
          <Link to="/studio">Find your way in Studio<ArrowUpRight size={20} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
