import { describe, expect, it } from "vitest";
import { migrateSettings } from "./settings";

describe("migrateSettings", () => {
  it("moves a version-14 ChatGPT sign-in onto the compatible provider", () => {
    const next = migrateSettings(
      {
        provider: "codex",
        codexOAuth: { accessToken: "stale" },
        codexModel: "gpt-5.6-luna",
        compatBaseUrl: "https://openrouter.ai/api/v1",
        compatModel: "openrouter/free",
      },
      14,
    );
    expect(next.provider).toBe("openai-compatible");
    expect(next).not.toHaveProperty("codexOAuth");
    expect(next).not.toHaveProperty("codexModel");
    expect(next.compatModel).toBe("openrouter/free");
  });

  it("moves a version-14 Claude sign-in onto the compatible provider", () => {
    const next = migrateSettings(
      {
        provider: "claude-oauth",
        claudeOAuth: { accessToken: "stale" },
        anthropicKey: "sk-ant-kept",
      },
      14,
    );
    expect(next.provider).toBe("openai-compatible");
    expect(next).not.toHaveProperty("claudeOAuth");
    expect(next.anthropicKey).toBe("sk-ant-kept");
  });

  it("leaves an Anthropic key user on Anthropic", () => {
    const next = migrateSettings({ provider: "anthropic", anthropicKey: "sk-ant-mine" }, 14);
    expect(next.provider).toBe("anthropic");
    expect(next.anthropicKey).toBe("sk-ant-mine");
  });

  it("gives older settings the default send key and spacing, and drops junk", () => {
    expect(migrateSettings({}, 14)).toMatchObject({ sendKey: "enter", leading: "standard" });
    const kept = migrateSettings({ sendKey: "mod-enter", leading: "airy" }, 14);
    expect(kept).toMatchObject({ sendKey: "mod-enter", leading: "airy" });
    const junk = migrateSettings({ sendKey: "space", leading: 3 }, 14);
    expect(junk).toMatchObject({ sendKey: "enter", leading: "standard" });
    expect(migrateSettings({ anthropicModel: "claude-opus-5" }, 15)).toMatchObject({
      anthropicModel: "claude-opus-5-5",
    });
    expect(migrateSettings({ anthropicModel: "claude-sonnet-5" }, 15)).toMatchObject({
      anthropicModel: "claude-sonnet-5-5",
    });
  });
});
