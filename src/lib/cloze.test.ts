import { describe, expect, it } from "vitest";
import { clozeBack, clozeFromSelection, clozeFront, clozeNumbers, clozePlain, isCloze, reviewCards } from "./cloze";

const text = "The {{c1::Krebs cycle}} runs in the {{c2::mitochondrial matrix::where?}} and {{c1::releases CO2}}.";

describe("cloze cards", () => {
  it("finds cloze numbers", () => {
    expect(isCloze(text)).toBe(true);
    expect(isCloze("No blanks here")).toBe(false);
    expect(clozeNumbers(text)).toEqual([1, 2]);
  });

  it("blanks one number at a time and shows hints", () => {
    expect(clozeFront(text, 1)).toBe("The **[…]** runs in the mitochondrial matrix and **[…]**.");
    expect(clozeFront(text, 2)).toBe("The Krebs cycle runs in the **[where?]** and releases CO2.");
  });

  it("reveals the answer in bold, followed by the extra notes", () => {
    expect(clozeBack(text, 2, "Chapter 4")).toBe(
      "The Krebs cycle runs in the **mitochondrial matrix** and releases CO2.\n\nChapter 4",
    );
    expect(clozePlain(text)).toBe("The Krebs cycle runs in the mitochondrial matrix and releases CO2.");
  });

  it("reviews each number as its own card and leaves basic cards alone", () => {
    const cards = reviewCards([
      { id: "a", front: text, back: "", topic: "Energy" },
      { id: "b", front: "Q", back: "A" },
    ]);
    expect(cards.map((c) => c.id)).toEqual(["a~c1", "a~c2", "b"]);
    expect(cards[0]).toMatchObject({ topic: "Energy", front: clozeFront(text, 1) });
  });
});

describe("cloze from a selection", () => {
  const content = "Glycolysis happens first.\nThe Krebs cycle runs in the\nmitochondrial matrix. It releases CO2.\n\n[page 2]\nNext page.";

  it("blanks the selection inside its sentence, folding printed line breaks", () => {
    const start = content.indexOf("mitochondrial");
    const end = start + "mitochondrial matrix".length;
    expect(clozeFromSelection(content, start, end)).toBe("The Krebs cycle runs in the {{c1::mitochondrial matrix}}.");
  });

  it("stops at paragraph breaks and drops page markers", () => {
    const start = content.indexOf("Next");
    expect(clozeFromSelection(content, start, start + 4)).toBe("{{c1::Next}} page.");
  });

  it("keeps braces from closing the cloze early", () => {
    const math = "The set {a, {b}} is nested.";
    const start = math.indexOf("{a");
    expect(clozeFromSelection(math, start, start + "{a, {b}}".length)).toBe("The set {{c1::{a, {b} }}} is nested.");
  });
});
