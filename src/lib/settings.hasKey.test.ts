import { beforeEach, describe, expect, it } from "vitest";
import { isKeylessEndpoint, useSettings } from "./settings";

describe("hasKey", () => {
  beforeEach(() => {
    useSettings.getState().update({
      provider: "openai-compatible",
      compatBaseUrl: "https://openrouter.ai/api/v1",
      compatModel: "openrouter/free",
      compatKey: "",
    });
  });

  it("is false for the stock OpenRouter default with no key", () => {
    expect(useSettings.getState().hasKey()).toBe(false);
  });

  it("is true once a cloud key is set", () => {
    useSettings.getState().update({ compatKey: "sk-or-v1-abc" });
    expect(useSettings.getState().hasKey()).toBe(true);
  });

  it("is true for a keyless local model", () => {
    useSettings.getState().update({ compatBaseUrl: "http://localhost:11434/v1", compatModel: "llama3.3" });
    expect(useSettings.getState().hasKey()).toBe(true);
  });
});

describe("isKeylessEndpoint", () => {
  it("accepts local and private-network hosts only", () => {
    for (const url of ["http://localhost:1234/v1", "http://127.0.0.1:11434/v1", "http://192.168.1.20:11434/v1", "http://10.0.0.5/v1", "http://box.local:8080/v1"])
      expect(isKeylessEndpoint(url)).toBe(true);
    for (const url of ["https://openrouter.ai/api/v1", "https://api.groq.com/openai/v1", "http://172.32.0.1/v1", "not a url"])
      expect(isKeylessEndpoint(url)).toBe(false);
  });
});
