import type { ReactNode } from "react";
import { Dialog, Field } from "../ui";

export function LampPulse({ label }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-muted">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-[var(--radius-pill)] bg-brass/50 [animation-duration:1.6s]" />
        <span className="relative inline-flex h-3 w-3 rounded-[var(--radius-pill)] bg-brass" />
      </span>
      {label && <span className="text-body">{label}</span>}
    </div>
  );
}

export const Modal = Dialog;
export { Field };

export const inputCls = "field-input";
export const btnGhost = "btn btn-md btn-secondary";
export const btnLamp = "btn btn-md btn-primary";

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="anim-shake rounded-[var(--radius-dialog)] border border-rust/30 bg-rust/[0.07] px-4 py-3 text-body leading-relaxed text-rust">
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
