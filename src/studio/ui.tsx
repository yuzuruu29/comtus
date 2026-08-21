import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { SOFT } from "./fx";

/** Shared studio primitives — quiet, warm, in-palette. */

export function LampPulse({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-faded">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass/50 [animation-duration:1.6s]" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-brass" />
      </span>
      {label && <span className="text-[13px]">{label}</span>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // The overlay container stays mounted so AnimatePresence can play the
  // exit; it's click-transparent when empty (pointer-events-none).
  return (
    <div className="pointer-events-none fixed inset-0 z-[220] flex items-end justify-center sm:items-center">
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.22 }}
            className="pointer-events-auto absolute inset-0"
          >
            <div className="absolute inset-0 bg-night/80 backdrop-blur-sm" onClick={onClose} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.18 } }}
            transition={SOFT}
            className={`pointer-events-auto relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-[1.6rem] border border-white/10 bg-study pb-[calc(1.25rem+var(--sab))] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] sm:rounded-[1.6rem] sm:pb-0 ${
              wide ? "sm:max-w-3xl" : "sm:max-w-xl"
            }`}
            role="dialog"
            aria-modal
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
              <div className="font-display text-lg font-[450] text-parchment">{title}</div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-faded transition-all duration-300 hover:rotate-90 hover:bg-white/5 hover:text-parchment active:scale-95"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="label-mono !text-[10px] mb-2">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-[12px] text-faded">{hint}</div>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-white/10 bg-night/60 px-3.5 py-2.5 text-[16px] text-parchment placeholder:text-faded/60 outline-none transition-[border-color,box-shadow] duration-200 focus:border-brass/50 focus:shadow-[0_0_0_3px_rgba(227,176,75,0.09)] sm:text-[14px]";

export const btnGhost =
  "inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-[13px] font-medium text-parchment/90 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 sm:min-h-[38px]";

export const btnLamp =
  "inline-flex min-h-[44px] items-center justify-center rounded-full grad-lamp px-5 py-2.5 text-[13px] font-semibold text-night transition-all duration-200 hover:shadow-[0_8px_30px_rgba(227,176,75,0.3)] hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 disabled:hover:shadow-none sm:min-h-[38px]";

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="anim-shake rounded-xl border border-rust/30 bg-rust/[0.07] px-4 py-3 text-[13px] leading-relaxed text-rust">
      {children}
    </div>
  );
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
