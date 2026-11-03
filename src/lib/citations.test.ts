import { describe, expect, it } from "vitest";
import { numberTextCitations } from "./llm";
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
    const [own, web] = numberTextCitations("Per [Ch. 4] and [Web: Sodium pump].", docs).citations;
    expect(own.url).toBeUndefined();
    expect(web).toMatchObject({ sourceId: "web-1-0", url: "https://example.org/pump" });
  });

  it("leave a saved link source's address alone", () => {
    const docs = [doc("src-2", "Lecture page", { url: "https://example.org/lecture" })];
    expect(numberTextCitations("See [Lecture page].", docs).citations[0].url).toBeUndefined();
  });
});

describe("[Title] mentions", () => {
  it("become footnote numbers in first-mention order", () => {
    const docs = [doc("a", "Lecture 6 notes"), doc("b", "Chapter 4")];
    const { text, citations } = numberTextCitations(
      "Water follows solute [chapter 4]. Pumps spend ATP [Lecture 6 notes], as the chapter says [Chapter 4].",
      docs,
    );
    expect(text).toBe("Water follows solute [1]. Pumps spend ATP [2], as the chapter says [1].");
    expect(citations.map((c) => c.sourceId)).toEqual(["b", "a"]);
  });

  it("leave brackets that name no source as written", () => {
    expect(numberTextCitations("Solve for [x] in [a footnote].", [doc("a", "Chapter 4")]).text).toBe(
      "Solve for [x] in [a footnote].",
    );
  });
});
