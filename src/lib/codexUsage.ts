import type { CodexUsage, CodexUsageWindow, ProviderId } from "./types";

export const CODEX_USAGE_HEADERS = [
  "x-codex-primary-used-percent",
  "x-codex-primary-window-minutes",
  "x-codex-primary-reset-at",
  "x-codex-secondary-used-percent",
  "x-codex-secondary-window-minutes",
  "x-codex-secondary-reset-at",
] as const;

export function usageResetCaption(
  resetsAt: number,
  now: number,
  windowMinutes = 0,
): string {
  if (!(resetsAt > 0)) {
    if (windowMinutes >= 24 * 60) {
      const days = Math.round(windowMinutes / (24 * 60));
      return `${days}d window`;
    }
    if (windowMinutes >= 60) {
      const hours = Math.round(windowMinutes / 60);
      return `${hours}h window`;
    }
    if (windowMinutes > 0) return `${Math.round(windowMinutes)}m window`;
    return "plan window";
  }
  if (resetsAt <= now) return "resets shortly";
  const minutes = Math.max(1, Math.round((resetsAt - now) / 60_000));
  if (minutes < 60) return `resets in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `resets in ${hours}h`;
  return `resets ${new Date(resetsAt).toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function classifyCodexWindow(windowMinutes: number): "fiveHour" | "weekly" {
  return windowMinutes >= 5 * 24 * 60 ? "weekly" : "fiveHour";
}

export function codexWindowLabel(windowMinutes: number, slot: "fiveHour" | "weekly"): string {
  if (slot === "weekly") {
    if (windowMinutes >= 6.5 * 24 * 60 && windowMinutes <= 8 * 24 * 60) return "Weekly";
    if (windowMinutes >= 24 * 60) return `${Math.round(windowMinutes / (24 * 60))}-day`;
    return "Weekly";
  }
  if (windowMinutes >= 270 && windowMinutes <= 330) return "5-hour";
  if (windowMinutes >= 60) return `${Math.round(windowMinutes / 60)}-hour`;
  if (windowMinutes > 0) return `${Math.round(windowMinutes)}m`;
  return "5-hour";
}

export function parseCodexUsageFromHeaders(headers: Headers): CodexUsage | null {
  const primary = readWindow(headers, "x-codex-primary");
  const secondary = readWindow(headers, "x-codex-secondary");
  if (!primary && !secondary) return null;
  return assignCodexWindows(primary, secondary);
}

export function assignCodexWindows(
  primary: CodexUsageWindow | null,
  secondary: CodexUsageWindow | null,
): CodexUsage {
  const listed = [primary, secondary].filter((w): w is CodexUsageWindow => Boolean(w));
  let fiveHour: CodexUsageWindow | null = null;
  let weekly: CodexUsageWindow | null = null;
  for (const window of listed) {
    if (classifyCodexWindow(window.windowMinutes) === "weekly") weekly = window;
    else fiveHour = window;
  }
  if (primary && secondary && !weekly) {
    const shorter = primary.windowMinutes <= secondary.windowMinutes ? primary : secondary;
    const longer = shorter === primary ? secondary : primary;
    fiveHour = shorter;
    weekly = longer;
  }
  return { fiveHour, weekly };
}

export function normalizeStoredCodexUsage(raw: unknown): CodexUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if ("fiveHour" in value || "weekly" in value) {
    return {
      fiveHour: asWindow(value.fiveHour),
      weekly: asWindow(value.weekly),
    };
  }
  if (typeof value.usedPercent === "number") {
    const window: CodexUsageWindow = {
      usedPercent: value.usedPercent,
      windowMinutes: Number(value.windowMinutes) || 0,
      resetsAt: Number(value.resetsAt) || 0,
    };
    return classifyCodexWindow(window.windowMinutes) === "weekly"
      ? { fiveHour: null, weekly: window }
      : { fiveHour: window, weekly: null };
  }
  return null;
}

export type UsageMeterTone = "ok" | "warn" | "limit";

export type UsageLimitRow = {
  id: "fiveHour" | "weekly" | "hosted";
  label: string;
  usedPercent: number;
  caption: string;
  tone: UsageMeterTone;
};

export function usageLimitRows({
  provider,
  codexUsage,
  isPro,
  tokenBalance,
  tokensUsed,
  now = Date.now(),
}: {
  provider: ProviderId;
  codexUsage: CodexUsage | null;
  isPro: boolean;
  tokenBalance: number;
  tokensUsed: number;
  now?: number;
}): UsageLimitRow[] {
  if (provider === "codex") {
    return [
      rowFromWindow("fiveHour", "5-hour", codexUsage?.fiveHour, now),
      rowFromWindow("weekly", "Weekly", codexUsage?.weekly, now),
    ];
  }
  if (isPro && tokenBalance > 0) {
    const usedPercent = clampPercent((tokensUsed / tokenBalance) * 100);
    const remaining = Math.max(0, Math.round(tokenBalance - tokensUsed));
    return [
      {
        id: "hosted",
        label: "Hosted requests",
        usedPercent,
        caption: `${remaining} left`,
        tone: toneFor(usedPercent),
      },
    ];
  }
  return [];
}

function rowFromWindow(
  id: "fiveHour" | "weekly",
  fallbackLabel: string,
  window: CodexUsageWindow | null | undefined,
  now: number,
): UsageLimitRow {
  if (!window) {
    return {
      id,
      label: fallbackLabel,
      usedPercent: 0,
      caption: "after first reply",
      tone: "ok",
    };
  }
  const usedPercent = clampPercent(window.usedPercent);
  return {
    id,
    label: codexWindowLabel(window.windowMinutes, id),
    usedPercent,
    caption: usageResetCaption(window.resetsAt, now, window.windowMinutes),
    tone: toneFor(usedPercent),
  };
}

function readWindow(headers: Headers, prefix: string): CodexUsageWindow | null {
  const used = parseNum(headers.get(`${prefix}-used-percent`));
  if (used === undefined) return null;
  return {
    usedPercent: used,
    windowMinutes: parseNum(headers.get(`${prefix}-window-minutes`)) ?? 0,
    resetsAt: (parseNum(headers.get(`${prefix}-reset-at`)) ?? 0) * 1000,
  };
}

function asWindow(value: unknown): CodexUsageWindow | null {
  if (!value || typeof value !== "object") return null;
  const window = value as Record<string, unknown>;
  if (typeof window.usedPercent !== "number") return null;
  return {
    usedPercent: window.usedPercent,
    windowMinutes: Number(window.windowMinutes) || 0,
    resetsAt: Number(window.resetsAt) || 0,
  };
}

function parseNum(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toneFor(usedPercent: number): UsageMeterTone {
  if (usedPercent >= 95) return "limit";
  if (usedPercent >= 75) return "warn";
  return "ok";
}
