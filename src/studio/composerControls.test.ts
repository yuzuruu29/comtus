import { describe, expect, it } from "vitest";
import { effortToStep, stepFromTrackX, stepToEffort } from "./composerControls";

describe("effortToStep / stepToEffort", () => {
  it("maps Low to step 0 and back", () => {
    expect(effortToStep("low")).toBe(0);
    expect(stepToEffort(0)).toBe("low");
  });

  it("maps Medium to step 1 and back", () => {
    expect(effortToStep("medium")).toBe(1);
    expect(stepToEffort(1)).toBe("medium");
  });

  it("maps High to step 2 and back", () => {
    expect(effortToStep("high")).toBe(2);
    expect(stepToEffort(2)).toBe("high");
  });

  it("maps Extra High to step 3 and back", () => {
    expect(effortToStep("xhigh")).toBe(3);
    expect(stepToEffort(3)).toBe("xhigh");
  });

  it("clamps out-of-range steps onto the ladder", () => {
    expect(stepToEffort(-4)).toBe("low");
    expect(stepToEffort(9)).toBe("xhigh");
    expect(stepToEffort(2.6)).toBe("xhigh");
  });
});

describe("stepFromTrackX", () => {
  it("treats the left of the track as Low", () => {
    expect(stepFromTrackX({ clientX: 4, left: 0, width: 100 })).toBe(0);
  });

  it("treats the right of the track as Extra High", () => {
    expect(stepFromTrackX({ clientX: 96, left: 0, width: 100 })).toBe(3);
  });

  it("treats the one-third mark of the track as Medium", () => {
    expect(stepFromTrackX({ clientX: 37, left: 0, width: 100 })).toBe(1);
  });

  it("treats the two-third mark of the track as High", () => {
    expect(stepFromTrackX({ clientX: 63, left: 0, width: 100 })).toBe(2);
  });

  it("returns the default step when the track has no width", () => {
    expect(stepFromTrackX({ clientX: 0, left: 0, width: 0 })).toBe(2);
  });
});
