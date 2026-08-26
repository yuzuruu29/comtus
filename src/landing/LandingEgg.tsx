import { useEffect, useRef, useState } from "react";
import { useLandingPlay } from "./LandingPlay";

const SECRET = "COMTUS";

/** Calm keyboard egg. L lights the lamp. Typing COMTUS shows a skippable note. */
export default function LandingEgg() {
  const { poke, lightAll } = useLandingPlay();
  const [note, setNote] = useState<string | null>(null);
  const buf = useRef("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as EventTarget | null;
      if (t instanceof HTMLElement && t.closest("input, textarea, select, [contenteditable]")) return;

      if (e.key === "l" || e.key === "L") {
        poke();
      }

      if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
        buf.current = (buf.current + e.key.toUpperCase()).slice(-SECRET.length);
        if (buf.current === SECRET) {
          buf.current = "";
          lightAll();
          setNote("The lamp remembers. Rough thought, polished.");
          window.setTimeout(() => setNote(null), 4200);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [poke, lightAll]);

  if (!note) return null;
  return (
    <div className="landing-egg" role="status">
      {note}
    </div>
  );
}
