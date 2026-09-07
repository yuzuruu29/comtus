import { Brain, CaretDown } from "@phosphor-icons/react";
import { Collapse } from "./fx";

/** The collapsible reasoning trace above an answer. Text renders in
 *  `--moon` (Task 2.4) so the drawer reads distinct from the answer's ink
 *  body copy. */
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
    <div className="think-rule relative overflow-hidden rounded-xl border border-brass/35 bg-surface shadow-sm">
      {isThinking && <span className="pixel-reasoning-laser-top" aria-hidden="true" />}

      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-brass/[0.06] cursor-pointer"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-brass/15 text-brass">
          <Brain size={14} weight="bold" />
        </div>

        <span
          className={`font-mono text-[12px] font-semibold tracking-wide ${
            isThinking ? "thinking-live" : "text-brass"
          }`}
        >
          {isThinking ? "COGNITIVE REASONING MATRIX ACTIVE…" : "Socratic Reasoning Process"}
        </span>

        {isThinking && (
          <div
            className="flex items-center gap-1 h-3.5 px-1.5 py-0.5 rounded bg-brass/15 border border-brass/30"
            title="Active inference stream"
          >
            <span className="pixel-eq-bar pixel-eq-bar-1" />
            <span className="pixel-eq-bar pixel-eq-bar-2" />
            <span className="pixel-eq-bar pixel-eq-bar-3" />
            <span className="pixel-eq-bar pixel-eq-bar-4" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted bg-ground px-2 py-0.5 rounded border border-hairline">
            {isThinking ? "STREAMING" : "TRACE"}
          </span>
          <CaretDown
            size={13}
            className={`text-muted transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
        </div>
      </button>

      <Collapse open={open}>
        <div className="max-h-64 overflow-y-auto px-4 pb-3.5 pt-1 font-mono text-[12px] leading-relaxed text-moon whitespace-pre-wrap border-t border-hairline bg-ground/50">
          {thinking}
          {isThinking && <span className="pixel-thought-cursor" aria-hidden="true" />}
        </div>
      </Collapse>

      {isThinking && <span aria-hidden className="think-gloss" />}
    </div>
  );
}
