import type { Source, SourceKind } from "./types";

/** How long a source is, in the unit a student thinks in: pages when the
 *  file has them, otherwise an approximate word count. */
export function sourceSize(s: Pick<Source, "chars" | "meta">): string {
  if (s.meta?.pages) return `${s.meta.pages} ${s.meta.pages === 1 ? "page" : "pages"}`;
  const words = Math.round(s.chars / 5.5);
  return words >= 1000 ? `${(words / 1000).toFixed(1)}k words` : `${words} words`;
}

export const SOURCE_KIND_NAMES: Record<SourceKind, string> = {
  pdf: "PDF",
  docx: "Word document",
  txt: "Text file",
  md: "Markdown",
  json: "JSON",
  url: "Web page",
  paste: "Pasted text",
  img: "Image",
};
