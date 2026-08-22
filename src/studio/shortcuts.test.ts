import { describe, expect, it } from "vitest";
import { matchesShortcut, modKey, modLabel } from "./shortcuts";

function key(partial: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...partial,
  } as KeyboardEvent;
}

describe("modKey", () => {
  it("uses Meta on Mac and Control elsewhere", () => {
    expect(modKey(key({ key: "k", metaKey: true }), "mac")).toBe(true);
    expect(modKey(key({ key: "k", ctrlKey: true }), "mac")).toBe(false);
    expect(modKey(key({ key: "k", ctrlKey: true }), "windows")).toBe(true);
    expect(modKey(key({ key: "k", metaKey: true }), "windows")).toBe(false);
  });
});

describe("modLabel", () => {
  it("prints the platform glyph", () => {
    expect(modLabel("mac")).toBe("⌘");
    expect(modLabel("windows")).toBe("Ctrl");
  });
});

describe("matchesShortcut", () => {
  it("matches mod+K on Windows", () => {
    expect(matchesShortcut(key({ key: "k", ctrlKey: true }), "windows", { key: "k" })).toBe(true);
  });

  it("rejects when shift is required", () => {
    expect(
      matchesShortcut(key({ key: "[", ctrlKey: true }), "windows", { key: "[", shift: true }),
    ).toBe(false);
  });
});
