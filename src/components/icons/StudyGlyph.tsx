import { useMemo } from "react";

export type StudyGlyphKey =
  | "compass"
  | "lamp"
  | "tome"
  | "justice"
  | "health"
  | "code"
  | "pillar"
  | "atom"
  | "brain"
  | "exam"
  | "palette"
  | "globe"
  | "sprout"
  | "shield"
  | "wave"
  | "drafting";

export interface StudyGlyphProps {
  /** Explicit glyph key, or pass notebook title via `name` for automatic resolution */
  glyph?: StudyGlyphKey;
  /** Notebook title used for automatic keyword-based glyph resolution */
  name?: string;
  /** Size preset */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Whether to render only the vector icon without the illuminated container box */
  bare?: boolean;
  /** Custom className */
  className?: string;
}

const SIZE_STYLES = {
  xs: { box: "h-6 w-6 rounded-md", icon: 14 },
  sm: { box: "h-8 w-8 rounded-lg", icon: 18 },
  md: { box: "h-10 w-10 rounded-xl", icon: 22 },
  lg: { box: "h-12 w-12 rounded-2xl", icon: 28 },
  xl: { box: "h-16 w-16 rounded-2xl", icon: 38 },
};

/**
 * Contextual Study Glyph Artwork Library.
 * Each glyph is crafted with rich dual-layer metallic vector styling,
 * gradient illumination, fine accents, and high legibility.
 */
