import "./polyfills";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { estTokens } from "./retrieval";
import type { SourceKind } from "./types";
import type { VisionImage } from "./llm";
import { uid } from "./db";
import { loadChunk } from "./lazyChunk";
import { chunkText } from "./chunking";

/* pdfjs is ~1 MB with its worker; it loads the first time a PDF is opened,
   not with the studio. One module-level promise serves every import. */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
  pdfjsPromise ??= (async () => {
    const [lib, worker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  return pdfjsPromise;
}

export interface ExtractedDoc {
  title: string;
  kind: SourceKind;
  text: string;
  meta?: { url?: string; pages?: number; origin?: string };
}

/* ── Reading photos and scanned pages ─────────────────────── */

/** What the student is asked before any image leaves the device. */
export interface VisionRequest {
  fileName: string;
  kind: "image" | "scan";
  /** Pages that would be sent to the model. */
  pages: number;
  /** Pages without a text layer, before the per-file cap. */
  scannedPages: number;
}

/** Supplied by the UI when a model is connected. Nothing is transcribed
 *  unless `confirm` resolves true for that file. */
export interface Transcriber {
  confirm: (request: VisionRequest) => Promise<boolean>;
  transcribe: (image: VisionImage, label: string) => Promise<string>;
}

/** Turns files and PDF pages into images; injectable for tests. */
export interface Rasterizer {
  image: (file: File) => Promise<VisionImage>;
  pdfPage: (pdf: PDFDocumentProxy, pageNumber: number) => Promise<VisionImage>;
}

export interface ExtractOptions {
  transcriber?: Transcriber;
  onStatus?: (status: string) => void;
  /** A problem that didn't stop the import, e.g. a page that couldn't be read. */
  onNote?: (note: string) => void;
  rasterizer?: Rasterizer;
}

/** Scanned pages read per file; a longer scan is best split. */
export const MAX_SCAN_PAGES = 30;
/** A page with less text than this has no real text layer. */
const MIN_PAGE_CHARS = 25;
const RASTER_EDGE = 1600;

export const TRANSCRIBED_NOTE =
  "[Transcribed from images by AI. Reading errors are possible; check anything surprising against the original.]";

function canvasToVision(canvas: HTMLCanvasElement): VisionImage {
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), mediaType: "image/jpeg" };
}

const browserRasterizer: Rasterizer = {
  async image(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, RASTER_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser couldn't prepare the image.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvasToVision(canvas);
  },
  async pdfPage(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, RASTER_EDGE / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser couldn't render the page.");
    ctx.fillStyle = "white"; // JPEG has no transparency; scans sit on paper.
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return canvasToVision(canvas);
  },
};

const reason = (err: unknown) => (err instanceof Error ? err.message : "the model couldn't read it");

/* ── File extraction ──────────────────────────────────────── */

