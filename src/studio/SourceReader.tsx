import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { Button, Dialog } from "../ui";
import type { Source } from "../lib/types";
import ExternalLink from "./ExternalLink";

const BLOCK_CHARS = 500;

/** Approximate page number for a block, spread evenly across the source's
 *  known page count. Task 6.5 anchors citations onto the same data-char
 *  attribute this margin marker sits next to. */
function blockPage(at: number, totalChars: number, pages?: number): string | null {
  if (!pages || totalChars === 0) return null;
  return String(Math.min(pages, Math.floor((at / totalChars) * pages) + 1));
}

/** The source reader: Literata at --text-read, capped to a 68ch measure,
 *  with page markers in the margin. */
export default function SourceReader({
  source,
  startChar,
  onClose,
}: {
  source: Source;
  startChar?: number;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // Bumped on every citation jump so the cite-flash animation replays
  // (an unchanged className does not restart a CSS animation).
  const [jumpTick, setJumpTick] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (startChar === undefined || !bodyRef.current) return;
    const at = Math.floor(startChar / BLOCK_CHARS) * BLOCK_CHARS;
    const el = bodyRef.current.querySelector(`[data-char="${at}"]`);
    setJumpTick((tick) => tick + 1);
    el?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [startChar, reduceMotion]);

  const blocks: { at: number; text: string }[] = [];
  for (let i = 0; i < source.content.length; i += BLOCK_CHARS)
    blocks.push({ at: i, text: source.content.slice(i, i + BLOCK_CHARS) });

  return (
    <Dialog open onClose={onClose} title={source.title} wide>
      <div className="mb-3 font-mono text-label uppercase tracking-[0.16em] text-muted">
        {source.kind} · {source.tokens.toLocaleString()} tokens
        {source.meta?.url && (
          <>
            {" · "}
            <ExternalLink href={source.meta.url} className="text-moon underline-offset-2 hover:underline">
              Original link
            </ExternalLink>
          </>
        )}
      </div>
      <div ref={bodyRef} className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
        {blocks.map((b) => {
          const isTarget = startChar !== undefined && startChar >= b.at && startChar < b.at + BLOCK_CHARS;
          const page = blockPage(b.at, source.content.length, source.meta?.pages);
          return (
            <div
              key={isTarget ? `${b.at}:${jumpTick}` : b.at}
              data-char={b.at}
              className={`flex gap-3 ${
                isTarget ? "cite-flash rounded bg-brass/[0.14] px-1.5 -mx-1.5 ring-1 ring-brass/30" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="w-8 shrink-0 select-none pt-1 text-right font-mono text-label text-muted/50"
              >
                {page ?? ""}
              </span>
              <p
                className="text-ink/85"
                style={{ fontFamily: "var(--font-read)", fontSize: "var(--text-read)", maxWidth: "68ch", lineHeight: 1.75 }}
              >
                {b.text}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose} icon={<X size={13} weight="light" />}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