function GlyphArtwork({ glyph, size }: { glyph: StudyGlyphKey; size: number }) {
  switch (glyph) {
    case "compass":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="compRing" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="100%" stopColor="#9E6B18" />
            </linearGradient>
            <linearGradient id="compNeedleN" x1="16" y1="7" x2="22" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF2CC" />
              <stop offset="100%" stopColor="#E3B04B" />
            </linearGradient>
            <linearGradient id="compNeedleS" x1="10" y1="16" x2="16" y2="25" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C96A5E" />
              <stop offset="100%" stopColor="#8C3B30" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="13" stroke="url(#compRing)" strokeWidth="1.75" />
          <circle cx="16" cy="16" r="10.5" stroke="rgba(227,176,75,0.25)" strokeWidth="0.75" strokeDasharray="1.5 2" />
          {/* North needle */}
          <path d="M16 6.5L19.5 15.5H12.5L16 6.5Z" fill="url(#compNeedleN)" />
          {/* South needle */}
          <path d="M16 25.5L12.5 16.5H19.5L16 25.5Z" fill="url(#compNeedleS)" />
          {/* Center pivot */}
          <circle cx="16" cy="16" r="2.2" fill="#FFF4D6" stroke="#8C5810" strokeWidth="0.8" />
        </svg>
      );

    case "lamp":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gLampFlame" x1="16" y1="4" x2="16" y2="18" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF2CC" />
              <stop offset="60%" stopColor="#E3B04B" />
              <stop offset="100%" stopColor="#9E6B18" />
            </linearGradient>
            <linearGradient id="gLampBase" x1="8" y1="20" x2="24" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="100%" stopColor="#7A4C0B" />
            </linearGradient>
          </defs>
          <path d="M16 4C16 4 21.5 10 21.5 14.5C21.5 17.5 19 20 16 20C13 20 10.5 17.5 10.5 14.5C10.5 10 16 4 16 4Z" fill="url(#gLampFlame)" />
          <circle cx="16" cy="15" r="2" fill="#FFFFFF" opacity="0.9" />
          <path d="M11 20C11 19 13 18.5 16 18.5C19 18.5 21 19 21 20C21 21.5 19 22.5 16 22.5C13 22.5 11 21.5 11 20Z" fill="url(#gLampBase)" />
          <path d="M15 22.5H17V25.5H15V22.5Z" fill="url(#gLampBase)" />
          <rect x="11.5" y="25.5" width="9" height="2" rx="1" fill="url(#gLampBase)" />
        </svg>
      );

    case "tome":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gBook" x1="4" y1="8" x2="28" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="100%" stopColor="#9E6B18" />
            </linearGradient>
          </defs>
          <path
            d="M5 8.5C5 7.5 6.5 6.5 9 6.5C12 6.5 15 8 16 9.5C17 8 20 6.5 23 6.5C25.5 6.5 27 7.5 27 8.5V23.5C27 24.5 25.5 25.5 23 25.5C20 25.5 17 24 16 22.5C15 24 12 25.5 9 25.5C6.5 25.5 5 24.5 5 23.5V8.5Z"
            stroke="url(#gBook)"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M16 9.5V22.5" stroke="url(#gBook)" strokeWidth="1.5" />
          <path d="M8.5 11.5C10.5 11.5 12.5 12.2 13.5 13" stroke="rgba(245,200,105,0.7)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M8.5 15.5C10.5 15.5 12.5 16.2 13.5 17" stroke="rgba(245,200,105,0.7)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M23.5 11.5C21.5 11.5 19.5 12.2 18.5 13" stroke="rgba(245,200,105,0.7)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M23.5 15.5C21.5 15.5 19.5 16.2 18.5 17" stroke="rgba(245,200,105,0.7)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    case "justice":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gScale" x1="6" y1="6" x2="26" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="100%" stopColor="#8C5810" />
            </linearGradient>
          </defs>
          <path d="M16 5V27M12 27H20" stroke="url(#gScale)" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M6 9.5H26" stroke="url(#gScale)" strokeWidth="1.75" strokeLinecap="round" />
          {/* Left Pan */}
          <path d="M6 9.5L3 17M6 9.5L9 17" stroke="rgba(227,176,75,0.7)" strokeWidth="1" />
          <path d="M2.5 17C2.5 19 4 20.5 6 20.5C8 20.5 9.5 19 9.5 17H2.5Z" fill="url(#gScale)" />
          {/* Right Pan */}
          <path d="M26 9.5L23 17M26 9.5L29 17" stroke="rgba(227,176,75,0.7)" strokeWidth="1" />
          <path d="M22.5 17C22.5 19 24 20.5 26 20.5C28 20.5 29.5 19 29.5 17H22.5Z" fill="url(#gScale)" />
        </svg>
      );

    case "health":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gCross" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8FBF98" />
              <stop offset="100%" stopColor="#3E7D50" />
            </linearGradient>
          </defs>
          <rect x="12.5" y="5" width="7" height="22" rx="2" fill="url(#gCross)" />
          <rect x="5" y="12.5" width="22" height="7" rx="2" fill="url(#gCross)" />
          <circle cx="16" cy="16" r="3" fill="#FFFFFF" opacity="0.85" />
        </svg>
      );

    case "code":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gCode" x1="4" y1="8" x2="28" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="100%" stopColor="#A5731C" />
            </linearGradient>
          </defs>
          <path d="M10 10L4.5 16L10 22" stroke="url(#gCode)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 10L27.5 16L22 22" stroke="url(#gCode)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 7L14 25" stroke="#E3B04B" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );

    case "pillar":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gPillar" x1="5" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="100%" stopColor="#8C5810" />
            </linearGradient>
          </defs>
          {/* Pediment roof */}
          <path d="M5 10L16 4.5L27 10H5Z" fill="url(#gPillar)" />
          <rect x="4.5" y="10" width="23" height="2" fill="url(#gPillar)" />
          {/* Columns */}
          <rect x="7" y="12" width="3" height="12" rx="0.5" fill="url(#gPillar)" />
          <rect x="14.5" y="12" width="3" height="12" rx="0.5" fill="url(#gPillar)" />
          <rect x="22" y="12" width="3" height="12" rx="0.5" fill="url(#gPillar)" />
          {/* Base */}
          <rect x="4.5" y="24" width="23" height="3" rx="1" fill="url(#gPillar)" />
        </svg>
      );

    case "atom":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gAtom" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E3B04B" />
              <stop offset="100%" stopColor="#7D5312" />
            </linearGradient>
          </defs>
          <ellipse cx="16" cy="16" rx="12" ry="4.5" stroke="url(#gAtom)" strokeWidth="1.3" transform="rotate(30 16 16)" />
          <ellipse cx="16" cy="16" rx="12" ry="4.5" stroke="url(#gAtom)" strokeWidth="1.3" transform="rotate(-30 16 16)" />
          <ellipse cx="16" cy="16" rx="12" ry="4.5" stroke="#E3B04B" strokeWidth="1.3" transform="rotate(90 16 16)" />
          <circle cx="16" cy="16" r="2.8" fill="#FFF2CC" stroke="#E3B04B" strokeWidth="1" />
        </svg>
      );

    case "brain":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gBrain" x1="5" y1="6" x2="27" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E3B04B" />
              <stop offset="100%" stopColor="#C96A5E" />
            </linearGradient>
          </defs>
          <path
            d="M16 7C13 7 10.5 8.5 10 11C8 11.5 6.5 13.5 6.5 16C6.5 18 7.5 19.8 9.2 20.8C9 21.5 9 22.3 9.5 23C10.5 24.5 12.5 25 14.5 24.5C15 25 15.5 25 16 25M16 7C19 7 21.5 8.5 22 11C24 11.5 25.5 13.5 25.5 16C25.5 18 24.5 19.8 22.8 20.8C23 21.5 23 22.3 22.5 23C21.5 24.5 19.5 25 17.5 24.5C17 25 16.5 25 16 25M16 7V25"
            stroke="url(#gBrain)"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path d="M12 14C14 14.5 14.5 16.5 13 18" stroke="rgba(245,200,105,0.7)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M20 14C18 14.5 17.5 16.5 19 18" stroke="rgba(245,200,105,0.7)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    case "exam":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gCap" x1="4" y1="8" x2="28" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="100%" stopColor="#9E6B18" />
            </linearGradient>
          </defs>
          <path d="M16 6L3.5 12.5L16 19L28.5 12.5L16 6Z" fill="url(#gCap)" />
          <path d="M8 15V21.5C8 23.5 11.5 25.5 16 25.5C20.5 25.5 24 23.5 24 21.5V15" stroke="url(#gCap)" strokeWidth="1.75" />
          <path d="M26 14V22" stroke="#FFF2CC" strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="26" cy="22.5" r="1.25" fill="#FFF2CC" />
        </svg>
      );

    case "palette":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gPalette" x1="5" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="50%" stopColor="#E3B04B" />
              <stop offset="100%" stopColor="#8FBF98" />
            </linearGradient>
          </defs>
          <path
            d="M16 5C9.9 5 5 9.9 5 16C5 20.5 7.8 24.3 11.8 25.8C12.8 26.2 13.8 25.5 13.8 24.4V23.5C13.8 22.1 14.9 21 16.3 21H18C22.4 21 26 17.4 26 13C26 8.6 21.5 5 16 5Z"
            stroke="url(#gPalette)"
            strokeWidth="1.75"
          />
          <circle cx="10" cy="12" r="1.75" fill="#E3B04B" />
          <circle cx="15" cy="9.5" r="1.75" fill="#8FBF98" />
          <circle cx="20.5" cy="11.5" r="1.75" fill="#E3B04B" />
          <circle cx="21" cy="16.5" r="1.75" fill="#C96A5E" />
        </svg>
      );

    case "globe":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gGlobe" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E3B04B" />
              <stop offset="100%" stopColor="#7D5312" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="12" stroke="url(#gGlobe)" strokeWidth="1.75" />
          <ellipse cx="16" cy="16" rx="6" ry="12" stroke="url(#gGlobe)" strokeWidth="1.25" />
          <path d="M4 16H28" stroke="url(#gGlobe)" strokeWidth="1.25" />
          <path d="M6 10H26" stroke="rgba(227,176,75,0.4)" strokeWidth="1" />
          <path d="M6 22H26" stroke="rgba(227,176,75,0.4)" strokeWidth="1" />
        </svg>
      );

    case "sprout":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gSprout" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8FBF98" />
              <stop offset="100%" stopColor="#3E7D50" />
            </linearGradient>
          </defs>
          <path d="M16 26V14" stroke="url(#gSprout)" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M16 14C16 10 20 7 25 7C25 12 21 16 16 16"
            fill="url(#gSprout)"
            stroke="url(#gSprout)"
            strokeWidth="1.2"
          />
          <path
            d="M16 17C16 13 12 10 7 10C7 15 11 19 16 19"
            fill="url(#gSprout)"
            stroke="url(#gSprout)"
            strokeWidth="1.2"
            opacity="0.85"
          />
        </svg>
      );

    case "shield":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gShield" x1="5" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="100%" stopColor="#8FBF98" />
            </linearGradient>
          </defs>
          <path
            d="M16 5L6 9.5V16.5C6 22 10.3 26.8 16 28C21.7 26.8 26 22 26 16.5V9.5L16 5Z"
            stroke="url(#gShield)"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M16 9V24M16 9L11 12V17C11 20.5 13.5 23 16 24" fill="rgba(227,176,75,0.25)" />
        </svg>
      );

    case "wave":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gWave" x1="4" y1="10" x2="28" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8FBF98" />
              <stop offset="100%" stopColor="#E3B04B" />
            </linearGradient>
          </defs>
          <path
            d="M4 14C7 10 10 10 13 14C16 18 19 18 22 14C25 10 27 10 28 12"
            stroke="url(#gWave)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 19C7 15 10 15 13 19C16 23 19 23 22 19C25 15 27 15 28 17"
            stroke="url(#gWave)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
      );

    case "drafting":
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="gDraft" x1="5" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5C869" />
              <stop offset="100%" stopColor="#8C5810" />
            </linearGradient>
          </defs>
          <path d="M16 6L7 26H9L16 10L23 26H25L16 6Z" fill="url(#gDraft)" />
          <path d="M11 18H21" stroke="#FFF2CC" strokeWidth="1.5" />
          <circle cx="16" cy="6" r="2.5" fill="#FFF2CC" stroke="#8C5810" strokeWidth="1" />
        </svg>
      );
  }
}

