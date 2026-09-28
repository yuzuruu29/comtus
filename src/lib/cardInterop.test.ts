import { describe, expect, it } from "vitest";
import {
  ankiHtmlToMarkdown,
  deckToAnki,
  deckToCsv,
  markdownToAnkiHtml,
  parseCardFile,
  parseDelimited,
} from "./cardInterop";
import type { Flashcard } from "./types";

const cards: Flashcard[] = [
  { id: "c0", front: "What does **ATP synthase** do?", back: "Makes ATP.\n\n- uses the proton gradient\n- in the inner membrane", topic: "Cell biology" },
  { id: "c1", front: "The derivative of $x^2$ is {{c1::$2x$}}.", back: "Power rule", topic: "Calculus" },
  { id: "c2", front: 'Say "hi"\tthere', back: "A <tag> & more" },
];

describe("Markdown to Anki HTML", () => {
  it("converts emphasis, lists, line breaks and math", () => {
    expect(markdownToAnkiHtml("A **bold** and *italic* `code` word")).toBe(
      "A <b>bold</b> and <i>italic</i> <code>code</code> word",
    );
    expect(markdownToAnkiHtml("Makes ATP.\n\n- one\n- two\nAfter")).toBe(
      "Makes ATP.<ul><li>one</li><li>two</li></ul>After",
    );
    expect(markdownToAnkiHtml("Area $\\pi r^2$ and $$\\int_0^1 x\\,dx$$")).toBe(
      "Area \\(\\pi r^2\\) and \\[\\int_0^1 x\\,dx\\]",
    );
    expect(markdownToAnkiHtml("It costs $5 and $10")).toBe("It costs $5 and $10");
    expect(markdownToAnkiHtml("a < b & c")).toBe("a &lt; b &amp; c");
  });
});

describe("deck export", () => {
  it("writes Anki's plain-text format with notetype, deck and tags", () => {
    const text = deckToAnki(cards, "Bio\tdeck");
    const lines = text.trimEnd().split("\n");
    expect(lines.slice(0, 5)).toEqual([
      "#separator:tab",
      "#html:true",
      "#notetype column:1",
      "#deck:Bio deck",
      "#tags column:4",
    ]);
    expect(lines[5].split("\t")).toEqual([
      "Basic",
      "What does <b>ATP synthase</b> do?",
      "Makes ATP.<ul><li>uses the proton gradient</li><li>in the inner membrane</li></ul>",
      "comtus::Cell_biology",
    ]);
    expect(lines[6].split("\t")[0]).toBe("Cloze");
    expect(lines[6]).toContain("{{c1::\\(2x\\)}}");
    // A tab inside a field is quoted, a quote is doubled.
    expect(lines[7]).toBe('Basic\t"Say &quot;hi&quot;\tthere"\tA &lt;tag&gt; &amp; more\tcomtus');
  });

  it("writes a spreadsheet-friendly CSV", () => {
    const csv = deckToCsv(cards.slice(0, 1));
    expect(csv.startsWith("﻿Front,Back,Topic\r\n")).toBe(true);
    expect(csv).toContain('"Makes ATP.\n\n- uses the proton gradient\n- in the inner membrane",Cell biology');
  });

  it("round-trips through its own import", () => {
    const back = parseCardFile(deckToAnki(cards, "Bio"), "export.txt");
    expect(back.title).toBe("Bio");
    expect(back.cards.map((c) => [c.front, c.topic])).toEqual([
      ["What does **ATP synthase** do?", "Cell biology"],
      ["The derivative of $x^2$ is {{c1::$2x$}}.", "Calculus"],
      ['Say "hi"\tthere', undefined],
    ]);
    expect(back.cards[0].back).toBe("Makes ATP.\n- uses the proton gradient\n- in the inner membrane");
    const csvBack = parseCardFile(deckToCsv(cards), "Bio deck.csv");
    expect(csvBack.cards.map((c) => c.front)).toEqual(cards.map((c) => c.front));
    expect(csvBack.cards[0].back).toBe(cards[0].back);
    expect(csvBack.title).toBe("Bio deck");
  });
});

describe("parsing delimited text", () => {
  it("honours quotes, doubled quotes and line breaks inside fields", () => {
    expect(parseDelimited('a,"b, c","say ""hi""\nagain"\r\nd,e,f\n', ",")).toEqual([
      ["a", "b, c", 'say "hi"\nagain'],
      ["d", "e", "f"],
    ]);
  });
});

describe("importing decks", () => {
  it("reads an Anki export with HTML, sounds and images", () => {
    const text = [
      "#separator:tab",
      "#html:true",
      "#tags column:3",
      "Mitochondria<br>function?\t<b>ATP</b> &amp; heat [sound:x.mp3]\tbio::Cell_biology marked",
      'Area of a circle\t\\(\\pi r^2\\) <img src="c.png">\tmath',
      "\tno front\t",
    ].join("\n");
    const deck = parseCardFile(text, "Biology.txt");
    expect(deck.title).toBe("Biology");
    expect(deck.cards).toEqual([
      { id: "c0", front: "Mitochondria\nfunction?", back: "**ATP** & heat", topic: "Cell biology" },
      { id: "c1", front: "Area of a circle", back: "$\\pi r^2$", topic: "math" },
    ]);
    expect(deck.skipped).toBe(1);
    expect(deck.mediaDropped).toBe(2);
  });

  it("maps spreadsheet columns by their headings", () => {
    const deck = parseCardFile("Topic;Term;Definition\nOrganelles;Ribosome;Makes proteins\n;Nucleus;Holds DNA", "sheet.csv");
    expect(deck.cards).toEqual([
      { id: "c0", front: "Ribosome", back: "Makes proteins", topic: "Organelles" },
      { id: "c1", front: "Nucleus", back: "Holds DNA" },
    ]);
  });

  it("guesses tabs in a headerless Quizlet-style export", () => {
    const deck = parseCardFile("hola\thello\nadiós\tgoodbye\n", "spanish_vocab.tsv");
    expect(deck.title).toBe("spanish vocab");
    expect(deck.cards.map((c) => [c.front, c.back])).toEqual([
      ["hola", "hello"],
      ["adiós", "goodbye"],
    ]);
  });

  it("keeps cloze notes that have no back", () => {
    const deck = parseCardFile("#notetype column:1\n#separator:tab\nCloze\tThe {{c1::Krebs}} cycle\t\n", "c.txt");
    expect(deck.cards).toEqual([{ id: "c0", front: "The {{c1::Krebs}} cycle", back: "" }]);
    expect(deck.skipped).toBe(0);
  });

  it("turns Anki HTML into readable Markdown", () => {
    expect(ankiHtmlToMarkdown("<div>One</div><div>Two&nbsp;<i>three</i></div>").text).toBe("One\nTwo *three*");
    expect(ankiHtmlToMarkdown("<ul><li>a</li><li>b</li></ul>").text).toBe("- a\n- b");
    expect(ankiHtmlToMarkdown("&#x3b1; &#946; &lt;").text).toBe("α β <");
  });
});
