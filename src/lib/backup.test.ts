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
});