/** Keyword dictionary for automatic title-to-glyph matching */
const KEYWORD_GLYPHS: Array<{ regex: RegExp; glyph: StudyGlyphKey }> = [
  { regex: /health|nurs|medic|doctor|pharma|bio|clinic|patient|care/i, glyph: "health" },
  { regex: /law|legal|court|justice|juris|contract|dispute|tax/i, glyph: "justice" },
  { regex: /finance|wealth|bank|invest|money|cpa|stock|fund|audit|accounting/i, glyph: "pillar" },
  { regex: /code|software|tech|dev|ai|model|comput|program|web|android|ios|react|ts/i, glyph: "code" },
  { regex: /physics|quantum|space|astro|chem|science|atom|lab/i, glyph: "atom" },
  { regex: /psych|mental|brain|cognit|neuron|think|mind/i, glyph: "brain" },
  { regex: /exam|board|let|pnle|ce|review|quiz|drill|test|cert/i, glyph: "exam" },
  { regex: /art|design|draw|paint|visual|music|studio/i, glyph: "palette" },
  { regex: /global|earth|geography|map|world|travel|history|empire/i, glyph: "globe" },
  { regex: /nature|farm|plant|garden|tree|flower|bio|agri/i, glyph: "sprout" },
  { regex: /shield|security|cyber|protect|risk|defense|insur/i, glyph: "shield" },
  { regex: /gtd|habit|focus|flow|mind|wave|zen/i, glyph: "wave" },
  { regex: /math|algebra|stat|calculus|geometry|civil|architect|engineer/i, glyph: "drafting" },
  { regex: /book|read|novel|literature|poem|essay|phil|scholar/i, glyph: "tome" },
  { regex: /lamp|light|comtus|torch|clarity/i, glyph: "lamp" },
];

