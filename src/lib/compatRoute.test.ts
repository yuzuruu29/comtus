import { describe, expect, it } from "vitest";
import { compatFetchBase } from "./compatRoute";

const ORIGIN = window.location.origin;

describe("compatFetchBase", () => {
  it("relays Zen through the same-origin compat proxy, keeping path and query", () => {
    expect(compatFetchBase("https://opencode.ai/zen/v1")).toBe(
      `${ORIGIN}/api/compat/zen/zen/v1`,
    );
    expect(compatFetchBase("  https://opencode.ai/zen/v1  ")).toBe(
      `${ORIGIN}/api/compat/zen/zen/v1`,
    );
    expect(compatFetchBase("https://opencode.ai/zen/v1/models?limit=5")).toBe(
      `${ORIGIN}/api/compat/zen/zen/v1/models?limit=5`,
    );
  });

  it("relays Mistral", () => {
    expect(compatFetchBase("https://api.mistral.ai/v1")).toBe(
      `${ORIGIN}/api/compat/mistral/v1`,
    );
  });

  it("leaves known-good CORS providers direct", () => {
    expect(compatFetchBase("https://openrouter.ai/api/v1")).toBe("https://openrouter.ai/api/v1");
    expect(compatFetchBase("https://api.groq.com/openai/v1")).toBe(
      "https://api.groq.com/openai/v1",
    );
    expect(compatFetchBase("https://api.deepseek.com/v1")).toBe("https://api.deepseek.com/v1");
    expect(compatFetchBase("https://api.cerebras.ai/v1")).toBe("https://api.cerebras.ai/v1");
  });

  it("never relays local endpoints or custom URLs", () => {
    expect(compatFetchBase("http://localhost:11434/v1")).toBe("http://localhost:11434/v1");
    expect(compatFetchBase("http://127.0.0.1:1234/v1")).toBe("http://127.0.0.1:1234/v1");
    expect(compatFetchBase("https://my-box.example.com/v1")).toBe(
      "https://my-box.example.com/v1",
    );
  });

  it("passes junk through untouched rather than throwing", () => {
    expect(compatFetchBase("")).toBe("");
    expect(compatFetchBase("not a url")).toBe("not a url");
  });
});
