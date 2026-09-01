import React, {
  forwardRef,
  useState,
  useRef,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type ReactElement,
} from "react";

/* ==========================================================================
   1. PIXEL BUTTON
   ========================================================================== */

export type PixelButtonVariant = "primary" | "secondary" | "ghost" | "brass";
export type PixelButtonSize = "sm" | "md" | "lg";

export interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PixelButtonVariant;
  size?: PixelButtonSize;
  icon?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  steppedDepress?: boolean;
}

const BUTTON_VARIANTS: Record<PixelButtonVariant, { bg: string; text: string; shadow: string; border: string }> = {
  primary: {
    bg: "bg-px-surface hover:bg-px-raised",
    text: "text-px-ink hover:text-px-brass",
    border: "border-px-border hover:border-px-brass",
    shadow: "shadow-[1px_1px_0px_rgba(92,61,30,0.18)]",
  },
  secondary: {
    bg: "bg-px-raised hover:bg-px-surface",
    text: "text-px-ink",
    border: "border-px-border hover:border-px-muted",
    shadow: "shadow-[1px_1px_0px_rgba(92,61,30,0.14)]",
  },
  ghost: {
    bg: "bg-transparent hover:bg-px-brass/10",
    text: "text-px-muted hover:text-px-ink",
    border: "border-transparent hover:border-px-border",
    shadow: "shadow-none",
  },
  brass: {
    bg: "bg-px-brass hover:bg-px-brass-deep",
    text: "text-white font-semibold",
    border: "border-px-brass",
    shadow: "shadow-[2px_2px_0px_rgba(92,61,30,0.28)]",
  },
};

const BUTTON_SIZES: Record<PixelButtonSize, string> = {
  sm: "px-2 py-1 text-xs gap-1.5 min-h-[26px]",
  md: "px-3.5 py-1.5 text-sm gap-2 min-h-[34px]",
  lg: "px-5 py-2 text-base gap-2.5 min-h-[42px]",
};

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      leftIcon,
      rightIcon,
      steppedDepress = true,
      disabled = false,
      className = "",
      onClick,
      children,
      ...rest
    },
    ref
  ) => {
    const v = BUTTON_VARIANTS[variant];
    const s = BUTTON_SIZES[size];
    const effectiveLeftIcon = leftIcon ?? icon;

    return (
      <button
        ref={ref}
        disabled={disabled}
        onClick={onClick}
        className={`
          relative inline-flex items-center justify-center select-none font-mono tracking-wide
          border transition-colors duration-75 outline-none focus-visible:ring-1 focus-visible:ring-[#e3b04b]
          ${v.bg} ${v.text} ${v.border} ${v.shadow} ${s}
          ${
            steppedDepress && !disabled
              ? "active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              : ""
          }
          ${disabled ? "opacity-45 cursor-not-allowed pointer-events-none shadow-none" : "cursor-pointer"}
          ${className}
        `}
        style={{
          imageRendering: "pixelated",
          fontSmooth: "never",
        }}
        {...rest}
      >
        {effectiveLeftIcon && <span className="inline-flex shrink-0 items-center justify-center">{effectiveLeftIcon}</span>}
        {children && <span>{children}</span>}
        {rightIcon && <span className="inline-flex shrink-0 items-center justify-center">{rightIcon}</span>}
      </button>
    );
  }
);
PixelButton.displayName = "PixelButton";

/* ==========================================================================
   2. PIXEL CARD
   ========================================================================== */

export type PixelCardVariant = "default" | "book" | "parchment" | "shelf";

export interface PixelCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: PixelCardVariant;
  header?: ReactNode;
  footer?: ReactNode;
  dithered?: boolean;
  corners?: "trim" | "square" | "notched";
}

