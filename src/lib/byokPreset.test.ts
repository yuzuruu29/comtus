import { describe, expect, it } from "vitest";
import { COMPAT_PRESETS, keyMismatch } from "./llm";

describe("bring-your-own-key presets", () => {
  it("gives every provider a model id of its own", () => {
    expect(new Set(COMPAT_PRESETS.map((preset) => preset.model)).size).toBe(COMPAT_PRESETS.length);
    expect(COMPAT_PRESETS.find((preset) => preset.id === "groq")?.model).not.toContain("/");
  });

  it("warns when a pasted key belongs to a different endpoint", () => {
    const openrouter = "https://openrouter.ai/api/v1";
    const groq = "https://api.groq.com/openai/v1";
    expect(keyMismatch(groq, "sk-or-v1-abc")).toMatch(/OpenRouter/);
    expect(keyMismatch(openrouter, "gsk_abc")).toMatch(/sk-or-v1/);
    expect(keyMismatch(openrouter, "comtus-pass-v1.abc")).toMatch(/Smarter Models/);
    expect(keyMismatch(openrouter, "sk-or-v1-abc")).toBe("");
    expect(keyMismatch(groq, "")).toBe("");
  });
});
