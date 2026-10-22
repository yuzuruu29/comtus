/** A pen mark drawn in one stroke: a check for a right answer or a held
 *  milestone, a cross for a miss. At the Full budget the stroke is drawn;
 *  otherwise it is simply there. Decorative: the words carry the verdict. */
export function InkMark({ kind, className = "" }: { kind: "check" | "cross"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`ink-mark ${className}`.trim()} aria-hidden="true" focusable="false">
      {kind === "check" ? (
        <path pathLength={1} d="M4.6 12.9c1.9 1.3 3.4 3 4.5 5.1 2.7-5.3 6.1-9.5 10.4-12.6" />
      ) : (
        <>
          <path pathLength={1} d="M6.2 6.4c4.1 3.7 7.9 7.4 11.5 11.4" />
          <path pathLength={1} d="M17.7 6.3c-4.1 3.5-7.9 7.3-11.4 11.3" />
        </>
      )}
    </svg>
  );
}
