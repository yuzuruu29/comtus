import { Quotes } from "@phosphor-icons/react";
import type { Citation } from "../lib/types";

/** Same source cited twice (e.g. two chunks of one page) collapses to one
 *  footnote; caps at 10 like every other stagger in the studio. */
function dedupeCitations(list: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of list) {
    const key = `${c.sourceId}:${c.startChar ?? "x"}:${(c.citedText ?? "").slice(0, 32)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.slice(0, 10);
}

/** `[n]` mono footnotes under an answer (Task 2.4: replaces the older
 *  pill-chip citation rendering). */
export default function CitationList({
  citations,
  onCite,
}: {
  citations: Citation[];
  onCite: (sourceId: string, startChar?: number) => void;
}) {
  const list = dedupeCitations(citations);
  if (list.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
      <Quotes size={13} weight="light" className="text-muted/60" />
      {list.map((c, i) => (
        <button
          key={`${c.sourceId ?? "cite"}-${i}`}
          type="button"
          onClick={() => c.sourceId && onCite(c.sourceId, c.startChar)}
          title={c.citedText.slice(0, 160)}
          className="cite-footnote font-mono text-label text-brasspale transition-colors hover:text-brass"
        >
          [{i + 1}] {c.sourceTitle.length > 28 ? `${c.sourceTitle.slice(0, 28)}…` : c.sourceTitle}
        </button>
      ))}
    </div>
  );
}
