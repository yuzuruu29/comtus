import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { ENTER, EXIT, SOFT } from "../studio/fx";
import { ICON } from "./iconScale";

/** Moved from src/studio/ui.tsx's Modal (Task 2.1) — same API, renamed.
 *  src/studio/ui.tsx re-exports this as `Modal` for old callers.
 *  Use data-autofocus on a child for initial focus; native autoFocus runs
 *  before the dialog can capture its opener for focus restoration. */

const dialogStack: symbol[] = [];

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide = false,
  onEscape,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Runs first on Escape; return true when it closed something smaller
   *  inside the dialog (a popover), so the dialog itself stays open. */
  onEscape?: () => boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const instanceRef = useRef(Symbol("comtus-dialog"));
  const onCloseRef = useRef(onClose);
  const onEscapeRef = useRef(onEscape);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    onEscapeRef.current = onEscape;
  }, [onClose, onEscape]);

  useEffect(() => {
    if (!open) return;
    const instance = instanceRef.current;
    dialogStack.push(instance);
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      if (!panelRef.current) return;
      // Do not steal focus if the user already started interacting with the panel.
      if (document.activeElement && panelRef.current.contains(document.activeElement)) {
        return;
      }
      // Resolve initial focus only after capturing the opener above.
      const auto = panelRef.current.querySelector<HTMLElement>('[data-autofocus]:not([disabled])');
      if (auto) {
        auto.focus({ preventScroll: true });
        return;
      }
      const input = panelRef.current.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])',
      );
      if (input) {
        input.focus({ preventScroll: true });
        return;
      }
      const first = panelRef.current.querySelector<HTMLElement>(
        'button:not([disabled]):not([aria-label="Close"]), [href], [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panelRef.current).focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (dialogStack.at(-1) !== instance) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (onEscapeRef.current?.()) return;
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => element.offsetParent !== null);
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
      const index = dialogStack.lastIndexOf(instance);
      if (index !== -1) dialogStack.splice(index, 1);
      const previous = restoreFocusRef.current;
      if (previous?.isConnected) previous.focus();
      restoreFocusRef.current = null;
    };
  }, [open]);

  // Portal to body so the overlay isn't trapped in a pane stacking
  // context (chat's motion transform + workspace z-10). Otherwise the
  // composer paints on top of quiz/exam dialogs and their Check control
  // collides with the effort chip.
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[220] flex items-end justify-center sm:items-center">
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: EXIT }}
            transition={SOFT}
            className="pointer-events-auto absolute inset-0"
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label={typeof title === "string" ? `Close ${title}` : "Close dialog"}
              className="absolute inset-0 border-0 bg-ground/80 backdrop-blur-sm"
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
            initial={ENTER.initial}
            animate={ENTER.animate}
            exit={{ ...ENTER.exit, transition: EXIT }}
            transition={SOFT}
            className={`pointer-events-auto relative z-[90] flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-[var(--radius-dialog)] border border-hairline bg-surface pb-[calc(1.25rem+var(--sab))] shadow-modal sm:rounded-[var(--radius-dialog)] sm:pb-0 ${
              wide ? "sm:max-w-3xl" : "sm:max-w-xl"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-6 sm:py-4">
              <h2 id={titleId} className="font-display text-heading font-[450] text-ink">{title}</h2>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-muted transition-all duration-med hover:rotate-90 hover:bg-ink/5 hover:text-ink active:scale-95"
                aria-label="Close"
              >
                <X size={ICON.lg} weight="light" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
