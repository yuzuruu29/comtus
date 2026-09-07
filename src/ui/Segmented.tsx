import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

const NAV_KEYS = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];

/** role="radiogroup" of role="radio" options with a roving tabindex and
 *  arrow-key navigation, per the WAI-ARIA radio group pattern. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  "aria-label": string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const focusOptionAt = (index: number) => {
    rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!NAV_KEYS.includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    onChange(options[next].value);
    focusOptionAt(next);
  };

  return (
    <div ref={rootRef} role="radiogroup" aria-label={ariaLabel} className="segmented">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={`segmented-option ${selected ? "segmented-option-selected" : ""}`.trim()}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