export async function extractFile(file: File, opts: ExtractOptions = {}): Promise<ExtractedDoc[]> {
  const name = file.name.replace(/\.[^.]+$/, "");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const raster = opts.rasterizer ?? browserRasterizer;

  // Images & non-text visual sources
  if (
    file.type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "gif", "avif"].includes(ext)
  ) {
    const { transcriber } = opts;
    if (transcriber && (await transcriber.confirm({ fileName: file.name, kind: "image", pages: 1, scannedPages: 1 }))) {
      opts.onStatus?.(`Reading ${file.name}…`);
      try {
        const text = await transcriber.transcribe(await raster.image(file), `the photo “${file.name}”`);
        return [
          {
            title: name,
            kind: "img",
            text: `${TRANSCRIBED_NOTE}\n\n${text}`,
            meta: { pages: 1, origin: "image-transcribed" },
          },
        ];
      } catch (err) {
        opts.onNote?.(`added without its text — ${reason(err)}`);
      }
    }
    const text = `[Non-Text Visual Source: ${file.name}]
Type: ${file.type || ext} · Size: ${(file.size / 1024).toFixed(1)} KB

[IMAGE SOURCE — VISUAL CONTENT NOT MACHINE-READABLE YET]
This source is an image that was added without being read, so no text was
extracted (handwriting, diagrams, formulas). If the student asks about it,
state plainly that its content is not readable here and suggest adding the
file again and choosing "Read the photo" when Comtus asks (this needs a
vision-capable model), or attaching the photo in chat. Never invent text
for this image.
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
    const pdfjs = await loadPdfjs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = await pdfPageTexts(pdf);
    const read = await transcribeScannedPages(pdf, pages, file.name, name, opts, raster);
    const text = read ?? formatPdfText(pages, name, pdf.numPages);
    return [
      {
        title: name,
        kind: "pdf",
        text,
        meta: { pages: countPages(text), ...(read ? { origin: "scan-transcribed" } : {}) },
      },
    ];
  }
  if (ext === "docx") {
    // Resolve source modules so patched XML dependencies reach the browser build.
    const { default: mammoth } = await loadChunk(() => import("mammoth"));
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
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

/** Text of each page, in order; an empty string for a page with no text layer. */
async function pdfPageTexts(pdf: PDFDocumentProxy): Promise<string[]> {
  const pages: string[] = [];
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
    pages.push(out.join("\n"));
  }
  return pages;
}

const joinPages = (pages: string[]) => pages.map((t, i) => `[page ${i + 1}]\n${t}`).join("\n\n");

/** The text layer as-is, flagged when the document is essentially scanned. */
function formatPdfText(pages: string[], title: string, numPages: number): string {
  const text = joinPages(pages);
  const totalExtractedChars = pages.reduce((n, p) => n + p.replace(/\s+/g, "").length, 0);
  if (totalExtractedChars >= 80 || numPages === 0) return text;
  return `[Non-Text / Scanned PDF Source: ${title} (${numPages} page(s))]
[Notice: Embedded text layer is sparse (${totalExtractedChars} readable characters). This document is primarily scanned image pages.]

[SCANNED PDF — VISUAL CONTENT NOT MACHINE-READABLE YET]
Only the sparse embedded text layer (above, if any) was extracted; the
scanned pages were added without being read. If the student asks about
them, state plainly that the page images are not readable here and suggest
adding the file again and choosing to read the scanned pages when Comtus
asks (this needs a vision-capable model), or attaching photos of the pages
in chat. Never invent text for pages that were not extracted.
[END SCANNED PDF]\n\n` + text;
}

/**
 * Reads the pages that have no text layer with the student's model, if
 * they agree. Returns the finished text, or null to keep the text layer
 * as it is. A page that fails after the first is marked and skipped; if
 * the first fails (usually a model that can't see images), nothing is
 * spent further and the file keeps its text layer.
 */
async function transcribeScannedPages(
  pdf: PDFDocumentProxy,
  pages: string[],
  fileName: string,
  title: string,
  opts: ExtractOptions,
  raster: Rasterizer,
): Promise<string | null> {
  const { transcriber } = opts;
  if (!transcriber) return null;
  const scanned = pages.flatMap((t, i) => (t.replace(/\s+/g, "").length < MIN_PAGE_CHARS ? [i] : []));
  if (scanned.length === 0) return null;
  const toRead = scanned.slice(0, MAX_SCAN_PAGES);
  if (!(await transcriber.confirm({ fileName, kind: "scan", pages: toRead.length, scannedPages: scanned.length }))) {
    return null;
  }

  const result = [...pages];
  for (const [k, i] of toRead.entries()) {
    opts.onStatus?.(`Reading ${fileName} — page ${i + 1} (${k + 1} of ${toRead.length})`);
    try {
      const image = await raster.pdfPage(pdf, i + 1);
      result[i] = await transcriber.transcribe(image, `page ${i + 1} of ${pdf.numPages} of “${title}”`);
    } catch (err) {
      if (k === 0) {
        opts.onNote?.(`added without its scanned pages — ${reason(err)}`);
        return null;
      }
      result[i] = "[This page could not be read.]";
      opts.onNote?.(`page ${i + 1} could not be read — ${reason(err)}`);
    }
  }

  const skipped = scanned.slice(MAX_SCAN_PAGES);
  const skippedNote = skipped.length
    ? `\n[${skipped.length} more scanned ${skipped.length === 1 ? "page was" : "pages were"} not read (from page ${skipped[0] + 1}). Comtus reads up to ${MAX_SCAN_PAGES} per file; add the rest as a separate file.]`
    : "";
  return `${TRANSCRIBED_NOTE}${skippedNote}\n\n${joinPages(result)}`;
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
  const { title, body } = parseReaderResponse(await res.text());
  if (body.trim().length < 40)
    throw new Error("That page returned nothing readable.");
  return { title: title || hostname, kind: "url", text: body, meta: { url } };
}

/** Jina's reader prefixes the page with a small header block —
 *  "Title: …", "URL Source: …", "Published Time: …", then
 *  "Markdown Content:". Keep the title, drop the header from the text. */
export function parseReaderResponse(raw: string): { title: string; body: string } {
  const marker = raw.match(/^Markdown Content:[ \t]*\r?\n/m);
  const header = marker ? raw.slice(0, marker.index) : raw.slice(0, 1200);
  const title = header.match(/^Title:[ \t]*(.+)$/m)?.[1].trim().slice(0, 200) ?? "";
  const body = marker ? raw.slice(marker.index! + marker[0].length) : raw;
  return { title, body: body.trim() };
}

/* ── Chunking ─────────────────────────────────────────────── */

export { chunkText };

export interface ImportOutcome {
  added: number;
  failed: { name: string; reason: string }[];
  /** Added, but with something worth knowing (e.g. a page not read). */
  notes: { name: string; reason: string }[];
}

/** Extract → chunk → persist. Reports per-file outcomes. With a
 *  transcriber, photos and scanned pages can be read by the model. */
export async function importFiles(
  files: File[],
  notebookId: string,
  onProgress?: (done: number, total: number, current: string) => void,
  transcriber?: Transcriber,
): Promise<ImportOutcome> {
  const { addSourceWithChunks } = await loadChunk(() => import("./db"));
  const outcome: ImportOutcome = { added: 0, failed: [], notes: [] };
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);
    try {
      const docs = await extractFile(file, {
        transcriber,
        onStatus: (status) => onProgress?.(i, files.length, status),
        onNote: (note) => outcome.notes.push({ name: file.name, reason: note }),
      });
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
