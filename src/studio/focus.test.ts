import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOCUS_CHANGED_EVENT,
  loadFocus,
  pruneFocus,
  saveFocus,
  subscribeFocus,
} from "./focus";

describe("focus helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads null when no focus is stored", () => {
    expect(loadFocus("nb-1")).toBeNull();
  });

  it("saves and loads explicit focus lists", () => {
    saveFocus("nb-1", ["src-1", "src-2"]);
    expect(loadFocus("nb-1")).toEqual(["src-1", "src-2"]);
  });

  it("stores empty list when 0 sources are focused", () => {
    saveFocus("nb-1", []);
    expect(loadFocus("nb-1")).toEqual([]);
  });

  it("clears storage when null is saved", () => {
    saveFocus("nb-1", ["src-1"]);
    saveFocus("nb-1", null);
    expect(loadFocus("nb-1")).toBeNull();
  });

  it("dispatches comtus:focus-changed event on save", () => {
    const handler = vi.fn();
    window.addEventListener(FOCUS_CHANGED_EVENT, handler);

    saveFocus("nb-1", ["src-1"]);

    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ notebookId: "nb-1", ids: ["src-1"] });

    window.removeEventListener(FOCUS_CHANGED_EVENT, handler);
  });

  it("subscribeFocus notifies listener of notebook focus changes", () => {
    const callback = vi.fn();
    const unsub = subscribeFocus("nb-1", callback);

    saveFocus("nb-2", ["src-other"]);
    expect(callback).not.toHaveBeenCalled();

    saveFocus("nb-1", ["src-1"]);
    expect(callback).toHaveBeenCalledWith(["src-1"]);

    unsub();
    saveFocus("nb-1", ["src-2"]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("pruneFocus removes deleted source IDs from stored focus", () => {
    saveFocus("nb-1", ["src-1", "src-deleted", "src-2"]);
    const pruned = pruneFocus("nb-1", ["src-1", "src-2"]);
    expect(pruned).toEqual(["src-1", "src-2"]);
    expect(loadFocus("nb-1")).toEqual(["src-1", "src-2"]);
  });

  it("pruneFocus leaves null untouched", () => {
    expect(pruneFocus("nb-1", ["src-1"])).toBeNull();
  });
});
