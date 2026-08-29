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
 * High-Precision Cantor8 16-Bit Blue Battery Prism Brand Emblem.
 * Multi-layered vector component with radial cyan light bloom, Royal Sapphire casing,
 * metallic positive terminal nub, recessed digital screen, and glowing cyan LED energy core.
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
          <stop offset="0%" stopColor="#6FE3FF" stopOpacity="0.4" />
          <stop offset="55%" stopColor="#044AB3" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#044AB3" stopOpacity="0" />
        </radialGradient>

        {/* Sapphire Battery Casing Gradient */}
        <linearGradient id="c8BatteryCasing" x1="11" y1="8" x2="37" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D68D8" />
          <stop offset="45%" stopColor="#044AB3" />
          <stop offset="100%" stopColor="#021A3D" />
        </linearGradient>

        {/* Silver Terminal Nub Gradient */}
        <linearGradient id="c8TerminalGrad" x1="19" y1="4" x2="29" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="45%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#334155" />
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
        stroke="#080E1E"
        strokeWidth="1"
      />
      <rect x="20.5" y="4.5" width="4" height="1.2" rx="0.6" fill="#FFFFFF" opacity="0.85" />

      {/* Main Sapphire Battery Body */}
      <rect
        x="11"
        y="8"
        width="26"
        height="34"
        rx="6"
        fill="url(#c8BatteryCasing)"
        stroke="#080E1E"
        strokeWidth="1.2"
      />

      {/* Left Specular Glint */}
      <rect x="13" y="10" width="2" height="30" rx="1" fill="#93C5FD" opacity="0.55" />
      <rect x="13" y="10" width="1" height="26" rx="0.5" fill="#FFFFFF" opacity="0.75" />

      {/* Recessed Digital LED Screen */}
      <rect
        x="15"
        y="12"
        width="18"
        height="18"
        rx="3.5"
        fill="#05132B"
        stroke="#0A1E3F"
        strokeWidth="1"
      />

      {/* Glowing Cyan LED Digital Face */}
      <g filter="url(#c8CyanGlow)">
        {/* Left Eye */}
        <rect x="18" y="17" width="3" height="3" rx="0.75" fill="#6FE3FF" />
        <rect x="18.5" y="17.5" width="1" height="1" fill="#FFFFFF" />

        {/* Right Eye */}
        <rect x="27" y="17" width="3" height="3" rx="0.75" fill="#6FE3FF" />
        <rect x="27.5" y="17.5" width="1" height="1" fill="#FFFFFF" />

        {/* Smile Arc */}
        <path
          d="M21 23.5C22.2 25.2 25.8 25.2 27 23.5"
          stroke="#6FE3FF"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>

      {/* Multi-Bar Power Gauge */}
      <g opacity="0.9">
        <rect x="15" y="32.5" width="3.5" height="2.5" rx="0.75" fill="#6FE3FF" />
        <rect x="19.5" y="32.5" width="3.5" height="2.5" rx="0.75" fill="#6FE3FF" />
        <rect x="24" y="32.5" width="3.5" height="2.5" rx="0.75" fill="#6FE3FF" />
        <rect x="28.5" y="32.5" width="4.5" height="2.5" rx="0.75" fill="#6FE3FF" />
      </g>

      {/* Sparkle Accent */}
      <path
        d="M36 6L37 9L40 10L37 11L36 14L35 11L32 10L35 9L36 6Z"
        fill="#6FE3FF"
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
        className={`flex items-center justify-center rounded-xl bg-[#044AB3]/10 border border-[rgba(4,74,179,0.18)] text-[#044AB3] shadow-[0_0_16px_rgba(111,227,255,0.2)] ${config.box} ${className}`}
      >
        <ComtusEmblem size={config.icon} breathe={breathe} />
      </div>
    );
  }

  return (
    <div className={`flex items-center select-none ${config.gap} ${className}`}>
      <div
        className={`flex items-center justify-center rounded-xl bg-[#044AB3]/10 border border-[rgba(4,74,179,0.18)] text-[#044AB3] shadow-[0_0_16px_rgba(111,227,255,0.2)] shrink-0 ${config.box}`}
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
