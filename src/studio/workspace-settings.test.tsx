import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { db } from "../lib/db";
import Workspace from "./Workspace";

// Workspace reaches pdfjs through lib/import, and pdfjs touches DOMMatrix at
// module scope, which jsdom does not provide. Nothing here parses a PDF.
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</> };
});
vi.mock("./ConsoleShell", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("./companion/DeskLife", () => ({ default: () => null }));
vi.mock("./generators/QuizFlow", () => ({ QuizConfigForm: () => null, QuizTaker: () => <p>Question 1</p> }));

// fake-indexeddb is shared across every test file in the worker, so seeded
// notebooks leak into later files and change what the shelf renders.
afterEach(async () => {
  cleanup();
  await db.notebooks.clear();
});

describe("workspace header", () => {
  it("opens the Settings dialog from the gear button", async () => {
    await db.notebooks.put({ id: "nb1", name: "Pharm", createdAt: 1, updatedAt: 1 });
    render(
      <MemoryRouter initialEntries={["/studio/nb1"]}>
        <Workspace notebookId="nb1" />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument());
  });

  it("switches between Understand, Chat and Practice, keeping the mode in the URL", async () => {
    await db.notebooks.put({ id: "nb1", name: "Pharm", createdAt: 1, updatedAt: 1 });
    function Where() {
      const { pathname, search } = useLocation();
      return <output data-testid="where">{pathname + search}</output>;
    }
    render(
      <MemoryRouter initialEntries={["/studio/nb1"]}>
        <Workspace notebookId="nb1" />
        <Where />
      </MemoryRouter>,
    );
    const modes = await screen.findByRole("group", { name: "Notebook mode" });

    fireEvent.click(within(modes).getByRole("button", { name: "Practice" }));
    expect(await screen.findByText("Practice what you read.")).toBeVisible();
    expect(screen.getByTestId("where")).toHaveTextContent("/studio/nb1?mode=practice");

    fireEvent.click(within(modes).getByRole("button", { name: "Chat" }));
    await waitFor(() => expect(screen.getByText("Practice what you read.")).not.toBeVisible());
    expect(document.getElementById("workspace-sources-pane")!.hidden).toBe(true);
    expect(screen.getByTestId("where")).toHaveTextContent("/studio/nb1?mode=chat");

    fireEvent.click(within(modes).getByRole("button", { name: "Understand" }));
    await waitFor(() => expect(document.getElementById("workspace-sources-pane")!.hidden).toBe(false));
    expect(screen.getByTestId("where").textContent).toBe("/studio/nb1");
  });

  it("opens a saved-work link to a quiz in Practice", async () => {
    await db.notebooks.put({ id: "nb1", name: "Pharm", createdAt: 1, updatedAt: 1 });
    await db.generations.put({ id: "quiz-1", notebookId: "nb1", kind: "quiz", title: "Tonicity quiz", payload: { questions: [] }, createdAt: 1 });
    function Where() {
      const { pathname, search } = useLocation();
      return <output data-testid="where">{pathname + search}</output>;
    }
    render(
      <MemoryRouter initialEntries={["/studio/nb1?work=quiz-1"]}>
        <Workspace notebookId="nb1" />
        <Where />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/studio/nb1?mode=practice"));
    expect(await screen.findByRole("heading", { name: "Tonicity quiz", level: 1 })).toBeVisible();
    await db.generations.clear();
  });
});

describe("workspace on a narrow screen", () => {
  afterEach(() => db.sources.clear());

  // The test environment's matchMedia matches nothing, so this renders the
  // mobile layout with the desktop tree still mounted behind it.
  it("opens a cited source once, not once per mounted sources pane", async () => {
    await db.notebooks.put({ id: "nb1", name: "Pharm", createdAt: 1, updatedAt: 1 });
    await db.sources.put({ id: "s1", notebookId: "nb1", title: "Lecture", kind: "txt", content: "Beta blockers slow the heart.", chars: 29, tokens: 8, addedAt: 1 });
    render(
      <MemoryRouter initialEntries={["/studio/nb1?source=s1"]}>
        <Workspace notebookId="nb1" />
      </MemoryRouter>,
    );
    await screen.findByRole("dialog", { name: "Lecture" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getAllByRole("dialog", { name: "Lecture" })).toHaveLength(1);
  });
});

describe("workspace on a wide desk", () => {
  // Every min-width query matches, so the source reader docks beside the chat.
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
    );
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.sources.clear();
  });

  function GoTo({ to }: { to: string }) {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate(to)}>Go</button>;
  }

  async function openDocked(initial: string) {
    await db.notebooks.put({ id: "nb1", name: "Pharm", createdAt: 1, updatedAt: 1 });
    await db.sources.put({ id: "s1", notebookId: "nb1", title: "Lecture", kind: "txt", content: "Beta blockers slow the heart.", chars: 29, tokens: 8, addedAt: 1 });
    render(
      <MemoryRouter initialEntries={[initial]}>
        <GoTo to="/studio/nb1?work=deck-1" />
        <Workspace notebookId="nb1" />
      </MemoryRouter>,
    );
    await screen.findByRole("region", { name: "Lecture" });
  }

  it("keeps the study tools mounted while the reader borrows their column", async () => {
    await db.notebooks.put({ id: "nb1", name: "Pharm", createdAt: 1, updatedAt: 1 });
    await db.sources.put({ id: "s1", notebookId: "nb1", title: "Lecture", kind: "txt", content: "Beta blockers slow the heart.", chars: 29, tokens: 8, addedAt: 1 });
    render(
      <MemoryRouter initialEntries={["/studio/nb1"]}>
        <Workspace notebookId="nb1" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.getElementById("workspace-studio-content")).not.toBeNull());
    const tools = document.getElementById("workspace-studio-content")!;
    await waitFor(() => expect(document.getElementById("workspace-sources-content")).not.toBeNull());
    fireEvent.click(await within(document.getElementById("workspace-sources-content")!).findByRole("button", { name: /^Lecture/ }));
    await screen.findByRole("region", { name: "Lecture" });
    // The same element, so an unsaved note inside it survives.
    expect(document.getElementById("workspace-studio-content")).toBe(tools);
    expect(tools.hidden).toBe(true);
  });

  it("brings the study tools back for a saved-work link while reading", async () => {
    await openDocked("/studio/nb1?source=s1");
    expect(document.getElementById("workspace-studio-content")!.hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(document.getElementById("workspace-studio-content")!.hidden).toBe(false));
    expect(screen.getByRole("region", { name: "Lecture" })).toBeInTheDocument();
  });
});
