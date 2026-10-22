import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { EXIT, SOFT } from "../studio/fx";
import { ICON } from "./iconScale";

const sheetStack: symbol[] = [];

/** Right-side panel: focus-trapped, closes on Escape, portals to body so it
 *  can't be clipped by an ancestor's overflow/transform stacking context
 *  (same reasoning as Dialog). */
export function Sheet({
  open,
  onClose,
  title,
  width = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: "md" | "lg";
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const instanceRef = useRef(Symbol("comtus-sheet"));
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const instance = instanceRef.current;
    sheetStack.push(instance);
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      if (!panelRef.current) return;
      if (document.activeElement && panelRef.current.contains(document.activeElement)) return;
      const first = panelRef.current.querySelector<HTMLElement>(
        'button:not([disabled]):not([aria-label="Close"]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panelRef.current).focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (sheetStack.at(-1) !== instance) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // offsetParent is always null under jsdom (no layout engine), so a
      // computed-style check stands in for "not visually hidden" — it works
      // in both the real browser and the test environment.
      const isVisible = (element: HTMLElement) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      };
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter(isVisible);
      if (focusable.length === 0) {
        e.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey, true);
      const index = sheetStack.lastIndexOf(instance);
      if (index !== -1) sheetStack.splice(index, 1);
      const previous = restoreFocusRef.current;
      if (previous?.isConnected) previous.focus();
      restoreFocusRef.current = null;
    };
  }, [open]);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[220] flex justify-end">
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: EXIT }}
            transition={SOFT}
            className="sheet-scrim pointer-events-auto absolute inset-0"
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Close ${title}`}
              className="absolute inset-0 border-0 bg-transparent"
              onClick={onClose}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%", transition: EXIT }}
            transition={SOFT}
            className={`sheet-panel pointer-events-auto relative flex h-full w-full flex-col overflow-hidden pb-[calc(1rem+var(--sab))] pt-[var(--sat)] pr-[var(--sar)] ${
              width === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <h2 id={titleId} className="font-display text-heading font-[450] text-ink">
                {title}
              </h2>
              <button onClick={onClose} className="icon-btn icon-btn-ghost icon-btn-md" aria-label="Close">
                <X size={ICON.lg} weight="light" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
