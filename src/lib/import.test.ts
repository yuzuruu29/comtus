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

import { extractFile, parseReaderResponse } from "./import";

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
