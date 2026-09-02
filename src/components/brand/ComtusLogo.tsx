import { type ReactNode } from "react";

export interface ComtusLogoProps {
  /** Logo variant: 'mark' (emblem only), 'full' (emblem + COMTUS text), or 'illuminated' (with glow aura) */
  variant?: "mark" | "full" | "illuminated";
  /** Size preset */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Whether the emblem breathes with subtle animated light pulse */
  breathe?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Optional subtitle or tagline */
  subtitle?: ReactNode;
}

const SIZE_MAP = {
  xs: { box: "h-6 w-6", icon: 16, text: "text-[13px]", gap: "gap-2" },
  sm: { box: "h-7 w-7", icon: 18, text: "text-[15px]", gap: "gap-2.5" },
  md: { box: "h-9 w-9", icon: 22, text: "text-[18px]", gap: "gap-3" },
  lg: { box: "h-11 w-11", icon: 28, text: "text-[22px]", gap: "gap-3.5" },
  xl: { box: "h-14 w-14", icon: 36, text: "text-[26px]", gap: "gap-4" },
};

/**
 * High-Precision Cantor8 16-Bit Warm Brass Battery Brand Emblem.
 * Multi-layered vector component with radial amber light bloom, warm brass casing,
 * metallic positive terminal nub, recessed digital screen, and glowing golden LED energy core.
 */
export function ComtusEmblem({
  size = 22,
  breathe = false,
  className = "",
}: {
  size?: number;
  breathe?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${breathe ? "animate-[pulse_3s_ease-in-out_infinite]" : ""} ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Ambient Backlight Bloom */}
        <radialGradient
          id="c8BatteryBloom"
          cx="50%"
          cy="48%"
          r="48%"
          fx="50%"
          fy="46%"
        >
          <stop offset="0%" stopColor="#FDE047" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#E3B04B" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#B88428" stopOpacity="0" />
        </radialGradient>

        {/* Warm Brass Battery Casing Gradient */}
        <linearGradient id="c8BatteryCasing" x1="11" y1="8" x2="37" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F7D486" />
          <stop offset="45%" stopColor="#E3B04B" />
          <stop offset="100%" stopColor="#7D5312" />
        </linearGradient>

        {/* Metallic Terminal Nub Gradient */}
        <linearGradient id="c8TerminalGrad" x1="19" y1="4" x2="29" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF2B2" />
          <stop offset="45%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>

        {/* Glow Core Filter */}
        <filter id="c8CyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Ambient Radiance Halo */}
      <circle cx="24" cy="24" r="22" fill="url(#c8BatteryBloom)" />

      {/* Positive Terminal Cap */}
      <rect
        x="19"
        y="4"
        width="10"
        height="5"
        rx="2"
        fill="url(#c8TerminalGrad)"
        stroke="#1A1108"
        strokeWidth="1"
      />
      <rect x="20.5" y="4.5" width="4" height="1.2" rx="0.6" fill="#FFFFFF" opacity="0.85" />

      {/* Main Warm Brass Battery Body */}
      <rect
        x="11"
        y="8"
        width="26"
        height="34"
        rx="6"
        fill="url(#c8BatteryCasing)"
        stroke="#1A1108"
        strokeWidth="1.2"
      />

      {/* Left Specular Glint */}
      <rect x="13" y="10" width="2" height="30" rx="1" fill="#FFF2B2" opacity="0.6" />
      <rect x="13" y="10" width="1" height="26" rx="0.5" fill="#FFFFFF" opacity="0.85" />

      {/* Recessed Digital LED Screen */}
      <rect
        x="15"
        y="12"
        width="18"
        height="18"
        rx="3.5"
        fill="#080B12"
        stroke="#1F160E"
        strokeWidth="1"
      />

      {/* Glowing Warm Gold LED Digital Face */}
      <g filter="url(#c8CyanGlow)">
        {/* Left Eye */}
        <rect x="18" y="17" width="3" height="3" rx="0.75" fill="#FDE047" />
        <rect x="18.5" y="17.5" width="1" height="1" fill="#FFFFFF" />

        {/* Right Eye */}
        <rect x="27" y="17" width="3" height="3" rx="0.75" fill="#FDE047" />
        <rect x="27.5" y="17.5" width="1" height="1" fill="#FFFFFF" />

        {/* Smile Arc */}
        <path
          d="M21 23.5C22.2 25.2 25.8 25.2 27 23.5"
          stroke="#FDE047"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>

      {/* Multi-Bar Power Gauge */}
      <g opacity="0.9">
        <rect x="15" y="32.5" width="3.5" height="2.5" rx="0.75" fill="#78B084" />
        <rect x="19.5" y="32.5" width="3.5" height="2.5" rx="0.75" fill="#78B084" />
        <rect x="24" y="32.5" width="3.5" height="2.5" rx="0.75" fill="#FDE047" />
        <rect x="28.5" y="32.5" width="4.5" height="2.5" rx="0.75" fill="#FDE047" />
      </g>

      {/* Sparkle Accent */}
      <path
        d="M36 6L37 9L40 10L37 11L36 14L35 11L32 10L35 9L36 6Z"
        fill="#FDE047"
        opacity="0.85"
      />
    </svg>
  );
}

/**
 * Full Comtus Brand Logo Component.
 * Supports emblem mark, full logo with high-precision wordmark, and illuminated badges.
 */
export default function ComtusLogo({
  variant = "full",
  size = "md",
  breathe = false,
  className = "",
  subtitle,
}: ComtusLogoProps) {
  const config = SIZE_MAP[size];

  if (variant === "mark") {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-brass/10 border border-brass/25 text-brass shadow-[0_0_16px_rgba(227,176,75,0.2)] ${config.box} ${className}`}
      >
        <ComtusEmblem size={config.icon} breathe={breathe} />
      </div>
    );
  }

  return (
    <div className={`flex items-center select-none ${config.gap} ${className}`}>
      <div
        className={`flex items-center justify-center rounded-xl bg-brass/10 border border-brass/25 text-brass shadow-[0_0_16px_rgba(227,176,75,0.2)] shrink-0 ${config.box}`}
      >
        <ComtusEmblem size={config.icon} breathe={breathe} />
      </div>

      <div className="flex flex-col">
        <span
          className={`font-display font-[600] tracking-[0.05em] text-ink leading-none ${config.text}`}
        >
          COMTUS
        </span>
        {subtitle && (
          <span className="mt-0.5 font-mono text-[10px] tracking-[0.14em] uppercase text-muted font-medium">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
