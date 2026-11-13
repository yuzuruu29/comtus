import "fake-indexeddb/auto";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db";
import type { Source } from "../lib/types";
import SourceReader from "./SourceReader";
import { pointOffset } from "./readerSelection";

const content = [
  "[page 1]",
  "# Energy",
  "",
  "Mitochondria make ATP through cellular respiration.",
  "",
  "[page 2]",
  "Ribosomes build proteins from amino acids.",
].join("\n");

const source: Source = {
  id: "s1",
  notebookId: "nb1",
  title: "Cell energy",
  kind: "pdf",
  content,
  chars: content.length,
  tokens: 30,
  addedAt: 1,
  meta: { pages: 2 },
};

/** The dialog moves focus into itself shortly after opening, which would
 *  clear a selection made before it; people select after that, and so do
 *  these tests. */
async function settled() {
  await waitFor(() => expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement));
}

/** Selects [start, end) of the source inside the rendered reader. */
async function selectSource(start: number, end: number, inDialog = true) {
  if (inDialog) await settled();
  const runs = [...document.querySelectorAll<HTMLElement>("[data-at]")];
  const point = (offset: number): [Node, number] => {
    const run = runs.filter((el) => Number(el.dataset.at) <= offset).pop()!;
    return [run.firstChild!, offset - Number(run.dataset.at)];
  };
  const range = document.createRange();
  range.setStart(...point(start));
  range.setEnd(...point(end));
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
}

beforeAll(() => {
  // jsdom has no layout; the reader only needs a rectangle to anchor to.
  const rect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getBoundingClientRect = rect;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(async () => {
  await db.highlights.clear();
  await db.generations.clear();
  await db.notebooks.clear();
  await db.notebooks.put({ id: "nb1", name: "Bio", createdAt: 1, updatedAt: 1 });
});

describe("SourceReader", () => {
  it("shows the source's headings, paragraphs and page breaks", () => {
    render(<SourceReader source={source} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Energy" })).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.getByText("Mitochondria make ATP through cellular respiration.")).toBeInTheDocument();
    // Page markers are rendered as breaks, not as text.
    expect(screen.queryByText("[page 1]")).toBeNull();
  });

  it("highlights a selection and writes a margin note beside it", async () => {
    const onChanged = vi.fn();
    render(<SourceReader source={source} onClose={() => {}} onHighlightsChanged={onChanged} />);
    const start = content.indexOf("make ATP");
    await selectSource(start + 1, start + 8); // "ake ATP" grows to the whole word

    fireEvent.click(await screen.findByRole("button", { name: "Note" }));
    const note = await screen.findByLabelText("Your note");
    expect(await db.highlights.count()).toBe(1);
    expect((await db.highlights.toArray())[0].quote).toBe("make ATP");

    fireEvent.change(note, { target: { value: "ATP is the cell's energy currency" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("button", { name: /Your note: ATP is the cell's energy currency/ })).toBeInTheDocument();
    expect((await db.highlights.toArray())[0].note).toBe("ATP is the cell's energy currency");
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "make ATP" })).toHaveAttribute("data-mark");
  });

  it("sends a selected passage to chat", async () => {
    const onAsk = vi.fn();
    const onClose = vi.fn();
    render(<SourceReader source={source} onClose={onClose} onAsk={onAsk} />);
    const start = content.indexOf("Ribosomes");
    await selectSource(start, start + "Ribosomes build proteins".length);
    fireEvent.click(await screen.findByRole("button", { name: "Ask" }));
    expect(onAsk).toHaveBeenCalledWith("About this passage from “Cell energy”:\n> Ribosomes build proteins\n\n");
    expect(onClose).toHaveBeenCalled();
  });

  it("docked, sits beside the chat and stays open after asking", async () => {
    const onAsk = vi.fn();
    const onClose = vi.fn();
    render(<SourceReader docked source={source} onClose={onClose} onAsk={onAsk} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "Cell energy" })).toBeInTheDocument();
    const start = content.indexOf("Ribosomes");
    await selectSource(start, start + "Ribosomes build proteins".length, false);
    fireEvent.click(await screen.findByRole("button", { name: "Ask" }));
    expect(onAsk).toHaveBeenCalledWith("About this passage from “Cell energy”:\n> Ribosomes build proteins\n\n");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("docked, closes on Escape only while focus is inside it", async () => {
    const onClose = vi.fn();
    render(
      <>
        <input aria-label="Composer" />
        <SourceReader docked source={source} onClose={onClose} onAsk={() => {}} />
      </>,
    );
    const start = content.indexOf("Ribosomes");
    await selectSource(start, start + "Ribosomes".length, false);
    await screen.findByRole("button", { name: "Ask" });
    screen.getByLabelText("Composer").focus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    // Escape in the composer leaves the reader's selection alone too.
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();

    // Inside the reader, Escape first drops the selection, then closes.
    screen.getByRole("button", { name: "Close the reader" }).focus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Ask" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("makes a cloze card from the sentence around a selection", async () => {
    render(<SourceReader source={source} onClose={() => {}} />);
    const start = content.indexOf("ATP");
    await selectSource(start, start + 3);
    fireEvent.click(await screen.findByRole("button", { name: "Card" }));
    expect(await screen.findByText("Added a cloze card to “From your reading” in your study tools.")).toBeInTheDocument();
    const deck = await db.generations.get("reading-nb1");
    expect(deck?.title).toBe("From your reading");
    expect((deck?.payload as { cards: { front: string; back: string }[] }).cards).toEqual([
      expect.objectContaining({
        front: "Mitochondria make {{c1::ATP}} through cellular respiration.",
        back: "From “Cell energy”, page 1.",
      }),
    ]);

    // The same card twice is not added twice.
    await selectSource(start, start + 3);
    fireEvent.click(await screen.findByRole("button", { name: "Card" }));
    expect(await screen.findByText("That card is already in “From your reading”.")).toBeInTheDocument();
  });

  it("lists highlights with their pages and saves them as a note", async () => {
    await db.highlights.add({
      id: "h1",
      notebookId: "nb1",
      sourceId: "s1",
      start: content.indexOf("Ribosomes"),
      end: content.indexOf("Ribosomes") + 9,
      quote: "Ribosomes",
      note: "Protein factories",
      createdAt: 1,
      updatedAt: 1,
    });
    render(<SourceReader source={source} onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Highlights (1)" }));
    expect(screen.getByText("Protein factories")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save as a note" }));
    await waitFor(async () => expect(await db.generations.count()).toBe(1));
    const [saved] = await db.generations.toArray();
    expect(saved.title).toBe("Highlights · Cell energy");
    expect((saved.payload as { content: string }).content).toContain("> Ribosomes (p. 2)\n\nProtein factories");
    expect(await screen.findByText("Saved “Highlights · Cell energy” to your notes.")).toBeInTheDocument();
  });
});

describe("pointOffset", () => {
  it("maps text and element points back to source offsets", () => {
    document.body.innerHTML =
      '<p id="p"><span data-at="10">Hello </span><mark data-at="16">world</mark></p><p id="q"><span data-at="30">Next</span></p>';
    const hello = document.querySelector('[data-at="10"]')!.firstChild!;
    expect(pointOffset(hello, 3)).toBe(13);
    const p = document.getElementById("p")!;
    expect(pointOffset(p, 1)).toBe(16); // before the mark
    expect(pointOffset(p, 2)).toBe(21); // after the last run
    expect(pointOffset(document.getElementById("q")!, 0)).toBe(30);
    expect(pointOffset(document.body, 0)).toBe(10);
  });
});
