import { X } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ChipTone = "neutral" | "brass" | "moon" | "sage" | "rust" | "candle";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  onRemove?: () => void;
  tone?: ChipTone;
  children: ReactNode;
}

/** Selectable/removable fact chip. The remove control is a sibling button,
 *  not nested inside the chip's own button — a <button> inside a <button>
 *  is invalid HTML and unreachable by keyboard. */
export function Chip({
  selected = false,
  onRemove,
  tone = "neutral",
  className = "",
  children,
  type = "button",
  ...rest
}: ChipProps) {
  const toneClass = tone === "neutral" ? "" : `chip-tone-${tone}`;
  return (
    <span className={`chip ${toneClass} ${selected ? "chip-selected" : ""} ${className}`.trim()}>
      <button type={type} aria-pressed={selected} className="chip-body" {...rest}>
        {children}
      </button>
      {onRemove && (
        <button
          type="button"
          className="chip-remove"
          aria-label="Remove"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <X size={12} weight="bold" />
        </button>
      )}
    </span>
  );
}
