import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

afterEach(() => {
  cleanup();
});

describe("Sheet", () => {
  it("closes when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Sources">
        <button type="button">First</button>
      </Sheet>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab focus inside the panel", () => {
    render(
      <Sheet open onClose={() => {}} title="Sources">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Sheet>,
    );
    const closeBtn = screen.getByRole("button", { name: "Close" });
    const last = screen.getByRole("button", { name: "Last" });

    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
