import { CircleNotch } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconEnd?: ReactNode;
}

const SPINNER_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16 };

/** Primary = --brass fill + --ground text (Spec 4 rule 6). Press physics come
 *  from --elev-card/--elev-lift plus an inset depth shadow, not a named
 *  class — see ui.css for why .btn-ink-press is not what this reaches for. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconEnd,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`btn btn-${variant} btn-${size} ${className}`.trim()}
      {...rest}
    >
      {loading && (
        <CircleNotch className="btn-spinner" size={SPINNER_SIZE[size]} weight="bold" aria-hidden="true" />
      )}
      {!loading && icon}
      {children}
      {!loading && iconEnd}
    </button>
  );
}
