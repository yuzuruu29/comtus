import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function toastCard() {
  return screen.getByRole("status").closest(".toast-card") as HTMLElement;
}

describe("Toast", () => {
  it("renders content while open and auto-dismisses when the fuse burns down", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Toast open onClose={onClose} durationMs={1000}>
        <span role="status">Saved.</span>
      </Toast>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <Toast open={false} onClose={onClose} durationMs={1000}>
        <span role="status">Saved.</span>
      </Toast>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("pauses the fuse while hovered and resumes on leave", () => {
    const onClose = vi.fn();
    render(
      <Toast open onClose={onClose} durationMs={1000}>
        <span role="status">Removed “Notes”.</span>
      </Toast>,
    );
    fireEvent.mouseEnter(toastCard());
    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseLeave(toastCard());
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not double-fire close after the fuse is spent", () => {
    const onClose = vi.fn();
    render(
      <Toast open onClose={onClose} durationMs={600}>
        <span role="status">Done.</span>
      </Toast>,
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
