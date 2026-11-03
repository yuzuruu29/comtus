export interface ComtusLogoProps {
  /** Logo variant: 'mark' (emblem only), 'full' (emblem + wordmark), or 'illuminated' (with glow aura) */
  variant?: "mark" | "full" | "illuminated";
  /** Size preset */
  size?: "xs" | "sm";
  /** Whether the emblem breathes with subtle animated light pulse */
  breathe?: boolean;
  /** Custom className for the container */
  className?: string;
}

const SIZE_MAP = {
  xs: { box: "h-6 w-6", icon: 16, text: "text-lead", gap: "gap-2" },
  sm: { box: "h-7 w-7", icon: 18, text: "text-title", gap: "gap-2.5" },
};

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
      className={`${breathe ? "animate-[pulse_3s_var(--ease-inout)_infinite]" : ""} ${className}`}
      aria-hidden="true"
    >
      <rect x="8" y="6" width="32" height="36" rx="4" fill="#F5ECDC" stroke="#28372F" strokeWidth="2" />
      <path d="M12 6H36V35H12C9.8 35 8 36.3 8 38V10C8 7.8 9.8 6 12 6Z" fill="#A8B598" />
      <path d="M12 6H14V35H12C9.8 35 8 36.3 8 38V10C8 7.8 9.8 6 12 6Z" fill="#3D5749" />
      <path d="M16 9H33" stroke="#C1CDAF" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 38C8 36.3 9.8 35 12 35H40M36 7V35" stroke="#28372F" strokeWidth="1.5" />
      <path d="M15 38.5H23M32 38.5H37" stroke="#CABDA2" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M25 35H31V44L28 42L25 44V35Z" fill="#C49A4A" stroke="#967038" strokeWidth="1" strokeLinejoin="round" />
      <path d="M27 36V40" stroke="#E5C579" strokeWidth="1" strokeLinecap="round" />
      <rect x="19" y="19" width="2.5" height="3.5" rx="1.25" fill="#27372E" />
      <rect x="28" y="19" width="2.5" height="3.5" rx="1.25" fill="#27372E" />
      <path d="M22 26C23.5 27.5 26 27.5 27.5 26" stroke="#27372E" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Full Comtus Brand Logo Component.
 * Supports emblem mark, full logo with high-precision wordmark, and illuminated badges.
 */
export default function ComtusLogo({
  variant = "full",
  size = "sm",
  breathe = false,
  className = "",
}: ComtusLogoProps) {
  const config = SIZE_MAP[size];

  if (variant === "mark") {
    return (
      <div
        className={`flex items-center justify-center rounded-[var(--radius-dialog)] bg-brass/10 border border-brass/25 text-brass shadow-[0_0_16px_rgba(227,176,75,0.2)] ${config.box} ${className}`}
      >
        <ComtusEmblem size={config.icon} breathe={breathe} />
      </div>
    );
  }

  return (
    <div className={`flex items-center select-none ${config.gap} ${className}`}>
      <div
        className={`flex items-center justify-center rounded-[var(--radius-dialog)] bg-brass/10 border border-brass/25 text-brass shadow-[0_0_16px_rgba(227,176,75,0.2)] shrink-0 ${config.box}`}
      >
        <ComtusEmblem size={config.icon} breathe={breathe} />
      </div>

      {/* The same wordmark as the site and the shelf: lowercase, set tight,
          closed by a brass full stop. */}
      <span className={`font-read font-[620] tracking-[-0.033em] text-ink leading-none ${config.text}`}>
        comtus<span className="text-brass" aria-hidden="true">.</span>
      </span>
    </div>
  );
}
