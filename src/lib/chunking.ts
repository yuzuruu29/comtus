/**
 * Retrieval chunks: a source's text cut into overlapping pieces of about
 * a thousand tokens, on paragraph and sentence boundaries.
 */

const TARGET_CHARS = 4600; // ≈ 1,150 tokens
const OVERLAP_CHARS = 550;

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
      const sentences = p.split(/(?<=[.!?])\s+/);
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
