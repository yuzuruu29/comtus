import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./ui";

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

describe("Modal", () => {
  it("mounts the dialog on document.body so a transformed pane cannot cover it", () => {
    const { container } = render(
      <div
        data-testid="chat-pane"
        style={{ transform: "translateY(0px)", overflow: "hidden", zIndex: 10 }}
      >
        <div data-testid="composer">Exhaustive</div>
        <Modal open onClose={() => {}} title="Quiz · 10 items">
          <button type="button">Check my solution</button>
        </Modal>
      </div>,
    );

    const dialog = screen.getByRole("dialog", { name: "Quiz · 10 items" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
    expect(screen.getByRole("button", { name: "Check my solution" })).toBeInTheDocument();
  });

  it("closes when the dimmed overlay is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Quiz · 10 items">
        <p>Item 1</p>
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close Quiz · 10 items" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
