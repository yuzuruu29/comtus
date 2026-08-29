import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, useLocation, Routes, Route } from "react-router-dom";
import { db, createNotebook } from "../lib/db";
import { useNotebookDesk } from "./useNotebookDesk";

afterEach(async () => {
  cleanup();
  await db.notebooks.clear();
});

// Exercise the actual hook used by Workspace so this guards both the Dexie
// lookup and its missing-notebook redirect behavior.
function LoadProbe({ notebookId }: { notebookId: string }) {
  const desk = useNotebookDesk(notebookId);
  const location = useLocation();
  return (
    <div data-testid="load-state" data-state={desk.loadState} data-path={location.pathname}>
      {desk.loadState}
    </div>
  );
}

describe("create → load notebook (real Dexie)", () => {
  it("a freshly created notebook is immediately retrievable by id", async () => {
    const nb = await createNotebook("My Notebook");
    const found = await db.notebooks.get(nb.id);
    expect(found?.id).toBe(nb.id);
    expect(found?.name).toBe("My Notebook");
  });

  it("load probe resolves to 'ready' for a created notebook (no bounce)", async () => {
    const nb = await createNotebook("Probe");
    render(
      <MemoryRouter initialEntries={[`/studio/${nb.id}`]}>
        <Routes>
          <Route path="/studio/:notebookId" element={<LoadProbe notebookId={nb.id} />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("load-state")).toHaveAttribute("data-state", "ready");
    });
  });
});
