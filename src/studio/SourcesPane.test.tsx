import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db";
import { loadFocus } from "./focus";
import SourcesPane from "./SourcesPane";

// SourcesPane reaches pdfjs through lib/import, and pdfjs touches DOMMatrix at
// module scope, which jsdom does not provide. Nothing here parses a PDF.
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }));

const mockNativeOpen = vi.fn();
const mockNativeReadFile = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: (...args: unknown[]) => mockNativeOpen(...args) }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: (...args: unknown[]) => mockNativeReadFile(...args) }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</> };
});

afterEach(async () => {
  cleanup();
  localStorage.clear();
  mockNativeOpen.mockReset();
  mockNativeReadFile.mockReset();
  delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  await db.sources.clear();
  await db.chunks.clear();
});

function renderPane(notebookId = "nb1") {
  return render(<SourcesPane notebookId={notebookId} version={0} onChanged={() => {}} />);
}

async function addPastedSource(title: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Add source" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Paste text" }));

  const dialog = await screen.findByRole("dialog", { name: "Paste source text" });
  fireEvent.change(within(dialog).getByPlaceholderText("Lecture notes or chapter"), {
    target: { value: title },
  });
  fireEvent.change(within(dialog).getByPlaceholderText("Paste text or notes here…"), {
    target: { value: "Enough content to pass the minimum length check." },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add source" }));
  await screen.findByText(title);
}

describe("SourcesPane", () => {
  it("hands an opened source to the reader its parent hosts", async () => {
    const onView = vi.fn();
    const { rerender } = render(<SourcesPane notebookId="nb1" version={0} onChanged={() => {}} onView={onView} />);
    await addPastedSource("My Notes");

    fireEvent.click(screen.getByRole("button", { name: /^My Notes/ }));
    expect(onView).toHaveBeenCalledWith({ source: expect.objectContaining({ title: "My Notes" }) });
    expect(screen.queryByRole("dialog")).toBeNull();

    const [saved] = await db.sources.toArray();
    rerender(<SourcesPane notebookId="nb1" version={0} onChanged={() => {}} onView={onView} readingId={saved.id} />);
    expect(screen.getByRole("button", { name: /^My Notes/ })).toHaveAttribute("aria-current", "true");
  });

  it("renders the empty state copy with a single Add source control", async () => {
    renderPane();
    expect(
      await screen.findByText(
        "Add a chapter, your notes, or a link. Keep the material behind your questions within reach.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add source" })).toHaveLength(1);
  });

  it("adding a pasted text source appears in the list", async () => {
    renderPane();
    await addPastedSource("My Notes");

    expect(screen.getByText("My Notes")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Paste source text" })).not.toBeInTheDocument();
  });

  it("clicking a source opens the reader", async () => {
    renderPane();
    await addPastedSource("My Notes");

    fireEvent.click(screen.getByRole("button", { name: /^My Notes/ }));

    await waitFor(() => expect(screen.getByRole("dialog", { name: "My Notes" })).toBeInTheDocument());
  });

  it("filters the index without changing the conversation's source selection", async () => {
    renderPane();
    await addPastedSource("Ecology notes");
    await addPastedSource("Biology chapter");
    fireEvent.click(screen.getByRole("button", { name: "Toggle inclusion of Ecology notes" }));
    expect(screen.getByRole("button", { name: "Toggle inclusion of Ecology notes" })).toHaveAttribute("aria-pressed", "false");
    const selected = loadFocus("nb1");
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a source" }), { target: { value: "  BIOLOGY " } });
    expect(screen.queryByRole("button", { name: /^Ecology notes/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Biology chapter/ })).toBeInTheDocument();
    expect(loadFocus("nb1")).toEqual(selected);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a source" }), { target: { value: "unknown" } });
    expect(screen.getByRole("status")).toHaveTextContent("No sources match");
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a source" }), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Toggle inclusion of Ecology notes" })).toHaveAttribute("aria-pressed", "false");
  });

  it("an add request on a freshly mounted pane keeps the menu open once existing sources load", async () => {
    renderPane();
    await addPastedSource("My Notes");
    cleanup();

    const consumed = vi.fn();
    render(
      <SourcesPane notebookId="nb1" version={0} onChanged={() => {}} addRequest={1} onAddRequestConsumed={consumed} />,
    );

    await screen.findByText("My Notes");
    expect(await screen.findByRole("menuitem", { name: "Paste text" })).toBeInTheDocument();
    expect(consumed).toHaveBeenCalledTimes(1);
  });

  it("clicks the HTML file input when addKind is file on web", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const consumed = vi.fn();
    try {
      render(
        <SourcesPane
          notebookId="nb1"
          version={0}
          onChanged={() => {}}
          addRequest={1}
          addKind="file"
          onAddRequestConsumed={consumed}
        />,
      );
      await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
      expect(mockNativeOpen).not.toHaveBeenCalled();
      expect(consumed).toHaveBeenCalledTimes(1);
    } finally {
      clickSpy.mockRestore();
    }
  });

  it("opens the native Tauri file picker when addKind is file on desktop", async () => {
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {};
    mockNativeOpen.mockResolvedValueOnce(["C:\\docs\\chapter1.txt"]);
    mockNativeReadFile.mockResolvedValueOnce(new TextEncoder().encode("Study notes imported from Tauri desktop."));
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const consumed = vi.fn();
    try {
      render(
        <SourcesPane
          notebookId="nb1"
          version={0}
          onChanged={() => {}}
          addRequest={1}
          addKind="file"
          onAddRequestConsumed={consumed}
        />,
      );
      await waitFor(() => expect(mockNativeOpen).toHaveBeenCalledTimes(1));
      expect(clickSpy).not.toHaveBeenCalled();
      expect(consumed).toHaveBeenCalledTimes(1);
      expect(await screen.findByText("chapter1")).toBeInTheDocument();
    } finally {
      clickSpy.mockRestore();
    }
  });
});
