import { describe, it, expect } from "vitest";
import { webSearchGroundingClause, webSearchUserReminder } from "./webSearchPrompt";
import type { WebSearchMeta } from "./types";

const ok: WebSearchMeta = { status: "ok", query: "jstor scholar sources", count: 5, ms: 2600 };
const empty: WebSearchMeta = { status: "empty", query: "obscure xyzzy", count: 0, ms: 800 };
const failed: WebSearchMeta = {
  status: "error",
  query: "jstor",
  count: 0,
  ms: 120,
  error: "relay 502",
};

describe("webSearchGroundingClause", () => {
  it("forbids claiming no web access when hits exist", () => {
    const text = webSearchGroundingClause(ok);
    expect(text).toMatch(/already performed this live web search/i);
    expect(text).toMatch(/Never claim you cannot access/i);
    expect(text).toMatch(/5 live page/);
  });

  it("does not claim live results when search is empty", () => {
    const text = webSearchGroundingClause(empty);
    expect(text).not.toMatch(/ACTIVE/);
    expect(text).toMatch(/no usable pages/i);
    expect(text).not.toMatch(/results below ARE fresh/i);
  });

  it("surfaces failure without claiming a successful fetch", () => {
    const text = webSearchGroundingClause(failed);
    expect(text).toMatch(/FAILED/i);
    expect(text).toMatch(/relay 502/);
    expect(text).not.toMatch(/ACTIVE/);
  });
});

describe("webSearchUserReminder", () => {
  it("puts a last-turn reminder next to the question when hits exist", () => {
    const note = webSearchUserReminder(ok);
    expect(note).toMatch(/5 page/);
    expect(note).toMatch(/Never say you cannot search/i);
  });

  it("tells the model not to invent URLs when search failed", () => {
    expect(webSearchUserReminder(failed)).toMatch(/Do not invent URLs/);
  });
});
