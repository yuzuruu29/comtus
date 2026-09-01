/** Curated Studio typography systems. Locked design decision: presets are
 *  whole systems, not mix-and-match controls — one primary family per preset,
 *  with JetBrains Mono allowed only as the single mono fallback. */
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
    tagline: "Unified Inter system with mono fallback",
    previewFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
  },
  {
    id: "pixel-signal",
    label: "Pixel Signal",
    tagline: "Unified Pixelify Sans system with mono fallback",
    previewFamily: "'Pixelify Sans Variable', 'Pixelify Sans', sans-serif",
  },
  {
    id: "scholar",
    label: "Scholar",
    tagline: "Unified Fraunces system with mono fallback",
    previewFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
  },
  {
    id: "console",
    label: "Console",
    tagline: "Unified JetBrains Mono system",
    previewFamily: "'JetBrains Mono', ui-monospace, monospace",
  },
];

export function fontPresetById(id: string | undefined): FontPreset {
  return FONT_PRESETS.find((p) => p.id === id) ?? FONT_PRESETS[0];
}