const FALLBACK_GLYPH_CYCLE: StudyGlyphKey[] = [
  "compass",
  "lamp",
  "tome",
  "pillar",
  "atom",
  "brain",
  "code",
  "drafting",
];

export function resolveStudyGlyphKey(name?: string): StudyGlyphKey {
  const trimmed = (name || "").trim();
  if (!trimmed) return "compass";

  for (const item of KEYWORD_GLYPHS) {
    if (item.regex.test(trimmed)) {
      return item.glyph;
    }
  }

  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % FALLBACK_GLYPH_CYCLE.length;
  return FALLBACK_GLYPH_CYCLE[idx];
}

/**
 * Rich Illuminated Study Glyph Component.
 * Replaces raw OS cartoon emojis with high-craft vector emblems sitting inside
 * an ambient-lit jewel container with polished border and subtle depth.
 */
export default function StudyGlyph({
  glyph,
  name,
  size = "md",
  bare = false,
  className = "",
}: StudyGlyphProps) {
  const resolvedKey = useMemo(() => {
    if (glyph) return glyph;
    return resolveStudyGlyphKey(name);
  }, [glyph, name]);

  const style = SIZE_STYLES[size];

  if (bare) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <GlyphArtwork glyph={resolvedKey} size={style.icon} />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none bg-gradient-to-b from-brass/[0.14] to-brass/[0.04] border border-brass/25 text-brass shadow-[0_0_12px_rgba(227,176,75,0.08)] ${style.box} ${className}`}
      title={name || resolvedKey}
    >
      <GlyphArtwork glyph={resolvedKey} size={style.icon} />
    </div>
  );
}
