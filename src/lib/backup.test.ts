import { describe, expect, it } from "vitest";
import { parseBackupPayload } from "./backup";
import { formatBytes } from "./storageStats";

describe("formatBytes", () => {
  it("formats byte sizes in a short human unit", () => {
    expect(formatBytes(400)).toBe("400 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("parseBackupPayload", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseBackupPayload("{")).toThrow(/valid JSON/);
  });

  it("rejects a non-Comtus file", () => {
    expect(() => parseBackupPayload(JSON.stringify({ app: "other", data: {} }))).toThrow(
      /Comtus backup/,
    );
  });

  it("accepts a Comtus payload", () => {
    const payload = parseBackupPayload(
      JSON.stringify({ app: "comtus", data: { notebooks: [] } }),
    );
    expect(payload.app).toBe("comtus");
  });

  it.each([
    { app: "comtus", data: [] },
    { app: "comtus", schema: 99, data: {} },
    { app: "comtus", data: { notebooks: "bad" } },
    { app: "comtus", data: { notebooks: [null] } },
    { app: "comtus", data: { notebooks: [{ id: "n", name: {}, createdAt: 1, updatedAt: 1 }] } },
    { app: "comtus", data: { notebooks: [{ id: "n", name: "N", createdAt: 1, updatedAt: 1 }, { id: "n", name: "N", createdAt: 1, updatedAt: 1 }] } },
    { app: "comtus", data: { generations: [{ id: "g", notebookId: "n", kind: "flashcards", title: "G", createdAt: 1, payload: { cards: {} } }] } },
  ])("rejects malformed backup data before it reaches storage", (payload) => {
    expect(() => parseBackupPayload(JSON.stringify(payload))).toThrow();
  });
});
