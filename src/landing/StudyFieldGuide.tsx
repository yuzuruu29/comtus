import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowsClockwise } from "@phosphor-icons/react";
import "./study-field-guide.css";
import { ICON } from "../ui/iconScale";

export default function StudyFieldGuide() {
  const [answerOpen, setAnswerOpen] = useState(false);

  return (
    <section id="study-tools" className="field-guide" aria-labelledby="landing-tools-title">
      <div className="landing-container">
        <div className="field-guide-heading" data-landing-reveal>
          <h2 id="landing-tools-title">There’s more than one way{" "}<br />into a <em>chapter.</em></h2>
          <p>Choose the kind of practice your next study session needs.</p>
        </div>

        <div className="field-guide-body">
          <dl className="field-guide-formats">
            <div data-landing-reveal><dt>Remember the essentials.</dt><dd><span>Flashcards & quizzes</span>Recall an idea before you turn the card. Check the explanation when you miss a question.</dd></div>
            <div data-landing-reveal><dt>See how it fits together.</dt><dd><span>Study guides & timelines</span>Give a long chapter a shape you can work with, then follow the details back to your sources.</dd></div>
            <div data-landing-reveal><dt>Rehearse the harder parts.</dt><dd><span>Mock exams & essay feedback</span>Practise under a time limit, or take another pass at your argument and the evidence behind it.</dd></div>
          </dl>
          <figure className="field-guide-figure" data-landing-reveal>
            <div className="field-guide-deck">
              <article className="field-guide-card" data-turned={answerOpen} aria-label="Sample recall card">
                <div className="field-guide-card-index"><span>Learning & memory</span><span>01 / 01</span></div>
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
                  Turn the card<ArrowsClockwise size={ICON.lg} aria-hidden="true" />
                </button>
              </article>
            </div>
            <figcaption>A sample flashcard. Give it a turn.</figcaption>
          </figure>
        </div>

        <div className="field-guide-next" data-landing-reveal>
          <p>Your own chapter will take a different shape.</p>
          <Link to="/studio">Find your way at the desk</Link>
        </div>
      </div>
    </section>
  );
}
