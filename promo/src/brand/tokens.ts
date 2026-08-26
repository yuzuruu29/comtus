/** Comtus brand tokens — Lamplight Study (from BRAND.md). */

export const colors = {
  night: "#0B0F1A",
  study: "#121828",
  shelf: "#1A2136",
  parchment: "#F2EDE3",
  faded: "#8E96AB",
  brass: "#E3B04B",
  brassPale: "#F5C869",
  brassDeep: "#A86E18",
  moon: "#7FA8C9",
  sage: "#8FBF98",
  hairline: "rgba(242,237,227,0.09)",
  lampGlow: "rgba(227,176,75,0.14)",
  coolGlow: "rgba(42,54,84,0.35)",
} as const;

/** House easings from BRAND.md — Remotion Easing.bezier counterparts. */
export const ease = {
  /** out: cubic-bezier(0.22, 1, 0.36, 1) */
  out: [0.22, 1, 0.36, 1] as const,
  /** in-out: cubic-bezier(0.76, 0, 0.24, 1) */
  inOut: [0.76, 0, 0.24, 1] as const,
};

export const siteUrl = "comtus-ai.xyz";
export const tagline = "Rough thought, polished.";
export const supporting = "Study in a warmer light.";
