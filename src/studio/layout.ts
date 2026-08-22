export type LayoutMode = "standard" | "reading" | "writing" | "focus";

export const LAYOUT_MODES: LayoutMode[] = ["standard", "reading", "writing", "focus"];

const KEY = "comtus-layout";

export function isLayoutMode(value: unknown): value is LayoutMode {
  return value === "standard" || value === "reading" || value === "writing" || value === "focus";
}

export function loadLayout(): LayoutMode {
  if (typeof localStorage === "undefined") return "standard";
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return migratePanes();
    const parsed: unknown = JSON.parse(raw);
    return isLayoutMode(parsed) ? parsed : "standard";
  } catch {
    return "standard";
  }
}

export function saveLayout(mode: LayoutMode): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(mode));
}

/** Citation jumps always need the sources spine visible. */
export function applyCitationOpen(mode: LayoutMode): LayoutMode {
  if (mode === "writing" || mode === "focus") return "reading";
  return mode;
}

export function cycleLayout(mode: LayoutMode, dir: 1 | -1): LayoutMode {
  const i = LAYOUT_MODES.indexOf(mode);
  const next = (i + dir + LAYOUT_MODES.length) % LAYOUT_MODES.length;
  return LAYOUT_MODES[next] ?? "standard";
}

export function panesFor(mode: LayoutMode): { sources: boolean; studio: boolean } {
  switch (mode) {
    case "reading":
      return { sources: true, studio: false };
    case "writing":
      return { sources: false, studio: true };
    case "focus":
      return { sources: false, studio: false };
    default:
      return { sources: true, studio: true };
  }
}

function migratePanes(): LayoutMode {
  try {
    const legacy = JSON.parse(localStorage.getItem("comtus-panes") ?? "");
    const sources = !legacy?.sources;
    const studio = !legacy?.studio;
    if (sources && studio) return "standard";
    if (sources && !studio) return "reading";
    if (!sources && studio) return "writing";
    return "focus";
  } catch {
    return "standard";
  }
}
