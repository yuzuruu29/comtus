import { CircleNotch } from "@phosphor-icons/react";
import type { ButtonProps, ButtonSize } from "./Button";

const SPINNER_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16 };

/** Icon-only control. aria-label is required — there is no visible text
 *  fallback for a screen reader to read otherwise. */
export function IconButton({
  variant = "ghost",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps & { "aria-label": string }) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`icon-btn icon-btn-${variant} icon-btn-${size} ${className}`.trim()}
      {...rest}
    >
      {loading ? (
        <CircleNotch className="btn-spinner" size={SPINNER_SIZE[size]} weight="bold" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  );
}