const CARD_VARIANTS: Record<PixelCardVariant, { bg: string; text: string; border: string; glow: string }> = {
  default: {
    bg: "bg-[#121828]",
    text: "text-[#f2ede3]",
    border: "border-[#e3b04b]/20 shadow-[2px_2px_0px_#0b0f1a,inset_1px_1px_0px_rgba(227,176,75,0.12)]",
    glow: "before:bg-[radial-gradient(ellipse_at_top_right,rgba(227,176,75,0.06),transparent_60%)]",
  },
  book: {
    bg: "bg-[#0d1322]",
    text: "text-[#f2ede3]",
    border: "border-l-4 border-l-[#e3b04b] border-t border-r border-b border-[#2a3654] shadow-[3px_3px_0px_#0b0f1a]",
    glow: "before:bg-[radial-gradient(ellipse_at_top_left,rgba(227,176,75,0.08),transparent_50%)]",
  },
  parchment: {
    bg: "bg-[#f2ede3]",
    text: "text-[#1b2334]",
    border: "border-[#c99236]/60 shadow-[2px_2px_0px_#79510f,inset_1px_1px_0px_rgba(255,255,255,0.8)]",
    glow: "before:bg-[radial-gradient(circle_at_bottom_left,rgba(201,146,54,0.1),transparent_70%)]",
  },
  shelf: {
    bg: "bg-[#1a2136]",
    text: "text-[#f2ede3]",
    border: "border-[#2a3654] border-t-2 border-t-[#e3b04b]/60 shadow-[3px_3px_0px_#0b0f1a,inset_0px_1px_0px_rgba(240,206,140,0.2)]",
    glow: "before:bg-[linear-gradient(to_bottom,rgba(227,176,75,0.08)_0%,transparent_16px)]",
  },
};

