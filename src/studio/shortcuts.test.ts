import { describe, expect, it } from "vitest";
import { isSendKey, matchesShortcut, modKey, modLabel } from "./shortcuts";

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

describe("isSendKey", () => {
  const enter = (partial: Partial<KeyboardEvent> = {}) =>
    key({ key: "Enter", isComposing: false, ...partial });

  it("sends on Enter and breaks the line on Shift+Enter by default", () => {
    expect(isSendKey(enter(), "windows", "enter")).toBe(true);
    expect(isSendKey(enter({ shiftKey: true }), "windows", "enter")).toBe(false);
  });

  it("keeps plain Enter for new lines when sending takes the modifier", () => {
    expect(isSendKey(enter(), "windows", "mod-enter")).toBe(false);
    expect(isSendKey(enter({ ctrlKey: true }), "windows", "mod-enter")).toBe(true);
    expect(isSendKey(enter({ metaKey: true }), "mac", "mod-enter")).toBe(true);
    expect(isSendKey(enter({ ctrlKey: true }), "mac", "mod-enter")).toBe(false);
  });

  it("never sends the Enter that confirms an IME composition", () => {
    expect(isSendKey(enter({ isComposing: true }), "windows", "enter")).toBe(false);
    expect(isSendKey(enter({ isComposing: true, ctrlKey: true }), "windows", "mod-enter")).toBe(false);
  });
});
