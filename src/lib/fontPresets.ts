/** Curated Studio typography systems. Locked design decision: presets are
 *  whole systems, not mix-and-match controls — Pixelify appears only as the
 *  Pixel Signal preset's display accent, never as body text. */
export type FontPresetId = "instrument" | "pixel-signal" | "scholar" | "console";

export interface FontPreset {
  id: FontPresetId;
  label: string;
  tagline: string;
  /** CSS font-family stack for the picker's live preview line. */
  previewFamily: string;
}

export const FONT_PRESETS: FontPreset[] = [
  {
    id: "instrument",
    label: "Instrument",
    tagline: "Calibrated default · serif display, clean body",
    previewFamily: "'Instrument Serif', Georgia, serif",
  },
  {
    id: "pixel-signal",
    label: "Pixel Signal",
    tagline: "16-bit display accents over readable body text",
    previewFamily: "'Pixelify Sans Variable', 'Pixelify Sans', sans-serif",
  },
  {
    id: "scholar",
    label: "Scholar",
    tagline: "Classic Fraunces + Inter study desk",
    previewFamily: "'Fraunces Variable', Georgia, serif",
  },
  {
    id: "console",
    label: "Console",
    tagline: "Mono-forward terminal instrumentation",
    previewFamily: "'JetBrains Mono', ui-monospace, monospace",
  },
];

export function fontPresetById(id: string | undefined): FontPreset {
  return FONT_PRESETS.find((p) => p.id === id) ?? FONT_PRESETS[0];
}
