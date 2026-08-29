import { describe, it, expect } from 'vitest';
import { pixelColors, darkTheme, lightTheme, pixelBorders, pixelTypography } from './colors';

describe('Comtus Mobile Theme & Palette', () => {
  it('contains the exact 16-color master palette', () => {
    expect(pixelColors.pxVoid).toBe('#080B12');
    expect(pixelColors.pxGround).toBe('#0F1420');
    expect(pixelColors.pxSurface).toBe('#171F32');
    expect(pixelColors.pxRaised).toBe('#222C44');
    expect(pixelColors.pxBorder).toBe('#33405F');
    expect(pixelColors.pxLeather).toBe('#4A2E1B');
    expect(pixelColors.pxBrassDeep).toBe('#B88428');
    expect(pixelColors.pxBrass).toBe('#E3B04B');
    expect(pixelColors.pxBrassLight).toBe('#F7D486');
    expect(pixelColors.pxParchment).toBe('#E8DEC8');
    expect(pixelColors.pxInk).toBe('#F5F0E6');
    expect(pixelColors.pxMuted).toBe('#9099B0');
    expect(pixelColors.pxMoon).toBe('#6C98C2');
    expect(pixelColors.pxSage).toBe('#78B084');
    expect(pixelColors.pxRust).toBe('#C85848');
    expect(pixelColors.pxCandle).toBe('#FF9E43');
  });

  it('maps semantic darkTheme accurately to master palette', () => {
    expect(darkTheme.isDark).toBe(true);
    expect(darkTheme.ground).toBe(pixelColors.pxGround);
    expect(darkTheme.surface).toBe(pixelColors.pxSurface);
    expect(darkTheme.text).toBe(pixelColors.pxInk);
    expect(darkTheme.accent).toBe(pixelColors.pxBrass);
    expect(darkTheme.accentSecondary).toBe(pixelColors.pxMoon);
    expect(darkTheme.success).toBe(pixelColors.pxSage);
    expect(darkTheme.error).toBe(pixelColors.pxRust);
  });

  it('maps lightTheme correctly with high contrast values', () => {
    expect(lightTheme.isDark).toBe(false);
    expect(lightTheme.ground).toBe('#F5F1E8');
    expect(lightTheme.surface).toBe('#FCFAF4');
    expect(lightTheme.text).toBe('#1B2334');
    expect(lightTheme.accent).toBe('#A5731C');
  });

  it('defines 16-bit bevel borders and typography scales', () => {
    expect(pixelBorders.thin.borderWidth).toBe(1);
    expect(pixelBorders.bevel.borderWidth).toBe(2);
    expect(pixelBorders.bevelBrass.borderTopColor).toBe(pixelColors.pxBrassLight);
    expect(pixelBorders.bevelBrass.borderBottomColor).toBe(pixelColors.pxBrassDeep);

    expect(pixelTypography.sizes.xs).toBe(11);
    expect(pixelTypography.sizes.sm).toBe(13);
    expect(pixelTypography.sizes.md).toBe(15);
    expect(pixelTypography.sizes.lg).toBe(18);
    expect(pixelTypography.sizes.xl).toBe(22);
    expect(pixelTypography.sizes.display).toBe(28);
  });
});
