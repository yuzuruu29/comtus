import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodexUsage } from "../lib/types";

const settings = vi.hoisted(() => ({
  provider: "codex" as "codex" | "openai-compatible" | "anthropic" | "claude-oauth",
  codexUsage: null as CodexUsage | null,
  isPro: false,
  planTier: "free" as const,
  tokenBalance: 0,
  tokensUsed: 0,
}));

vi.mock("../lib/settings", () => ({
  useSettings: (selector: (s: typeof settings) => unknown) => selector(settings),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: (s: typeof settings) => unknown) => fn,
}));

import { UsageLimitsPanel } from "./UsageLimitsPanel";

afterEach(() => {
  cleanup();
  settings.provider = "codex";
  settings.codexUsage = null;
  settings.isPro = false;
  settings.planTier = "free";
  settings.tokenBalance = 0;
  settings.tokensUsed = 0;
});

describe("UsageLimitsPanel", () => {
  it("shows 5-hour and weekly Codex windows", () => {
    const now = Date.now();
    settings.codexUsage = {
      fiveHour: { usedPercent: 42, windowMinutes: 300, resetsAt: now + 40 * 60_000 },
      weekly: { usedPercent: 18, windowMinutes: 10080, resetsAt: now + 4 * 24 * 60 * 60_000 },
    };
    render(<UsageLimitsPanel />);
    expect(screen.getByRole("meter", { name: "5-hour" })).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByRole("meter", { name: "Weekly" })).toHaveAttribute("aria-valuenow", "18");
    expect(screen.getByText("5-hour")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
  });

  it("stays hidden when nothing is metered", () => {
    settings.provider = "openai-compatible";
    const { container } = render(<UsageLimitsPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
