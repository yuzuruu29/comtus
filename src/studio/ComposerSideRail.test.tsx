import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Effort } from "../lib/types";
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

function openPicker(effort: Effort = "high", onEffortChange = vi.fn()) {
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

  it("opens a landscape slider in a popover with 4-stop ladder", () => {
    openPicker();
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    expect(slider).toHaveAttribute("aria-orientation", "horizontal");
    expect(slider).toHaveAttribute("aria-valuetext", "Deep");
    expect(slider).toHaveAttribute("aria-valuenow", "2");
    expect(slider).toHaveAttribute("aria-valuemax", "3");
  });

  it("raises effort with ArrowRight and lowers it with ArrowLeft", () => {
    const onEffortChange = openPicker("high");
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onEffortChange).toHaveBeenCalledWith("xhigh");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onEffortChange).toHaveBeenCalledWith("medium");
  });

  it("jumps to Quick on Home and Extra deep on End", () => {
    const onEffortChange = openPicker("high");
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onEffortChange).toHaveBeenCalledWith("low");
    fireEvent.keyDown(slider, { key: "End" });
    expect(onEffortChange).toHaveBeenCalledWith("xhigh");
  });

  it("selects Extra deep from the labeled tick", () => {
    const onEffortChange = openPicker("medium");
    fireEvent.click(screen.getAllByRole("button", { name: "Extra deep" })[0]!);
    expect(onEffortChange).toHaveBeenCalledWith("xhigh");
  });

  it("selects Quick from the labeled tick", () => {
    const onEffortChange = openPicker("high");
    fireEvent.click(screen.getAllByRole("button", { name: "Quick" })[0]!);
    expect(onEffortChange).toHaveBeenCalledWith("low");
  });

  it("maps a pointer press near the right of the track to Extra deep", () => {
    const onEffortChange = openPicker("medium");
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    mockTrackRect(slider);
    fireEvent.pointerDown(slider, { clientX: 96 });
    expect(onEffortChange).toHaveBeenCalledWith("xhigh");
  });

  it("maps a pointer press near the left of the track to Quick", () => {
    const onEffortChange = openPicker("medium");
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    mockTrackRect(slider);
    fireEvent.pointerDown(slider, { clientX: 4 });
    expect(onEffortChange).toHaveBeenCalledWith("low");
  });

  it("does not render a usage meter on the composer", () => {
    openPicker();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("marks the picker open and closed on the trigger via aria-expanded", () => {
    render(<ComposerSideRail effort="high" onEffortChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Thinking effort" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("turns thinking back on when a level is chosen while it is off", () => {
    const onEffortChange = vi.fn();
    const onChange = vi.fn();
    render(
      <ComposerSideRail effort="high" onEffortChange={onEffortChange} reasoning={{ enabled: false, onChange }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Thinking effort" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Balanced" })[0]!);
    expect(onEffortChange).toHaveBeenCalledWith("medium");
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
