/**
 * Comtus Mobile — 16-Color Cozy Pixel Bookshop Master Palette
 * 
 * Single source of truth for color tokens, semantic mapping, and styling helpers
 * across the Comtus React Native / Android application.
 */

export const pixelColors = {
  // Deep base
  pxVoid: '#080B12',       // Deepest shadow, recessed backgrounds, inset bevels
  pxGround: '#0F1420',     // Warm midnight ink, page ground
  pxSurface: '#171F32',    // Raised bookshop surface, cards, pane canvas
  pxRaised: '#222C44',     // Elevated tiles, active states, pressed cards
  pxBorder: '#33405F',     // 16-bit bevel borders, dividers, frame outlines

  // Warmth & Leather
  pxLeather: '#4A2E1B',    // Book-spine brown, warm wood trim, binding accents

  // Brass & Lamplight Gold
  pxBrassDeep: '#B88428',  // Antiqued brass edge, active borders, pressed states
  pxBrass: '#E3B04B',      // Signature warm lamplight gold, primary focus/accent
  pxBrassLight: '#F7D486', // Flame highlight, glowing filaments, top bevel rim

  // Ink & Parchment
  pxParchment: '#E8DEC8',  // Aged scholar parchment, secondary light surface
  pxInk: '#F5F0E6',        // Primary high-contrast text, crisp headers
  pxMuted: '#9099B0',      // Muted labels, metadata, secondary captions

  // Accent & Functional Gems
  pxMoon: '#6C98C2',       // Midnight blue secondary accent, thinking panel tint
  pxSage: '#78B084',       // Success indicators, correct marks, verified tags
  pxRust: '#C85848',       // Error, warnings, alerts, critical boundaries
  pxCandle: '#FF9E43',     // Amber hearth spark, milestone flares, fire streaks
} as const;

export type PixelColorKey = keyof typeof pixelColors;

/**
 * App Semantic Theme Structure
 */
export interface AppTheme {
  isDark: boolean;
  ground: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  accentDeep: string;
  accentSecondary: string;
  success: string;
  error: string;
  leather: string;
  parchment: string;
  candle: string;
  cardShadow: string;
}

export const darkTheme: AppTheme = {
  isDark: true,
  ground: pixelColors.pxGround,
  surface: pixelColors.pxSurface,
  surfaceRaised: pixelColors.pxRaised,
  border: pixelColors.pxBorder,
  borderStrong: pixelColors.pxBrassDeep,
  text: pixelColors.pxInk,
  textMuted: pixelColors.pxMuted,
  accent: pixelColors.pxBrass,
  accentLight: pixelColors.pxBrassLight,
  accentDeep: pixelColors.pxBrassDeep,
  accentSecondary: pixelColors.pxMoon,
  success: pixelColors.pxSage,
  error: pixelColors.pxRust,
  leather: pixelColors.pxLeather,
  parchment: pixelColors.pxParchment,
  candle: pixelColors.pxCandle,
  cardShadow: pixelColors.pxVoid,
};

export const lightTheme: AppTheme = {
  isDark: false,
  ground: '#F5F1E8',
  surface: '#FCFAF4',
  surfaceRaised: '#EAE4D6',
  border: '#D3CAAF',
  borderStrong: '#A5731C',
  text: '#1B2334',
  textMuted: '#5A6274',
  accent: '#A5731C',
  accentLight: '#C99236',
  accentDeep: '#79510F',
  accentSecondary: '#3D6E9E',
  success: '#4F8A5A',
  error: '#B2554A',
  leather: '#6E4528',
  parchment: '#E8DEC8',
  candle: '#E67A20',
  cardShadow: 'rgba(0, 0, 0, 0.08)',
};

/**
 * Common 16-bit bevel borders & box shadow styles
 */
export const pixelBorders = {
  thin: {
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
  },
  bevel: {
    borderWidth: 2,
    borderTopColor: pixelColors.pxBorder,
    borderLeftColor: pixelColors.pxBorder,
    borderRightColor: pixelColors.pxVoid,
    borderBottomColor: pixelColors.pxVoid,
  },
  bevelBrass: {
    borderWidth: 2,
    borderTopColor: pixelColors.pxBrassLight,
    borderLeftColor: pixelColors.pxBrassLight,
    borderRightColor: pixelColors.pxBrassDeep,
    borderBottomColor: pixelColors.pxBrassDeep,
  },
  bevelPressed: {
    borderWidth: 2,
    borderTopColor: pixelColors.pxVoid,
    borderLeftColor: pixelColors.pxVoid,
    borderRightColor: pixelColors.pxBorder,
    borderBottomColor: pixelColors.pxBorder,
  },
} as const;

/**
 * Pixel typography definitions
 */
export const pixelTypography = {
  fontMono: 'monospace',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    display: 28,
  },
} as const;
