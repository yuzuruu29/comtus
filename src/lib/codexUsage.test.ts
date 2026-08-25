import { describe, expect, it } from "vitest";
import {
  assignCodexWindows,
  classifyCodexWindow,
  codexWindowLabel,
  normalizeStoredCodexUsage,
  parseCodexUsageFromHeaders,
  usageLimitRows,
  usageResetCaption,
} from "./codexUsage";

describe("classifyCodexWindow", () => {
  it("treats a 5-hour window as the short slot", () => {
    expect(classifyCodexWindow(300)).toBe("fiveHour");
  });

  it("treats a 7-day window as weekly", () => {
    expect(classifyCodexWindow(7 * 24 * 60)).toBe("weekly");
  });
});

describe("codexWindowLabel", () => {
  it("names the canonical Codex windows", () => {
    expect(codexWindowLabel(300, "fiveHour")).toBe("5-hour");
    expect(codexWindowLabel(10080, "weekly")).toBe("Weekly");
  });

  it("falls back to the actual duration when Codex reports a nonstandard window", () => {
    expect(codexWindowLabel(180, "fiveHour")).toBe("3-hour");
  });
});

describe("parseCodexUsageFromHeaders", () => {
  it("maps primary to 5-hour and secondary to weekly by duration", () => {
    const headers = new Headers({
      "x-codex-primary-used-percent": "42.4",
      "x-codex-primary-window-minutes": "300",
      "x-codex-primary-reset-at": "1786125600",
      "x-codex-secondary-used-percent": "18.2",
      "x-codex-secondary-window-minutes": "10080",
      "x-codex-secondary-reset-at": "1786194326",
    });
    expect(parseCodexUsageFromHeaders(headers)).toEqual({
      fiveHour: { usedPercent: 42.4, windowMinutes: 300, resetsAt: 1_786_125_600_000 },
      weekly: { usedPercent: 18.2, windowMinutes: 10080, resetsAt: 1_786_194_326_000 },
    });
  });

  it("swaps slots when the backend sends the weekly window as primary", () => {
    const usage = assignCodexWindows(
      { usedPercent: 10, windowMinutes: 10080, resetsAt: 2 },
      { usedPercent: 40, windowMinutes: 300, resetsAt: 1 },
    );
    expect(usage.fiveHour).toEqual({ usedPercent: 40, windowMinutes: 300, resetsAt: 1 });
    expect(usage.weekly).toEqual({ usedPercent: 10, windowMinutes: 10080, resetsAt: 2 });
  });

  it("returns null when no usage headers are present", () => {
    expect(parseCodexUsageFromHeaders(new Headers())).toBeNull();
  });
});

describe("normalizeStoredCodexUsage", () => {
  it("lifts the legacy single-window snapshot onto the 5-hour slot", () => {
    expect(
      normalizeStoredCodexUsage({ usedPercent: 42, windowMinutes: 300, resetsAt: 9 }),
    ).toEqual({
      fiveHour: { usedPercent: 42, windowMinutes: 300, resetsAt: 9 },
      weekly: null,
    });
  });
});

describe("usageLimitRows", () => {
  it("always shows both Codex windows, with placeholders before the first reply", () => {
    expect(
      usageLimitRows({
        provider: "codex",
        codexUsage: null,
        isPro: false,
        tokenBalance: 0,
        tokensUsed: 0,
      }),
    ).toEqual([
      { id: "fiveHour", label: "5-hour", usedPercent: 0, caption: "after first reply", tone: "ok" },
      { id: "weekly", label: "Weekly", usedPercent: 0, caption: "after first reply", tone: "ok" },
    ]);
  });

  it("renders live 5-hour and weekly percents from Codex headers", () => {
    const now = Date.parse("2026-08-26T12:00:00Z");
    const rows = usageLimitRows({
      provider: "codex",
      codexUsage: {
        fiveHour: { usedPercent: 42.4, windowMinutes: 300, resetsAt: now + 40 * 60_000 },
        weekly: { usedPercent: 18, windowMinutes: 10080, resetsAt: now + 3 * 24 * 60 * 60_000 },
      },
      isPro: false,
      tokenBalance: 0,
      tokensUsed: 0,
      now,
    });
    expect(rows[0]).toMatchObject({
      id: "fiveHour",
      label: "5-hour",
      usedPercent: 42,
      caption: "resets in 40m",
      tone: "ok",
    });
    expect(rows[1]).toMatchObject({
      id: "weekly",
      label: "Weekly",
      usedPercent: 18,
      tone: "ok",
    });
    expect(rows[1]?.caption.startsWith("resets")).toBe(true);
  });

  it("shows hosted-pass remaining when a Smarter Models plan is active", () => {
    expect(
      usageLimitRows({
        provider: "anthropic",
        codexUsage: null,
        isPro: true,
        tokenBalance: 200,
        tokensUsed: 50,
      }),
    ).toEqual([
      { id: "hosted", label: "Hosted requests", usedPercent: 25, caption: "150 left", tone: "ok" },
    ]);
  });
});

describe("usageResetCaption", () => {
  it("names an upcoming reset in minutes", () => {
    const now = Date.parse("2026-08-26T12:00:00Z");
    expect(usageResetCaption(now + 12 * 60_000, now)).toBe("resets in 12m");
  });

  it("falls back to the window length when no reset time is known", () => {
    expect(usageResetCaption(0, Date.now(), 300)).toBe("5h window");
    expect(usageResetCaption(0, Date.now(), 10080)).toBe("7d window");
  });
});