export const PixelCard = forwardRef<HTMLDivElement, PixelCardProps>(
  (
    {
      variant = "default",
      header,
      footer,
      dithered = true,
      corners = "trim",
      className = "",
      children,
      ...rest
    },
    ref
  ) => {
    const v = CARD_VARIANTS[variant];

    return (
      <div
        ref={ref}
        className={`
          relative overflow-hidden border p-4 font-mono
          ${v.bg} ${v.text} ${v.border}
          ${v.glow} before:pointer-events-none before:absolute before:inset-0
          ${corners === "notched" ? "clip-path-pixel-notch" : ""}
          ${className}
        `}
        style={{
          imageRendering: "pixelated",
        }}
        {...rest}
      >
        {/* Optional 16-bit Dither Grain Texture Layer */}
        {dithered && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)`,
              backgroundSize: "4px 4px",
            }}
          />
        )}

        {/* Book-trim corner highlights */}
        {corners === "trim" && (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 h-1 w-1 bg-[#e3b04b]/40" />
            <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 h-1 w-1 bg-[#e3b04b]/40" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-1 w-1 bg-[#e3b04b]/20" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-1 w-1 bg-[#e3b04b]/20" />
          </>
        )}

        {/* Card Header */}
        {header && (
          <div className="relative z-10 mb-3 border-b border-inherit/30 pb-2.5 font-semibold text-xs tracking-wider uppercase">
            {header}
          </div>
        )}

        {/* Card Body */}
        <div className="relative z-10">{children}</div>

        {/* Card Footer */}
        {footer && (
          <div className="relative z-10 mt-3 border-t border-inherit/30 pt-2 text-xs opacity-80">
            {footer}
          </div>
        )}
      </div>
    );
  }
);
PixelCard.displayName = "PixelCard";

/* ==========================================================================
   3. PIXEL BADGE
   ========================================================================== */

export type PixelBadgeVariant = "brass" | "moon" | "sage" | "rust" | "neutral";
export type PixelBadgeSize = "sm" | "md";

export interface PixelBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PixelBadgeVariant;
  size?: PixelBadgeSize;
  icon?: ReactNode;
  jewelCut?: boolean;
}

const BADGE_VARIANTS: Record<PixelBadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
  brass: {
    bg: "bg-[#e3b04b]/12",
    text: "text-[#e3b04b]",
    border: "border-[#e3b04b]/50 shadow-[1px_1px_0px_rgba(227,176,75,0.2)]",
    dot: "bg-[#e3b04b]",
  },
  moon: {
    bg: "bg-[#7fa8c9]/12",
    text: "text-[#7fa8c9]",
    border: "border-[#7fa8c9]/50 shadow-[1px_1px_0px_rgba(127,168,201,0.2)]",
    dot: "bg-[#7fa8c9]",
  },
  sage: {
    bg: "bg-[#8fbf98]/12",
    text: "text-[#8fbf98]",
    border: "border-[#8fbf98]/50 shadow-[1px_1px_0px_rgba(143,191,152,0.2)]",
    dot: "bg-[#8fbf98]",
  },
  rust: {
    bg: "bg-[#c96a5e]/12",
    text: "text-[#c96a5e]",
    border: "border-[#c96a5e]/50 shadow-[1px_1px_0px_rgba(201,106,94,0.2)]",
    dot: "bg-[#c96a5e]",
  },
  neutral: {
    bg: "bg-[#8e96ab]/12",
    text: "text-[#8e96ab]",
    border: "border-[#8e96ab]/40 shadow-[1px_1px_0px_rgba(142,150,171,0.15)]",
    dot: "bg-[#8e96ab]",
  },
};

export const PixelBadge = forwardRef<HTMLSpanElement, PixelBadgeProps>(
  (
    {
      variant = "brass",
      size = "sm",
      icon,
      jewelCut = true,
      className = "",
      children,
      ...rest
    },
    ref
  ) => {
    const v = BADGE_VARIANTS[variant];
    const isSm = size === "sm";

    return (
      <span
        ref={ref}
        className={`
          relative inline-flex items-center select-none font-mono uppercase tracking-wider
          border ${v.bg} ${v.text} ${v.border}
          ${isSm ? "px-1.5 py-0.5 text-[10px] gap-1 leading-none" : "px-2 py-0.5 text-xs gap-1.5 leading-tight"}
          ${jewelCut ? "before:absolute before:-top-px before:-left-px before:h-0.5 before:w-0.5 before:bg-inherit" : ""}
          ${className}
        `}
        style={{
          imageRendering: "pixelated",
        }}
        {...rest}
      >
        {icon ? (
          <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>
        ) : (
          <span className={`inline-block h-1.5 w-1.5 shrink-0 ${v.dot}`} />
        )}
        <span>{children}</span>
      </span>
    );
  }
);
PixelBadge.displayName = "PixelBadge";

/* ==========================================================================
   4. PIXEL TOOLTIP
   ========================================================================== */

export type PixelTooltipPosition = "top" | "bottom" | "left" | "right";

type TooltipTriggerProps = {
  onMouseEnter?: (event: React.MouseEvent) => void;
  onMouseLeave?: (event: React.MouseEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  "aria-describedby"?: string;
};

export interface PixelTooltipProps {
  text: ReactNode;
  children: ReactElement<TooltipTriggerProps>;
  position?: PixelTooltipPosition;
  delayMs?: number;
  className?: string;
  tooltipClassName?: string;
}

export function PixelTooltip({
  text,
  children,
  position = "top",
  delayMs = 120,
  className = "",
  tooltipClassName = "",
}: PixelTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const tooltipId = useId();

  const show = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisible(true), delayMs);
  };

  const hide = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  };

  const getPositionClasses = () => {
    switch (position) {
      case "bottom":
        return "top-full left-1/2 -translate-x-1/2 mt-2";
      case "left":
        return "right-full top-1/2 -translate-y-1/2 mr-2";
      case "right":
        return "left-full top-1/2 -translate-y-1/2 ml-2";
      case "top":
      default:
        return "bottom-full left-1/2 -translate-x-1/2 mb-2";
    }
  };

  const renderArrow = () => {
    const arrowBase = "absolute w-2 h-2 pointer-events-none fill-[#f2ede3] stroke-[#0b0f1a]";
    switch (position) {
      case "bottom":
        return (
          <svg className={`${arrowBase} -top-1 left-1/2 -translate-x-1/2 rotate-180`} viewBox="0 0 8 6">
            <polygon points="4,0 0,6 8,6" />
          </svg>
        );
      case "left":
        return (
          <svg className={`${arrowBase} -right-1 top-1/2 -translate-y-1/2 rotate-90`} viewBox="0 0 8 6">
            <polygon points="4,0 0,6 8,6" />
          </svg>
        );
      case "right":
        return (
          <svg className={`${arrowBase} -left-1 top-1/2 -translate-y-1/2 -rotate-90`} viewBox="0 0 8 6">
            <polygon points="4,0 0,6 8,6" />
          </svg>
        );
      case "top":
      default:
        return (
          <svg className={`${arrowBase} -bottom-1 left-1/2 -translate-x-1/2`} viewBox="0 0 8 6">
            <polygon points="4,0 0,6 8,6" />
          </svg>
        );
    }
  };

  const triggerProps = children.props;

  return (
    <div className={`relative inline-flex ${className}`}>
      {React.cloneElement(children, {
        "aria-describedby": visible ? tooltipId : undefined,
        onMouseEnter: (event) => {
          triggerProps.onMouseEnter?.(event);
          show();
        },
        onMouseLeave: (event) => {
          triggerProps.onMouseLeave?.(event);
          hide();
        },
        onFocus: (event) => {
          triggerProps.onFocus?.(event);
          show();
        },
        onBlur: (event) => {
          triggerProps.onBlur?.(event);
          hide();
        },
        onKeyDown: (event) => {
          triggerProps.onKeyDown?.(event);
          if (event.key === "Escape") hide();
        },
      })}

      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`
            absolute z-50 pointer-events-none whitespace-nowrap
            border border-[#0b0f1a] bg-[#f2ede3] px-2.5 py-1 text-xs font-mono text-[#0b0f1a]
            shadow-[2px_2px_0px_rgba(0,0,0,0.6)]
            ${getPositionClasses()}
            ${tooltipClassName}
          `}
          style={{ imageRendering: "pixelated" }}
        >
          {text}
          {renderArrow()}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   5. PIXEL PROGRESS
   ========================================================================== */

export type PixelProgressVariant = "brass" | "moon" | "sage" | "rust";
export type PixelProgressSize = "sm" | "md" | "lg";

export interface PixelProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  segments?: number;
  variant?: PixelProgressVariant;
  size?: PixelProgressSize;
  showLabel?: boolean;
  label?: string;
}

const PROGRESS_VARIANTS: Record<PixelProgressVariant, { active: string; glow: string; border: string }> = {
  brass: {
    active: "bg-[#e3b04b]",
    glow: "shadow-[0_0_4px_#e3b04b]",
    border: "border-[#c99236]/40",
  },
  moon: {
    active: "bg-[#7fa8c9]",
    glow: "shadow-[0_0_4px_#7fa8c9]",
    border: "border-[#7fa8c9]/40",
  },
  sage: {
    active: "bg-[#8fbf98]",
    glow: "shadow-[0_0_4px_#8fbf98]",
    border: "border-[#8fbf98]/40",
  },
  rust: {
    active: "bg-[#c96a5e]",
    glow: "shadow-[0_0_4px_#c96a5e]",
    border: "border-[#c96a5e]/40",
  },
};

const PROGRESS_SIZES: Record<PixelProgressSize, { height: string; segHeight: string }> = {
  sm: { height: "h-3", segHeight: "h-1.5" },
  md: { height: "h-4", segHeight: "h-2.5" },
  lg: { height: "h-6", segHeight: "h-4" },
};

export const PixelProgress = forwardRef<HTMLDivElement, PixelProgressProps>(
  (
    {
      value,
      max = 100,
      segments = 10,
      variant = "brass",
      size = "md",
      showLabel = false,
      label,
      className = "",
      ...rest
    },
    ref
  ) => {
    const safeMax = Math.max(1, max);
    const clampedValue = Math.max(0, Math.min(safeMax, value));
    const ratio = clampedValue / safeMax;
    const activeSegmentsCount = Math.round(ratio * segments);
    const v = PROGRESS_VARIANTS[variant];
    const s = PROGRESS_SIZES[size];
    const pct = Math.round(ratio * 100);

    return (
      <div ref={ref} className={`flex flex-col gap-1 font-mono ${className}`} {...rest}>
        {(label || showLabel) && (
          <div className="flex items-center justify-between text-xs text-[#8e96ab]">
            {label && <span>{label}</span>}
            {showLabel && <span className="ml-auto font-semibold text-[#f2ede3]">{pct}%</span>}
          </div>
        )}

        <div
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={safeMax}
          aria-label={label ?? "Progress"}
          className={`
            relative flex items-center gap-0.5 border bg-[#0b0f1a] p-0.5
            shadow-[inset_1px_1px_0px_#000000,1px_1px_0px_rgba(255,255,255,0.08)]
            ${v.border} ${s.height}
          `}
          style={{ imageRendering: "pixelated" }}
        >
          {Array.from({ length: segments }, (_, i) => {
            const isActive = i < activeSegmentsCount;
            return (
              <div
                key={i}
                aria-hidden="true"
                className={`
                  flex-1 transition-colors duration-75
                  ${s.segHeight}
                  ${isActive ? `${v.active} ${v.glow}` : "bg-[#1a2136]/50"}
                `}
              />
            );
          })}
        </div>
      </div>
    );
  }
);
PixelProgress.displayName = "PixelProgress";
