/** On-device lamp placement. Stored beside settings, not inside them,
 *  so a drag does not rewrite the whole settings blob. */

export const LAMP_POS_KEY = "comtus-lamp-pos";
export const LAMP_DRAG_PX = 8;

export type LampPos = { left: number; top: number };

export function clampLampPos(
  left: number,
  top: number,
  box: { w: number; h: number },
  view: { w: number; h: number },
  inset: { t: number; r: number; b: number; l: number } = { t: 8, r: 8, b: 8, l: 8 },
): LampPos {
  const minL = inset.l;
  const minT = inset.t;
  const maxL = Math.max(minL, view.w - box.w - inset.r);
  const maxT = Math.max(minT, view.h - box.h - inset.b);
  return {
    left: Math.min(maxL, Math.max(minL, left)),
    top: Math.min(maxT, Math.max(minT, top)),
  };
}

export function parseLampPos(raw: unknown): LampPos | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.left !== "number" || typeof rec.top !== "number") return null;
  if (!Number.isFinite(rec.left) || !Number.isFinite(rec.top)) return null;
  return { left: rec.left, top: rec.top };
}

export function loadLampPos(): LampPos | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAMP_POS_KEY);
    if (!raw) return null;
    return parseLampPos(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveLampPos(pos: LampPos | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (!pos) localStorage.removeItem(LAMP_POS_KEY);
    else localStorage.setItem(LAMP_POS_KEY, JSON.stringify(pos));
  } catch {
    /* quota / private mode */
  }
}

export function viewportSize(): { w: number; h: number } {
  if (typeof window === "undefined") return { w: 1280, h: 800 };
  return { w: window.innerWidth, h: window.innerHeight };
}
