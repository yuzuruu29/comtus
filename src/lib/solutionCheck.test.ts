import { describe, expect, it } from "vitest";
import { sanitizeCheck } from "./llm";

describe("sanitizeCheck", () => {
  it("passes a well-formed verdict through", () => {
    const raw = {
      verdict: "partial",
      finalAnswerOk: false,
      transcribedAnswer: "x = 12 m",
      errors: ["Forgot to square the velocity term."],
      feedback: "The setup held; check the kinematic relation.",
    };
    expect(sanitizeCheck(raw)).toEqual(raw);
  });

  it("degrades an unknown verdict to unreadable rather than crashing", () => {
    expect(sanitizeCheck({ verdict: "maybe" }).verdict).toBe("unreadable");
    expect(sanitizeCheck(null).verdict).toBe("unreadable");
    expect(sanitizeCheck(undefined).verdict).toBe("unreadable");
  });

  it("finalAnswerOk is true only when strictly true", () => {
    expect(sanitizeCheck({ finalAnswerOk: "yes" }).finalAnswerOk).toBe(false);
    expect(sanitizeCheck({ finalAnswerOk: 1 }).finalAnswerOk).toBe(false);
    expect(sanitizeCheck({ finalAnswerOk: true }).finalAnswerOk).toBe(true);
  });

  it("filters non-string errors and coerces missing fields", () => {
    const out = sanitizeCheck({
      verdict: "correct",
      errors: ["real", 42, null, ""],
      feedback: 7,
    });
    expect(out.errors).toEqual(["real"]);
    expect(out.feedback).toBe("");
    expect(out.transcribedAnswer).toBe("");
  });
});
