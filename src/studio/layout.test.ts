import { afterEach, describe, expect, it } from "vitest";
import {
  applyCitationOpen,
  cycleLayout,
  loadLayout,
  panesFor,
  saveLayout,
  togglePane,
} from "./layout";

afterEach(() => {
  localStorage.clear();
});

describe("loadLayout", () => {
  it("defaults to standard", () => {
    expect(loadLayout()).toBe("standard");
  });

  it("round-trips persist/restore", () => {
    saveLayout("writing");
    expect(loadLayout()).toBe("writing");
  });

  it("migrates legacy comtus-panes collapsed flags", () => {
    localStorage.setItem("comtus-panes", JSON.stringify({ sources: true, studio: false }));
    expect(loadLayout()).toBe("writing");
  });
});

describe("applyCitationOpen", () => {
  it("forces reading when sources would be hidden", () => {
    expect(applyCitationOpen("writing")).toBe("reading");
    expect(applyCitationOpen("focus")).toBe("reading");
  });

  it("leaves standard and reading alone", () => {
    expect(applyCitationOpen("standard")).toBe("standard");
    expect(applyCitationOpen("reading")).toBe("reading");
  });
});

describe("panesFor", () => {
  it("maps modes to visible panes", () => {
    expect(panesFor("standard")).toEqual({ sources: true, studio: true });
    expect(panesFor("reading")).toEqual({ sources: true, studio: false });
    expect(panesFor("writing")).toEqual({ sources: false, studio: true });
    expect(panesFor("focus")).toEqual({ sources: false, studio: false });
  });
});

describe("cycleLayout", () => {
  it("walks the four modes", () => {
    expect(cycleLayout("standard", 1)).toBe("reading");
    expect(cycleLayout("focus", 1)).toBe("standard");
    expect(cycleLayout("standard", -1)).toBe("focus");
  });
});

describe("togglePane", () => {
  it("changes only the requested pane", () => {
    expect(togglePane("standard", "sources")).toBe("writing");
    expect(togglePane("reading", "sources")).toBe("focus");
    expect(togglePane("writing", "sources")).toBe("standard");
    expect(togglePane("focus", "sources")).toBe("reading");

    expect(togglePane("standard", "studio")).toBe("reading");
    expect(togglePane("reading", "studio")).toBe("standard");
    expect(togglePane("writing", "studio")).toBe("focus");
    expect(togglePane("focus", "studio")).toBe("writing");
  });

  it("switches the exclusive companion pane at compact widths", () => {
    expect(togglePane("standard", "studio", true)).toBe("writing");
    expect(togglePane("standard", "sources", true)).toBe("focus");
    expect(togglePane("reading", "studio", true)).toBe("writing");
    expect(togglePane("writing", "sources", true)).toBe("reading");
    expect(togglePane("writing", "studio", true)).toBe("focus");
    expect(togglePane("reading", "sources", true)).toBe("focus");
  });
});
