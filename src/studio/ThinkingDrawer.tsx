import { Brain, CaretDown } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { Collapse, EXIT, RISE_1, SOFT } from "./fx";
import { ICON } from "../ui/iconScale";

/** The collapsible reasoning trace above an answer. Text renders in
 *  `--moon` (Task 2.4) so the drawer reads distinct from the answer's ink
 *  body copy.
 *
 *  Every state change inside the header crosses instead of snapping. The
 *  label, the equaliser and the badge are one unit each, and the trace
 *  settles from the live stream into the finished thought. BRAND.md 5 wants
 *  the change seen, and a motion tier may shorten a crossing but never
 *  remove a state: every cross ends on the new state at full opacity. */
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
  return (
    <div className="think-rule relative overflow-hidden rounded-[var(--radius-dialog)] border border-brass/35 bg-surface shadow-sm">
      {isThinking && <span className="pixel-reasoning-laser-top" aria-hidden="true" />}

      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-brass/[0.06] cursor-pointer"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-brass/15 text-brass">
          <Brain size={ICON.sm} weight="bold" />
        </div>

        {/* Label and equaliser cross as one unit. The equaliser is the
            streaming half of the same statement, so it leaves with the
            label instead of popping out of nothing on its own. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isThinking ? "live" : "settled"}
            initial={{ opacity: 0, y: RISE_1 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -RISE_1, transition: EXIT }}
            transition={SOFT}
            className="flex items-center gap-2.5"
          >
            <span
              className={`font-mono text-[12px] font-semibold tracking-wide ${
                isThinking ? "thinking-live" : "text-brass"
              }`}
            >
              {isThinking ? "Thinking…" : "Socratic Reasoning Process"}
            </span>

            {isThinking && (
              <span
                className="flex items-center gap-1 h-3.5 px-1.5 py-0.5 rounded bg-brass/15 border border-brass/30"
                title="Active inference stream"
              >
                <span className="pixel-eq-bar pixel-eq-bar-1" />
                <span className="pixel-eq-bar pixel-eq-bar-2" />
                <span className="pixel-eq-bar pixel-eq-bar-3" />
                <span className="pixel-eq-bar pixel-eq-bar-4" />
              </span>
            )}
          </motion.span>
        </AnimatePresence>

        <div className="ml-auto flex items-center gap-2">
          {/* The badge chrome stays put and only its word crosses, so the
              caret beside it never has to move to make room. */}
          <span className="grid justify-items-center rounded border border-hairline bg-ground px-2 py-0.5">
            <AnimatePresence initial={false}>
              <motion.span
                key={isThinking ? "streaming" : "trace"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: EXIT }}
                transition={SOFT}
                className="col-start-1 row-start-1 font-mono text-[10px] uppercase tracking-wider text-muted"
              >
                {isThinking ? "STREAMING" : "TRACE"}
              </motion.span>
            </AnimatePresence>
          </span>
          <CaretDown
            size={ICON.sm}
            className={`text-muted think-caret ${open ? "" : "-rotate-90"}`}
          />
        </div>
      </button>

      <Collapse open={open}>
        <div className="max-h-64 overflow-y-auto px-4 pb-3.5 pt-1 font-mono text-[12px] leading-relaxed text-moon whitespace-pre-wrap border-t border-hairline bg-ground/50">
          {/* The live stream settles into the finished trace rather than
              being replaced under the reader. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isThinking ? "live" : "settled"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: EXIT }}
              transition={SOFT}
            >
              {thinking}
              {isThinking && <span className="pixel-thought-cursor" aria-hidden="true" />}
            </motion.div>
          </AnimatePresence>
        </div>
      </Collapse>

      {isThinking && <span aria-hidden className="think-gloss" />}
    </div>
  );
}
