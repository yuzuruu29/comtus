import { Easing } from "remotion";

/** Daylight and Lamplight values mirrored from `src/styles/tokens.css`. */
export const day = {
  ground: "#F5F1E8",
  surface: "#FCFAF4",
  raised: "#EAE4D6",
  ink: "#0B132B",
  muted: "#5A6274",
  hairline: "rgba(27,35,52,.12)",
  hairlineStrong: "rgba(27,35,52,.22)",
  brass: "#845C16",
  brassDeep: "#5B3F0F",
  brassPale: "#E3B04B",
  leather: "#4A2E1B",
  sage: "#3F6E48",
  rust: "#A04D43",
  candle: "#EF8328",
  moon: "#6B6052",
  elev: "1px 2px 0 rgba(92,61,30,.14), 0 4px 14px -3px rgba(74,46,27,.12)",
  /** A lifted sheet: the same light, thrown further. */
  lift: "2px 4px 0 rgba(92,61,30,.12), 0 28px 60px -18px rgba(74,46,27,.35)",
} as const;

export const lamp = {
  ground: "#14100C",
  surface: "#1D1712",
  raised: "#261E18",
  ink: "#F2EDE3",
  muted: "#A59A8A",
  hairline: "rgba(242,237,227,.09)",
  hairlineStrong: "rgba(242,237,227,.18)",
  brass: "#E3B04B",
  brassPale: "#F0CE8C",
  sage: "#8FBF98",
  elev: "1px 2px 0 rgba(10,7,4,.55), 0 8px 24px -4px rgba(10,7,4,.5)",
} as const;

export const font = {
  read: "Literata, Georgia, serif",
  ui: "'Instrument Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** House curves from BRAND.md: ease-out for arrivals, in-out for moves. */
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.76, 0, 0.24, 1);

export const FPS = 30;
export const SITE = "comtus-ai.xyz";
