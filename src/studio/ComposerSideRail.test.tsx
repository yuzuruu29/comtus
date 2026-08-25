import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposerSideRail } from "./ComposerSideRail";

afterEach(() => {
  cleanup();
});

function mockTrackRect(el: HTMLElement) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 20,
    right: 100,
    width: 100,
    height: 20,
    toJSON: () => ({}),
  });
}

function openPicker(effort: "medium" | "high" | "xhigh" = "high", onEffortChange = vi.fn()) {
  render(
    <ComposerSideRail
      effort={effort}
      onEffortChange={onEffortChange}
      onOpenSettings={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Thinking effort" }));
  return onEffortChange;
}

describe("ComposerSideRail", () => {
  it("shows the current effort on a compact chip until opened", () => {
    render(<ComposerSideRail effort="high" onEffortChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Thinking effort" })).toHaveTextContent("Deep");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("opens a landscape slider in a popover", () => {
    openPicker();
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    expect(slider).toHaveAttribute("aria-orientation", "horizontal");
    expect(slider).toHaveAttribute("aria-valuetext", "Deep");
    expect(slider).toHaveAttribute("aria-valuenow", "1");
  });

  it("raises effort with ArrowRight and lowers it with ArrowLeft", () => {
    const onEffortChange = openPicker("high");
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onEffortChange).toHaveBeenCalledWith("xhigh");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onEffortChange).toHaveBeenCalledWith("medium");
  });

  it("jumps to Steady on Home and Exhaustive on End", () => {
    const onEffortChange = openPicker("high");
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onEffortChange).toHaveBeenCalledWith("medium");
    fireEvent.keyDown(slider, { key: "End" });
    expect(onEffortChange).toHaveBeenCalledWith("xhigh");
  });

  it("selects Exhaustive from the labeled tick", () => {
    const onEffortChange = openPicker("medium");
    fireEvent.click(screen.getByRole("button", { name: "Exhaustive" }));
    expect(onEffortChange).toHaveBeenCalledWith("xhigh");
  });

  it("maps a pointer press near the right of the track to Exhaustive", () => {
    const onEffortChange = openPicker("medium");
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    mockTrackRect(slider);
    fireEvent.pointerDown(slider, { clientX: 96 });
    expect(onEffortChange).toHaveBeenCalledWith("xhigh");
  });

  it("does not render a usage meter on the composer", () => {
    openPicker();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});
