import { cloneElement, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export interface MenuItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

type MenuTrigger = ReactElement<{
  onClick?: () => void;
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

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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
        onClick: () => setOpen((value) => !value),
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985, transition: { duration: 0.15 } }}
            transition={{ duration: 0.18 }}
            role="menu"
            aria-label={ariaLabel}
            className={`menu-panel absolute z-[80] mt-1.5 min-w-[10rem] ${align === "end" ? "right-0" : "left-0"}`}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className="menu-item"
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
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
