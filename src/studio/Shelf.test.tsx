import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { db } from "../lib/db";
import Shelf from "./Shelf";

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

afterEach(async () => {
  cleanup();
  await db.notebooks.clear();
});

describe("Shelf (empty)", () => {
  it("shows exactly one New notebook control and the empty-shelf copy", async () => {
    render(
      <MemoryRouter>
        <Shelf onOpen={() => {}} needsKey={false} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Your shelf is empty.")).toBeInTheDocument();
    expect(screen.getByText("Make a notebook for the course you are studying.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New notebook" })).toHaveLength(1);
  });
});
