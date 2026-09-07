import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import StudioApp from "./StudioApp";

// Motion uses rAF/springs that jsdom can't settle — pass AnimatePresence
// through and let the real motion primitives render as no-ops.
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

// Heavy studio chrome that isn't part of the create-notebook path.
vi.mock("./SettingsModal", () => ({ default: () => null }));
vi.mock("./DeskShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./Titlebar", () => ({ default: () => null }));
vi.mock("../desk/DeskApp", () => ({ default: () => null }));

// We assert navigation by confirming Workspace mounts.
vi.mock("./Workspace", () => ({
  default: () => <div data-testid="workspace">Workspace</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

afterEach(() => {
  cleanup();
});

describe("notebook create → studio navigation", () => {
  it("navigates to /studio/:id after creating a notebook", async () => {
    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <Routes>
          <Route path="/studio" element={<StudioApp />} />
          <Route path="/studio/:notebookId" element={<StudioApp />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );

    // Shelf (no id, no notebooks yet) renders its empty-state create action.
    expect(await screen.findByRole("button", { name: "New notebook" })).toBeInTheDocument();

    // Open the create dialog.
    fireEvent.click(screen.getByRole("button", { name: "New notebook" }));

    // Type a name and submit.
    fireEvent.change(screen.getByPlaceholderText("Name this notebook"), {
      target: { value: "My first notebook" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    // The router should navigate to /studio/<id> and mount Workspace.
    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toMatch(/^\/studio\/.+/);
    });
    expect(screen.getByTestId("workspace")).toBeInTheDocument();
  }, 20000);
});
