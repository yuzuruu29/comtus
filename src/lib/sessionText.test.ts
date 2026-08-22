import { describe, expect, it } from "vitest";
import { DEFAULT_SESSION_TITLE, deriveSessionTitle } from "./sessionText";

describe("deriveSessionTitle", () => {
  it("uses a short question verbatim", () => {
    expect(deriveSessionTitle("What is mitosis?")).toBe("What is mitosis?");
  });

  it("collapses whitespace and trims", () => {
    expect(deriveSessionTitle("  Explain   \n photosynthesis  ")).toBe(
      "Explain photosynthesis",
    );
  });

  it("truncates long questions on a word boundary with an ellipsis", () => {
    const title = deriveSessionTitle(
      "Compare and contrast the three main theories of economic growth covered in chapter four",
    );
    expect(title.length).toBeLessThanOrEqual(49); // 48 chars + ellipsis
    expect(title.endsWith("…")).toBe(true);
    expect(title.endsWith(" ")).toBe(false);
  });

  it("returns empty for blank input so callers keep their placeholder", () => {
    expect(deriveSessionTitle("   ")).toBe("");
  });
});

describe("DEFAULT_SESSION_TITLE", () => {
  it("names the migrated thread", () => {
    expect(DEFAULT_SESSION_TITLE).toBe("Main chat");
  });
});
