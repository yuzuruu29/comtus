import { ArrowSquareOut, Quotes } from "@phosphor-icons/react";
import type { Citation } from "../lib/types";
import { ICON } from "../ui/iconScale";
import ExternalLink from "./ExternalLink";

/** Citations arrive from model output, so `citedText` and `sourceTitle` are
 *  only as trustworthy as the provider's JSON — the non-optional fields on
 *  Citation are a compile-time claim, not a runtime guarantee. dedupe
 *  already coped with a missing citedText; the render path did not, and
 *  `c.citedText.slice()` on an undefined took the whole chat pane into the
 *  error boundary. Normalise once here rather than guarding at each read:
 *  every render routes through this function. */
type SafeCitation = Citation & { citedText: string; sourceTitle: string };

/** Same source cited twice (e.g. two chunks of one page) collapses to one
 *  footnote; caps at 10 like every other stagger in the studio. */
function dedupeCitations(list: Citation[]): SafeCitation[] {
  const seen = new Set<string>();
  const out: SafeCitation[] = [];
  for (const c of list ?? []) {
    if (!c) continue;
    const citedText = typeof c.citedText === "string" ? c.citedText : "";
    const sourceTitle = typeof c.sourceTitle === "string" ? c.sourceTitle : "";
    const key = `${c.sourceId}:${c.startChar ?? "x"}:${citedText.slice(0, 32)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, citedText, sourceTitle });
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
      <Quotes size={ICON.sm} weight="light" className="text-muted" />
      {list.map((c, i) => {
        const key = `${c.sourceId ?? "cite"}-${i}`;
        // The index is not decoration — it is how the answer refers to this
        // citation, so it stays in the accessible name.
        const index = <span>[{i + 1}]</span>;
        const host = c.url ? hostOf(c.url) : "";
        if (c.url) {
          return (
            <ExternalLink
              key={key}
              href={c.url}
              title={c.url}
              className="cite-footnote font-mono text-label text-brass transition-colors hover:text-ink"
            >
              {index} <span className="cite-footnote-title">{webTitle(c.sourceTitle) || host}</span>
              {host && <> <span className="shrink-0 text-muted">{host}</span></>}
              <ArrowSquareOut size={ICON.xs} className="shrink-0 self-center" aria-hidden="true" />
            </ExternalLink>
          );
        }
        // A web result cited before page addresses were kept has nothing to open.
        if (c.sourceId?.startsWith("web-")) {
          return (
            <span key={key} className="cite-footnote font-mono text-label text-muted">
              {index} <span className="cite-footnote-title">{webTitle(c.sourceTitle) || "Web page"}</span>
            </span>
          );
        }
        return (
          <button
            key={key}
            type="button"
            onClick={() => c.sourceId && onCite(c.sourceId, c.startChar)}
            title={c.citedText.slice(0, 160)}
            className="cite-footnote font-mono text-label text-brass transition-colors hover:text-ink"
          >
            {index} <span className="cite-footnote-title">{c.sourceTitle || "Source"}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Web results are titled "Web: …" so the model can tell them apart from
 *  the student's own sources; the reader doesn't need the prefix. */
function webTitle(title: string): string {
  return title.replace(/^Web:\s*/, "");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
