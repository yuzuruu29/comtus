import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StudioApp from "./StudioApp";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

vi.mock("./SettingsModal", () => ({ default: () => null }));
vi.mock("./DeskShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./ConsoleShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./companion/MilestonesButton", () => ({ default: () => null }));
vi.mock("./Titlebar", () => ({ default: () => null }));
vi.mock("../desk/DeskApp", () => ({ default: () => null }));
vi.mock("./Workspace", () => ({
  default: () => <div data-testid="workspace">Workspace</div>,
}));

// Production bug: client navigate updates the URL but useParams on the
// optional /studio/:notebookId? route stays empty until a full refresh.
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({}),
  };
});

afterEach(() => {
  cleanup();
});

describe("studio path vs stale params", () => {
  it("opens the workspace from the pathname when useParams has no notebookId", () => {
    render(
      <MemoryRouter initialEntries={["/studio/mtimvl76-kffywfn"]}>
        <Routes>
          <Route path="/studio" element={<StudioApp />} />
          <Route path="/studio/:notebookId" element={<StudioApp />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("workspace")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create new" })).not.toBeInTheDocument();
  });
});
