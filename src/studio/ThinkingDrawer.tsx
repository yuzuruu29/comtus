import { useEffect, useRef } from "react";
import { Brain, CaretDown } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { Collapse, EXIT, RISE_1, SOFT } from "./fx";
import { ICON } from "../ui/iconScale";

/** The model's reasoning, set beside the answer like a note in the margin:
 *  moon ink (BRAND.md 3 reserves moon for reasoning), a hairline rule and no
 *  card, so it never competes with the answer it explains. While the model
 *  thinks, the label's shimmer is the one thing that moves. */
export default function ThinkingDrawer({
  thinking,
  isThinking,
  open,
  onToggle,
}: {
  thinking: string;
  isThinking: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const traceRef = useRef<HTMLDivElement>(null);

  // Follow the newest line while it is being written, as a reader would.
  useEffect(() => {
    const el = traceRef.current;
    if (el && isThinking) el.scrollTop = el.scrollHeight;
  }, [thinking, isThinking, open]);

  return (
    <div className="think-note">
      <button type="button" onClick={onToggle} aria-expanded={open} className="think-toggle">
        <Brain size={ICON.sm} weight={isThinking ? "fill" : "regular"} className="shrink-0" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isThinking ? "live" : "settled"}
            initial={{ opacity: 0, y: RISE_1 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -RISE_1, transition: EXIT }}
            transition={SOFT}
            className={isThinking ? "thinking-live" : undefined}
          >
            {isThinking ? "Thinking…" : "Reasoning"}
          </motion.span>
        </AnimatePresence>
        <CaretDown size={ICON.xs} className={`think-caret ${open ? "" : "-rotate-90"}`} />
      </button>

      <Collapse open={open}>
        <div ref={traceRef} className="think-trace">
          {thinking}
        </div>
      </Collapse>
    </div>
  );
}
