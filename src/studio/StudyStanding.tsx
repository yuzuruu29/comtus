import { useEffect, useId, useState } from "react";
import { Target } from "@phosphor-icons/react";
import { notebookStanding, type TopicStanding } from "../lib/attempts";
import { Button } from "../ui";
import { fmtScore } from "./generators/common";
import { ICON } from "../ui/iconScale";

const SHOWN = 4;
const STEADY = 0.8;

/**
 * Where the student stands, topic by topic, from their recent quiz and
 * exam answers — weakest first, each one a click from focused practice.
 * Renders nothing until a quiz or exam has been finished.
 */
export default function StudyStanding({
  notebookId,
  version,
  onPractice,
}: {
  notebookId: string;
  /** Bump to re-read after an attempt is saved. */
  version: number;
  onPractice: (topic: string) => void;
}) {
  const [standing, setStanding] = useState<TopicStanding[] | null>(null);
  const titleId = useId();

  useEffect(() => {
    let current = true;
    notebookStanding(notebookId)
      .then((rows) => {
        if (current) setStanding(rows);
      })
      .catch(() => {
        if (current) setStanding([]);
      });
    return () => {
      current = false;
    };
  }, [notebookId, version]);

  if (!standing || standing.length === 0) return null;

  const needsWork = standing.filter((t) => t.earned / t.total < STEADY).slice(0, SHOWN);

  return (
    <section className="study-standing" aria-labelledby={titleId}>
      <div className="study-standing-heading">
        <Target size={ICON.lg} aria-hidden="true" />
        <h3 id={titleId}>Where you stand</h3>
      </div>
      {needsWork.length === 0 ? (
        <p className="study-standing-note">
          Every topic you’ve practised is holding at {STEADY * 100}% or better in your recent answers.
        </p>
      ) : (
        <>
          <p className="study-standing-note">From your recent quiz and exam answers, weakest first.</p>
          <ul className="study-standing-list">
            {needsWork.map((t) => {
              const ratio = t.earned / t.total;
              return (
                <li key={t.topic}>
                  <div className="study-standing-row">
                    <span className="study-standing-topic">{t.topic}</span>
                    <span className="study-standing-count">
                      {fmtScore(t.earned)} of {t.total}
                    </span>
                  </div>
                  <div className="study-standing-bar" aria-hidden="true">
                    <span
                      data-level={ratio >= 0.5 ? "mid" : "low"}
                      style={{ ["--ratio" as string]: Math.max(0.03, ratio) }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="study-standing-practice"
                    onClick={() => onPractice(t.topic)}
                    aria-label={`Practice ${t.topic}`}
                  >
                    Practice
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
