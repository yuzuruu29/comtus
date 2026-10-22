import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EXIT, RISE_1, RISE_3, SOFT } from "../studio/fx";

const FUSE_TICK_MS = 200;

/** Moved from src/studio/Toast.tsx (Task 2.1) — unchanged besides the fx
 *  import path. src/studio/Toast.tsx re-exports this for old callers.
 *
 *  One enter/exit vocabulary with a hover/focus-paused brass fuse showing
 *  time remaining. Positioning stays with the caller via className because
 *  toasts legitimately dock differently (above the mobile tab bar vs
 *  bottom-right vs updater slot). Content is caller-owned so the undo
 *  button keeps its autofocus and role="status" text contracts. */
export function Toast({
  open,
  onClose,
  durationMs = 4000,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  durationMs?: number;
  className?: string;
  children: ReactNode;
}) {
  const [remaining, setRemaining] = useState(durationMs);
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Fresh open resets the fuse.
  useEffect(() => {
    if (open) setRemaining(durationMs);
  }, [open, durationMs]);

  // Tick-based countdown: survives fake timers in tests and stays honest
  // across background-tab throttling better than a deadline comparison.
  // The spent guard stops the interval once the fuse is burned so the
  // close effect below fires exactly once.
  useEffect(() => {
    if (!open || paused || durationMs <= 0 || remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((ms) => ms - FUSE_TICK_MS);
    }, FUSE_TICK_MS);
    return () => window.clearInterval(id);
  }, [open, paused, durationMs, remaining]);

  useEffect(() => {
    if (open && remaining <= 0) closeRef.current();
  }, [open, remaining]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: RISE_3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -RISE_1, transition: EXIT }}
          transition={SOFT}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className={`toast-card pointer-events-auto ${className}`}
        >
          {children}
          <span
            aria-hidden
            className="toast-fuse"
            style={{ ["--fuse-ms" as string]: `${durationMs}ms` }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
