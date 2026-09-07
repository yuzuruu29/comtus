import type { ReactNode } from "react";
import { Dialog, Field } from "../ui";

/** Re-export shim (Task 2.1). Field and Modal (now Dialog) moved to
 *  src/ui — every existing caller of "./ui" keeps working untouched.
 *  LampPulse, timeAgo, inputCls, btnGhost, btnLamp, and ErrorNote are not
 *  named in that move (no src/ui file was requested for them) and stay
 *  here unchanged. Delete this file once Task 2.5 migrates the remaining
 *  callers onto src/ui directly. */

export function LampPulse({ label }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-muted">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass/50 [animation-duration:1.6s]" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-brass" />
      </span>
      {label && <span className="text-body">{label}</span>}
    </div>
  );
}

export const Modal = Dialog;
export { Field };

export const inputCls =
  "w-full rounded-[var(--radius-field)] border border-hairline bg-ground/60 px-3.5 py-2.5 text-[16px] text-ink placeholder:text-muted/60 outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-brass/35 focus:border-brass/70 focus:shadow-[0_0_0_1px_rgba(227,176,75,0.4),0_0_18px_-2px_rgba(227,176,75,0.28)] sm:text-body";

export const btnGhost =
  "inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-hairline bg-ink/[0.03] px-5 py-2.5 text-body font-medium text-ink/90 transition-all duration-fast hover:border-hairline-strong hover:bg-ink/[0.07] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 sm:min-h-[38px]";

export const btnLamp =
  "relative inline-flex min-h-[44px] items-center justify-center overflow-hidden rounded-[var(--radius-control)] grad-lamp px-5 py-2.5 text-body font-semibold text-night transition-all duration-fast hover:brightness-[1.06] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 sm:min-h-[38px]";

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="anim-shake rounded-xl border border-rust/30 bg-rust/[0.07] px-4 py-3 text-body leading-relaxed text-rust">
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
