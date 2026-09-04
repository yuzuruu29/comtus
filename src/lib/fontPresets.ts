/** Reading size, the one typography choice the student still makes.
 *
 *  Spec 5.1 fixes the faces: Literata to read, Instrument Sans for UI,
 *  JetBrains Mono for code and figures, Pixelify only as accent chrome. The
 *  four swappable font systems this replaces (instrument, pixel-signal,
 *  scholar, console) let any surface become any face, which is how the studio
 *  ended up with three competing type identities. */
export const READING_SIZES = ["compact", "comfortable", "large"] as const;

export type ReadingSize = (typeof READING_SIZES)[number];

export const DEFAULT_READING: ReadingSize = "comfortable";

export interface ReadingOption {
  id: ReadingSize;
  label: string;
  /** Must match --text-read in styles/font-presets.css. */
  size: string;
}

export const READING_OPTIONS: ReadingOption[] = [
  { id: "compact", label: "Compact", size: "1rem" },
  { id: "comfortable", label: "Comfortable", size: "1.0625rem" },
  { id: "large", label: "Large", size: "1.1875rem" },
];

export function isReadingSize(value: unknown): value is ReadingSize {
  return typeof value === "string" && (READING_SIZES as readonly string[]).includes(value);
}
