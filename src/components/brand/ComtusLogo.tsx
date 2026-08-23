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
 * Illuminated Scholar's Lamp Emblem.
 * Multi-layered vector component with radial light bloom, dual-tone brass gradients,
 * inner flame core highlight, and refined pedestal geometry.
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
      className={`${breathe ? "animate-[pulse_3.5s_ease-in-out_infinite]" : ""} ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Ambient Backlight Bloom */}
        <radialGradient
          id="comtusLampBloom"
          cx="50%"
          cy="42%"
          r="48%"
          fx="50%"
          fy="40%"
        >
          <stop offset="0%" stopColor="#FFE4A0" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#E3B04B" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#E3B04B" stopOpacity="0" />
        </radialGradient>

        {/* Outer Flame Gradient */}
        <linearGradient id="comtusFlameGrad" x1="24" y1="6" x2="24" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF1C2" />
          <stop offset="28%" stopColor="#F5C869" />
          <stop offset="72%" stopColor="#E3B04B" />
          <stop offset="100%" stopColor="#A86E18" />
        </linearGradient>

        {/* Inner Flame Core Highlight */}
        <linearGradient id="comtusCoreGrad" x1="24" y1="14" x2="24" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#FFF8E0" />
          <stop offset="100%" stopColor="#F7D486" />
        </linearGradient>

        {/* Brass Bezel & Pedestal Gradient */}
        <linearGradient id="comtusBrassGrad" x1="16" y1="32" x2="32" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5C869" />
          <stop offset="50%" stopColor="#E3B04B" />
          <stop offset="100%" stopColor="#8C5810" />
        </linearGradient>

        {/* Subtle Drop Shadow */}
        <filter id="comtusGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Ambient Radiance Halo */}
      <circle cx="24" cy="22" r="20" fill="url(#comtusLampBloom)" />

      {/* Outer Flame / Teardrop Ray */}
      <path
        d="M24 6.5C24 6.5 32.5 16.2 32.5 24C32.5 28.6944 28.6944 32.5 24 32.5C19.3056 32.5 15.5 28.6944 15.5 24C15.5 16.2 24 6.5 24 6.5Z"
        fill="url(#comtusFlameGrad)"
        filter="url(#comtusGlow)"
      />

      {/* Inner Pure Radiance Core */}
      <path
        d="M24 14.5C24 14.5 28.2 20.2 28.2 24.5C28.2 26.8196 26.3196 28.7 24 28.7C21.6804 28.7 19.8 26.8196 19.8 24.5C19.8 20.2 24 14.5 24 14.5Z"
        fill="url(#comtusCoreGrad)"
        opacity="0.92"
      />

      {/* Lamp Font / Pedestal Cup */}
      <path
        d="M17 32C17 30.5 19.5 29.5 24 29.5C28.5 29.5 31 30.5 31 32C31 34.5 28 36 24 36C20 36 17 34.5 17 32Z"
        fill="url(#comtusBrassGrad)"
      />

      {/* Pedestal Stem & Base Tier */}
      <path
        d="M22.5 35.5H25.5V38.5H22.5V35.5Z"
        fill="url(#comtusBrassGrad)"
      />
      <rect
        x="18"
        y="38.5"
        width="12"
        height="2.5"
        rx="1.25"
        fill="url(#comtusBrassGrad)"
      />
    </svg>
  );
}

/**
 * Full Comtus Brand Logo Component.
 * Supports emblem mark, full logo with serif wordmark, and illuminated badges.
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
        className={`flex items-center justify-center rounded-xl bg-brass/[0.12] border border-brass/25 text-brass shadow-[0_0_16px_rgba(227,176,75,0.14)] ${config.box} ${className}`}
      >
        <ComtusEmblem size={config.icon} breathe={breathe} />
      </div>
    );
  }

  return (
    <div className={`flex items-center select-none ${config.gap} ${className}`}>
      <div
        className={`flex items-center justify-center rounded-xl bg-brass/[0.12] border border-brass/25 text-brass shadow-[0_0_16px_rgba(227,176,75,0.14)] shrink-0 ${config.box}`}
      >
        <ComtusEmblem size={config.icon} breathe={breathe} />
      </div>

      <div className="flex flex-col">
        <span
          className={`font-display font-[500] tracking-[-0.01em] text-ink leading-none ${config.text}`}
        >
          COMTUS
        </span>
        {subtitle && (
          <span className="mt-0.5 font-mono text-[10px] tracking-[0.14em] uppercase text-muted">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
