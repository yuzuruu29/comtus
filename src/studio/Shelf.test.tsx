import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { createNotebook, db } from "../lib/db";
import Shelf from "./Shelf";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

vi.mock("./SettingsModal", () => ({
  default: ({ open, initialTab }: { open: boolean; initialTab: string }) =>
    open ? <div role="dialog" aria-label={`Settings: ${initialTab}`} /> : null,
}));
vi.mock("./DeskShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

afterEach(async () => {
  cleanup();
  sessionStorage.clear();
  await db.notebooks.clear();
  await db.sources.clear();
});

describe("Shelf", () => {
  it("explains the notebook flow and lets someone create before connecting a model", async () => {
    const onOpen = vi.fn();
    render(
      <MemoryRouter>
        <Shelf onOpen={onOpen} needsKey />
      </MemoryRouter>,
    );

    const steps = await screen.findByRole("list", { name: "How a notebook works" });
    expect(within(steps).getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "Add your sources", "Talk it through", "Make it stick",
    ]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New notebook" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Continue studying" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New notebook" }));
    fireEvent.change(screen.getByLabelText("Notebook name"), { target: { value: "  Pharmacology  " } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onOpen).toHaveBeenCalledOnce());
    expect((await db.notebooks.get(onOpen.mock.calls[0][0]))?.name).toBe("Pharmacology");
  });

  it("opens an exported notebook file and reports a file it can't read", async () => {
    const onOpen = vi.fn();
    render(<MemoryRouter><Shelf onOpen={onOpen} needsKey /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Have a notebook file? Open it" })).toBeInTheDocument();

    const exported = JSON.stringify({
      app: "comtus",
      schema: 2,
      scope: "notebook",
      data: { notebooks: [{ id: "shared-nb", name: "Shared notes", createdAt: 1, updatedAt: 1 }] },
    });
    const input = screen.getByLabelText("Notebook file");
    fireEvent.change(input, { target: { files: [new File([exported], "shared.json", { type: "application/json" })] } });
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith("shared-nb"));
    expect((await db.notebooks.get("shared-nb"))?.name).toBe("Shared notes");

    fireEvent.change(input, { target: { files: [new File(["not json"], "broken.json")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("That file isn't valid JSON.");
  });

  it("opens model settings only when requested", async () => {
    render(<MemoryRouter><Shelf onOpen={() => {}} needsKey /></MemoryRouter>);

    await screen.findByRole("button", { name: "New notebook" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect a model" }));
    expect(screen.getByRole("dialog", { name: "Settings: models" })).toBeInTheDocument();
  });

  it("resumes real recent work and preserves search, source counts, and list view", async () => {
    const older = await createNotebook("Anatomy");
    const latest = await createNotebook("Pharmacology");
    await db.notebooks.update(older.id, { updatedAt: Date.now() - 60_000 });
    await db.sources.add({
      id: "lecture", notebookId: latest.id, title: "Lecture notes", kind: "txt",
      content: "Study notes", chars: 11, tokens: 3, addedAt: Date.now(),
    });
    const onOpen = vi.fn();
    render(<MemoryRouter><Shelf onOpen={onOpen} needsKey={false} /></MemoryRouter>);

    const collection = await screen.findByRole("list", { name: "Notebooks" });
    expect(within(collection).getAllByRole("button", { name: /^Open / }).map((button) => button.getAttribute("aria-label")))
      .toEqual(["Open Pharmacology", "Open Anatomy"]);
    expect(within(screen.getByRole("region", { name: "Continue studying" })).getByText("1 source")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue studying" }));
    expect(onOpen).toHaveBeenCalledWith(latest.id);

    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    expect(collection).toHaveAttribute("data-view", "list");
    fireEvent.change(screen.getByRole("textbox", { name: "Search notebooks" }), { target: { value: " anATomy " } });
    expect(screen.queryByRole("button", { name: "Open Pharmacology" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Anatomy" }));
    expect(onOpen).toHaveBeenLastCalledWith(older.id);

    fireEvent.change(screen.getByRole("textbox", { name: "Search notebooks" }), { target: { value: "No such subject" } });
    expect(screen.getByText("No notebooks found")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear search" })[0]);
    expect(screen.getByRole("button", { name: "Open Pharmacology" })).toBeInTheDocument();
  });

  it("keeps notebook actions separate from opening a notebook", async () => {
    const notebook = await createNotebook("Anatomy");
    const onOpen = vi.fn();
    render(<MemoryRouter><Shelf onOpen={onOpen} needsKey={false} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Notebook options for Anatomy" }));
    expect(screen.getByRole("menuitem", { name: "Export" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Notebook name"), { target: { value: "Human anatomy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Notebook options for Human anatomy" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    await screen.findByRole("list", { name: "How a notebook works" });
    expect(await db.notebooks.get(notebook.id)).toBeUndefined();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
