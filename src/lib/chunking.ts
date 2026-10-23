/**
 * Retrieval chunks: a source's text cut into overlapping pieces of about
 * a thousand tokens, on paragraph and sentence boundaries.
 */

const TARGET_CHARS = 4600; // ≈ 1,150 tokens
const OVERLAP_CHARS = 550;
/** No chunk is longer than this: a full piece, the carried overlap and the
 *  paragraph break between them. */
export const MAX_CHUNK_CHARS = TARGET_CHARS + OVERLAP_CHARS + 2;

/** Text with no sentence break (PDF extracts, CJK, tables) is cut at the
 *  last space before the limit, or at the limit when there is none. */
function cutToSize(text: string): string[] {
  const pieces: string[] = [];
  let rest = text;
  while (rest.length > TARGET_CHARS) {
    const space = rest.lastIndexOf(" ", TARGET_CHARS);
    let cut = space > TARGET_CHARS / 2 ? space : TARGET_CHARS;
    // Never split a surrogate pair.
    if (/[\uD800-\uDBFF]/.test(rest[cut - 1])) cut--;
    pieces.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = t.length > OVERLAP_CHARS ? t.slice(-OVERLAP_CHARS) : "";
  };

  for (const p of paragraphs) {
    if (p.length > TARGET_CHARS) {
      // Very long paragraph — split on sentence boundaries.
      const sentences = p.split(/(?<=[.!?])\s+/).flatMap(cutToSize);
      for (const s of sentences) {
        if (buf.length + s.length > TARGET_CHARS) flush();
        buf += (buf && !buf.endsWith("\n") ? " " : "") + s;
      }
      continue;
    }
    if (buf.length + p.length > TARGET_CHARS) flush();
    buf += (buf ? "\n\n" : "") + p;
  }
  const t = buf.trim();
  if (t && chunks[chunks.length - 1] !== t) chunks.push(t);
  return chunks;
}
