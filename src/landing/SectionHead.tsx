import type { ReactNode } from "react";

/** Numbered margin-note header: index + rule, display title, muted sub. */
export default function SectionHead({
  index,
  label,
  title,
  sub,
  center = false,
}: {
  index: string;
  label: string;
  title: ReactNode;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <div
        className={`label-mono flex items-center gap-4 ${center ? "justify-center" : ""}`}
      >
        <span className="h-px w-9 grad-lamp" />
        {index} — {label}
        {center && <span className="h-px w-9 grad-lamp" />}
      </div>
      <h2 className="mt-6 font-display text-[clamp(2.1rem,4.8vw,3.9rem)] font-[400] leading-[1.04] tracking-[-0.01em] text-parchment">
        {title}
      </h2>
      {sub && (
        <p
          className={`mt-5 max-w-xl text-[15.5px] leading-relaxed text-faded ${
            center ? "mx-auto" : ""
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
