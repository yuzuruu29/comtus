import { cloneElement, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EXIT, POPOVER, SOFT } from "../studio/fx";

export interface MenuItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

type MenuTrigger = ReactElement<{
  onClick?: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  "aria-haspopup"?: string;
  "aria-expanded"?: boolean;
}>;

/** Trigger stays the caller's own interactive element (a Button / IconButton)
 *  — Menu clones onClick/aria-* onto it rather than wrapping it in another
 *  button, which would be invalid, unreachable-by-keyboard markup. */
export function Menu({
  trigger,
  items,
  align = "start",
  "aria-label": ariaLabel,
}: {
  trigger: MenuTrigger;
  items: MenuItem[];
  align?: "start" | "end";
  "aria-label": string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const openAtEnd = useRef(false);

  useEffect(() => {
    if (!open) return;
    const entries = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    entries?.[openAtEnd.current ? entries.length - 1 : 0]?.focus();
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>(":scope > button")?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      {cloneElement(trigger, {
        onClick: () => {
          openAtEnd.current = false;
          setOpen((value) => !value);
        },
        onKeyDown: (event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          openAtEnd.current = event.key === "ArrowUp";
          setOpen(true);
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={POPOVER.initial}
            animate={POPOVER.animate}
            exit={{ ...POPOVER.exit, transition: EXIT }}
            transition={SOFT}
            role="menu"
            aria-label={ariaLabel}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                setOpen(false);
                rootRef.current?.querySelector<HTMLButtonElement>(":scope > button")?.focus();
                return;
              }
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const entries = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
              const current = entries.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length;
              entries[next]?.focus();
            }}
            className={`menu-panel absolute z-[80] mt-1.5 min-w-[10rem] ${align === "end" ? "right-0" : "left-0"}`}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                className="menu-item"
                onClick={() => {
                  setOpen(false);
                  rootRef.current?.querySelector<HTMLButtonElement>(":scope > button")?.focus();
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
