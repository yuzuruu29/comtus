import type { Platform } from "../lib/desktop";

/** True when the platform modifier is held: Meta on Mac, Control elsewhere. */
export function modKey(e: Pick<KeyboardEvent, "metaKey" | "ctrlKey">, platform: Platform): boolean {
  return platform === "mac" ? e.metaKey : e.ctrlKey;
}

export function modLabel(platform: Platform): string {
  return platform === "mac" ? "⌘" : "Ctrl";
}

export type ShortcutMatch = {
  key: string;
  shift?: boolean;
  /** Digits "1" | "2" | "3" or named keys. */
};

export function matchesShortcut(
  e: KeyboardEvent,
  platform: Platform,
  match: ShortcutMatch,
): boolean {
  if (!modKey(e, platform)) return false;
  if (Boolean(match.shift) !== e.shiftKey) return false;
  return e.key === match.key || e.key.toLowerCase() === match.key.toLowerCase();
}
