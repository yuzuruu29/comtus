import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDocument } = vi.hoisted(() => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({ numPages: 0 }),
  })),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument,
}));

import { MAX_SCAN_PAGES, TRANSCRIBED_NOTE, extractFile, parseReaderResponse, type Rasterizer, type Transcriber, type VisionRequest } from "./import";

describe("PDF import", () => {
  beforeEach(() => getDocument.mockClear());

  it("loads untrusted PDF bytes through the patched worker API", async () => {
    const file = {
      name: "untrusted.pdf",
      type: "application/pdf",
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as unknown as File;

    await extractFile(file);

    expect(getDocument).toHaveBeenCalledWith({ data: expect.any(ArrayBuffer) });
  });
});

describe("URL reader response", () => {
  it("takes the page title and drops the reader header", () => {
    const raw = [
      "Title: Photosynthesis - Wikipedia",
      "",
      "URL Source: https://en.wikipedia.org/wiki/Photosynthesis",
      "",
      "Published Time: 2026-01-01",
      "",
      "Markdown Content:",
      "Photosynthesis is a process used by plants to convert light energy into chemical energy.",
    ].join("\n");
    expect(parseReaderResponse(raw)).toEqual({
      title: "Photosynthesis - Wikipedia",
      body: "Photosynthesis is a process used by plants to convert light energy into chemical energy.",
    });
  });

  it("keeps the whole text when there is no header", () => {
    const raw = "Plain text page with no reader header at all, long enough to keep.";
    expect(parseReaderResponse(raw)).toEqual({ title: "", body: raw });
  });

  it("ignores a Title: line deep inside the article", () => {
    const raw = `${"Intro paragraph. ".repeat(100)}\nTitle: Not the page title`;
    expect(parseReaderResponse(raw).title).toBe("");
  });
});

/* ── Reading photos and scanned pages ─────────────────────── */

const image = { dataUrl: "data:image/jpeg;base64,AAAA", mediaType: "image/jpeg" as const };
const rasterizer: Rasterizer = {
  image: vi.fn(async () => image),
  pdfPage: vi.fn(async () => image),
};

function transcriber(answer: boolean, transcribe = vi.fn(async (_img: unknown, label: string) => `Text of ${label}`)) {
  const asked: VisionRequest[] = [];
  const t: Transcriber = {
    confirm: vi.fn(async (req: VisionRequest) => {
      asked.push(req);
      return answer;
    }),
    transcribe,
  };
  return { t, asked, transcribe };
}

/** A PDF whose listed pages have no text layer. */
function fakePdf(numPages: number, blankPages: number[]) {
  getDocument.mockReturnValueOnce({
    promise: Promise.resolve({
      numPages,
      getPage: async (n: number) => ({
        getTextContent: async () => ({
          items: blankPages.includes(n) ? [] : [{ str: `Typed text on page ${n}, long enough to count.`, hasEOL: true }],
        }),
      }),
    }),
  } as never);
}

const pdfFile = () => ({ name: "Lecture.pdf", type: "application/pdf", arrayBuffer: async () => new ArrayBuffer(8) }) as unknown as File;
const photo = () => ({ name: "notes.jpg", type: "image/jpeg", size: 1000 }) as unknown as File;

describe("reading photos", () => {
  it("transcribes a photo once the student agrees", async () => {
    const { t, asked } = transcriber(true);
    const [doc] = await extractFile(photo(), { transcriber: t, rasterizer });
    expect(asked).toEqual([{ fileName: "notes.jpg", kind: "image", pages: 1, scannedPages: 1 }]);
    expect(doc.text).toBe(`${TRANSCRIBED_NOTE}\n\nText of the photo “notes.jpg”`);
    expect(doc.meta?.origin).toBe("image-transcribed");
  });

  it("keeps the placeholder when the student declines or no model is connected", async () => {
    const { t, transcribe } = transcriber(false);
    const [declined] = await extractFile(photo(), { transcriber: t, rasterizer });
    expect(declined.text).toContain("[IMAGE SOURCE");
    expect(transcribe).not.toHaveBeenCalled();
    const [plain] = await extractFile(photo(), { rasterizer });
    expect(plain.text).toContain("[IMAGE SOURCE");
  });

  it("falls back to the placeholder, with a note, when the model can't see", async () => {
    const notes: string[] = [];
    const { t } = transcriber(true, vi.fn(async () => { throw new Error("This model can't read images"); }));
    const [doc] = await extractFile(photo(), { transcriber: t, rasterizer, onNote: (n) => notes.push(n) });
    expect(doc.text).toContain("[IMAGE SOURCE");
    expect(notes).toEqual(["added without its text — This model can't read images"]);
  });
});

describe("reading scanned PDF pages", () => {
  it("reads only the pages without a text layer", async () => {
    fakePdf(3, [2]);
    const { t, asked, transcribe } = transcriber(true);
    const [doc] = await extractFile(pdfFile(), { transcriber: t, rasterizer });
    expect(asked).toEqual([{ fileName: "Lecture.pdf", kind: "scan", pages: 1, scannedPages: 1 }]);
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(doc.text).toContain("[page 1]\nTyped text on page 1");
    expect(doc.text).toContain("[page 2]\nText of page 2 of 3 of “Lecture”");
    expect(doc.text).toContain("[page 3]\nTyped text on page 3");
    expect(doc.meta).toEqual({ pages: 3, origin: "scan-transcribed" });
  });

  it("never asks about a PDF that has text on every page", async () => {
    fakePdf(2, []);
    const { t, asked } = transcriber(true);
    const [doc] = await extractFile(pdfFile(), { transcriber: t, rasterizer });
    expect(asked).toEqual([]);
    expect(doc.meta?.origin).toBeUndefined();
  });

  it("keeps the text layer when the first page can't be read", async () => {
    fakePdf(2, [1, 2]);
    const notes: string[] = [];
    const failing = vi.fn(async () => { throw new Error("no vision"); });
    const { t } = transcriber(true, failing);
    const [doc] = await extractFile(pdfFile(), { transcriber: t, rasterizer, onNote: (n) => notes.push(n) });
    expect(failing).toHaveBeenCalledTimes(1);
    expect(doc.text).toContain("SCANNED PDF");
    expect(notes).toEqual(["added without its scanned pages — no vision"]);
  });

  it("marks a later page that fails and carries on", async () => {
    fakePdf(3, [1, 2, 3]);
    let calls = 0;
    const flaky = vi.fn(async () => {
      calls += 1;
      if (calls === 2) throw new Error("timeout");
      return "Read fine";
    });
    const { t } = transcriber(true, flaky);
    const [doc] = await extractFile(pdfFile(), { transcriber: t, rasterizer });
    expect(doc.text).toContain("[page 2]\n[This page could not be read.]");
    expect(doc.text).toContain("[page 3]\nRead fine");
  });

  it("caps the pages read per file and says which were left", async () => {
    const blank = Array.from({ length: MAX_SCAN_PAGES + 5 }, (_, i) => i + 1);
    fakePdf(blank.length, blank);
    const { t, asked, transcribe } = transcriber(true, vi.fn(async () => "ok"));
    const [doc] = await extractFile(pdfFile(), { transcriber: t, rasterizer });
    expect(asked[0]).toMatchObject({ pages: MAX_SCAN_PAGES, scannedPages: MAX_SCAN_PAGES + 5 });
    expect(transcribe).toHaveBeenCalledTimes(MAX_SCAN_PAGES);
    expect(doc.text).toContain(`5 more scanned pages were not read (from page ${MAX_SCAN_PAGES + 1})`);
  });
});
