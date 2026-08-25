import { describe, expect, it } from "vitest";
import { codexEffort } from "./llm";

describe("codexEffort", () => {
  it("maps Steady to medium", () => {
    expect(codexEffort("medium", true)).toBe("medium");
    expect(codexEffort("medium", false)).toBe("medium");
  });

  it("maps Deep to high", () => {
    expect(codexEffort("high", true)).toBe("high");
    expect(codexEffort("high", false)).toBe("high");
  });

  it("maps Exhaustive to xhigh when the model supports it", () => {
    expect(codexEffort("xhigh", true)).toBe("xhigh");
  });

  it("clamps Exhaustive to high for models without xhigh", () => {
    expect(codexEffort("xhigh", false)).toBe("high");
  });
});
