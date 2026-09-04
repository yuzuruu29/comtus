import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

afterEach(cleanup);

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
});
