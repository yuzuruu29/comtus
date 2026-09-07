import type { ReactNode } from "react";

/** Moved from src/studio/ui.tsx (Task 2.1) — unchanged. */
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
    <div className="block">
      <div className="label-mono !text-[10px] mb-2 select-none">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-label text-muted">{hint}</div>}
    </div>
  );
}
