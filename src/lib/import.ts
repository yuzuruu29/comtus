import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { estTokens } from "./retrieval";
import type { SourceKind } from "./types";
import { uid } from "./db";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface ExtractedDoc {
  title: string;
  kind: SourceKind;
  text: string;
  meta?: { url?: string; pages?: number; origin?: string };
}

/* ── File extraction ──────────────────────────────────────── */

export async function extractFile(file: File): Promise<ExtractedDoc[]> {
  const name = file.name.replace(/\.[^.]+$/, "");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  // Images & non-text visual sources
  if (
    file.type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "gif", "avif"].includes(ext)
  ) {
    const text = `[Non-Text Visual Source: ${file.name}]
Type: ${file.type || ext} · Size: ${(file.size / 1024).toFixed(1)} KB

[IMAGE SOURCE — VISUAL CONTENT NOT MACHINE-READABLE YET]
This source is an image. Grounded notebooks cannot read image contents
(handwriting, diagrams, formulas) at the moment, so no text was extracted.
If the student asks about this image, state plainly that its visual content
is not readable here and suggest attaching the photo directly in chat or via
Check My Solution, where a vision-capable model can view it. Never invent
text for this image.
[END IMAGE SOURCE]`;

    return [
      {
        title: name,
        kind: "img",
        text,
        meta: { pages: 1, origin: "image-upload" },
      },
    ];
  }

  if (ext === "pdf" || file.type === "application/pdf") {
    const text = await pdfToText(await file.arrayBuffer(), name);
    return [{ title: name, kind: "pdf", text, meta: { pages: countPages(text) } }];
  }
  if (ext === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await (
      mammoth as unknown as {
        extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
      }
    ).extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return [{ title: name, kind: "docx", text: result.value }];
  }
  if (ext === "json") {
    return extractNotebookLMJson(await file.text(), name);
  }
  // txt, md, and anything else that plausibly decodes
  const text = await file.text();
  return [
    {
      title: name,
      kind: ext === "md" || ext === "markdown" ? "md" : "txt",
      text,
    },
  ];
}

async function pdfToText(buffer: ArrayBuffer, title = "PDF Document"): Promise<string> {
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  let totalExtractedChars = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let last = 0;
    let line = "";
    const out: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      if (item.hasEOL) {
        out.push(line + item.str);
        line = "";
        last = 0;
      } else {
        const gap = item.str.length > 0 && last > 0 && item.str.startsWith(" ") ? 0 : 1;
        line += (line && gap ? " " : "") + item.str;
        last = item.width ?? 0;
      }
    }
    if (line) out.push(line);
    const pageContent = out.join("\n");
    totalExtractedChars += pageContent.replace(/\s+/g, "").length;
    pages.push(`[page ${i}]\n${pageContent}`);
  }

  let text = pages.join("\n\n");

  // Scanned / Non-text PDF Detection
  if (totalExtractedChars < 80 && pdf.numPages > 0) {
    text = `[Non-Text / Scanned PDF Source: ${title} (${pdf.numPages} page(s))]
[Notice: Embedded text layer is sparse (${totalExtractedChars} readable characters). This document is primarily scanned image pages.]

[SCANNED PDF — VISUAL CONTENT NOT MACHINE-READABLE YET]
Only the sparse embedded text layer (above, if any) was extracted. Grounded
notebooks cannot OCR scanned pages yet. If the student asks about the visual
pages, state plainly that the page images are not readable here and suggest
attaching photos of the relevant pages in chat or via Check My Solution,
where a vision-capable model can view them. Never invent text for pages that
were not extracted.
[END SCANNED PDF]\n\n` + text;
  }

  return text;
}

const countPages = (text: string) => (text.match(/\[page \d+\]/g) ?? []).length;

/**
 * NotebookLM has no native export (as of 2026), but community backup
 * extensions (ExtendLM, NLM Tools) emit JSON. Accept the common shapes
 * generously — each entry becomes its own source.
 */
export function extractNotebookLMJson(raw: string, fallbackName: string): ExtractedDoc[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [{ title: fallbackName, kind: "json", text: raw }];
  }

  const entries: unknown[] = [];
  const push = (v: unknown) => {
    if (Array.isArray(v)) entries.push(...v);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (Array.isArray(o.sources)) entries.push(...o.sources);
      else if (Array.isArray(o.notebooks)) o.notebooks.forEach(push);
      else entries.push(o);
    }
  };
  push(data);

  const docs: ExtractedDoc[] = [];
  for (const entry of entries) {
    try {
      const e = (entry ?? {}) as Record<string, unknown>;
      if (typeof entry !== "object" || entry === null) continue;
      const title = (e.title ?? e.name ?? fallbackName).toString();
      const text = (e.content ?? e.text ?? "").toString().trim();
      if (text.length > 40) docs.push({ title, kind: "json", text, meta: { origin: "notebooklm" } });
    } catch {
      // One malformed entry shouldn't sink the whole import.
    }
  }
  if (docs.length === 0)
    docs.push({ title: fallbackName, kind: "json", text: raw });
  return docs;
}

/** Reader-mode fetch for URL sources (CORS-friendly via Jina reader).
 *  Only http(s) URLs are accepted — the stored value is later rendered
 *  as a link, so anything else stays out of the database. */
export async function extractUrl(rawUrl: string): Promise<ExtractedDoc> {
  const url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url))
    throw new Error("Enter a full http(s) URL.");
  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  const res = await fetch(`https://r.jina.ai/${url}`, {
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Couldn't read that page (${res.status}).`);
  const text = await res.text();
  if (text.trim().length < 40)
    throw new Error("That page returned nothing readable.");
  return { title: hostname, kind: "url", text, meta: { url } };
}

/* ── Chunking ─────────────────────────────────────────────── */

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

export interface ImportOutcome {
  added: number;
  failed: { name: string; reason: string }[];
}

/** Extract → chunk → persist. Reports per-file outcomes. */
export async function importFiles(
  files: File[],
  notebookId: string,
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<ImportOutcome> {
  const { addSourceWithChunks } = await import("./db");
  const outcome: ImportOutcome = { added: 0, failed: [] };
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);
    try {
      const docs = await extractFile(file);
      for (const doc of docs) {
        const id = uid();
        const pieces = chunkText(doc.text);
        const source = {
          id,
          notebookId,
          title: doc.title,
          kind: doc.kind,
          content: doc.text,
          chars: doc.text.length,
          tokens: estTokens(doc.text),
          addedAt: Date.now(),
          meta: doc.meta,
        };
        const chunks = pieces.map((text, idx) => ({
          id: `${id}:${idx}`,
          sourceId: id,
          notebookId,
          idx,
          text,
          tokens: estTokens(text),
        }));
        await addSourceWithChunks(source, chunks);
        outcome.added++;
      }
    } catch (err) {
      outcome.failed.push({
        name: file.name,
        reason: err instanceof Error ? err.message : "Couldn't read this file.",
      });
    }
  }
  onProgress?.(files.length, files.length, "");
  return outcome;
}
