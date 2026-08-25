import { describe, expect, it } from "vitest";
import { effortToStep, stepFromTrackX, stepToEffort } from "./composerControls";

describe("effortToStep / stepToEffort", () => {
  it("maps Steady to the leftmost step and back", () => {
    expect(effortToStep("medium")).toBe(0);
    expect(stepToEffort(0)).toBe("medium");
  });

  it("maps Deep to the middle step and back", () => {
    expect(effortToStep("high")).toBe(1);
    expect(stepToEffort(1)).toBe("high");
  });

  it("maps Exhaustive to the rightmost step and back", () => {
    expect(effortToStep("xhigh")).toBe(2);
    expect(stepToEffort(2)).toBe("xhigh");
  });

  it("clamps out-of-range steps onto the ladder", () => {
    expect(stepToEffort(-4)).toBe("medium");
    expect(stepToEffort(9)).toBe("xhigh");
    expect(stepToEffort(1.6)).toBe("xhigh");
  });
});

describe("stepFromTrackX", () => {
  it("treats the left of the track as Steady", () => {
    expect(stepFromTrackX({ clientX: 4, left: 0, width: 100 })).toBe(0);
  });

  it("treats the right of the track as Exhaustive", () => {
    expect(stepFromTrackX({ clientX: 96, left: 0, width: 100 })).toBe(2);
  });

  it("treats the middle of the track as Deep", () => {
    expect(stepFromTrackX({ clientX: 50, left: 0, width: 100 })).toBe(1);
  });

  it("returns the middle step when the track has no width", () => {
    expect(stepFromTrackX({ clientX: 0, left: 0, width: 0 })).toBe(1);
  });
});
