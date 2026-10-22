import { describe, expect, it } from "vitest";
import { extractTextCitations } from "./llm";
import type { GroundingDoc } from "./retrieval";

const doc = (id: string, title: string, meta?: GroundingDoc["source"]["meta"]): GroundingDoc => ({
  source: { id, notebookId: "nb", title, kind: "url", content: "", chars: 0, tokens: 0, addedAt: 0, meta },
  text: "",
});

describe("citations to web search results", () => {
  it("keep the page address so the citation can open it", () => {
    const docs = [
      doc("src-1", "Ch. 4"),
      doc("web-1-0", "Web: Sodium pump", { url: "https://example.org/pump", origin: "web-search" }),
    ];
    const [own, web] = extractTextCitations("Per [Ch. 4] and [Web: Sodium pump].", docs);
    expect(own.url).toBeUndefined();
    expect(web).toMatchObject({ sourceId: "web-1-0", url: "https://example.org/pump" });
  });

  it("leave a saved link source's address alone", () => {
    const docs = [doc("src-2", "Lecture page", { url: "https://example.org/lecture" })];
    expect(extractTextCitations("See [Lecture page].", docs)[0].url).toBeUndefined();
  });
});
