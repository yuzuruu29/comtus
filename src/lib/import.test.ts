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

import { extractFile } from "./import";

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
