/** Icon scale — the numbers behind the Phosphor `size` prop.
 *
 *  `size` is a JS prop, so it cannot read a CSS variable. The scale itself
 *  is declared in src/styles/tokens.css (--icon-xs … --icon-3xl) and
 *  mirrored here. src/styles/icon-scale.test.ts fails if the two drift.
 *
 *  The house bands: dense table 14-16, input 16-20, button 16-20, sidebar
 *  18-22, mobile navigation 22-24, feature card 24-32. Anything below 12
 *  is below the floor for a functional icon.
 *
 *  The Pixelify sprites in src/components/pixel are artwork, not interface
 *  icons, and sit outside this scale.
 */
export const ICON = {
  /** 12px — dense badge, inline hint, companion chrome. */
  xs: 12,
  /** 14px — dense table row. */
  sm: 14,
  /** 16px — input, button, toolbar. */
  md: 16,
  /** 18px — sidebar, panel header. */
  lg: 18,
  /** 20px — button, sidebar, mobile control. */
  xl: 20,
  /** 24px — mobile navigation, feature card. */
  xxl: 24,
  /** 32px — feature card, empty state. */
  xxxl: 32,
} as const;

export type IconSize = keyof typeof ICON;
