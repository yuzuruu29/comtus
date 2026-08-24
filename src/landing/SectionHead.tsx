import type { ReactNode } from "react";
import SectionTorch from "./SectionTorch";

/** Numbered margin-note header: index + rule, display title, muted sub, plus interactive rekindling sconce. */
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
        className={`label-mono flex items-center gap-3 ${center ? "justify-center" : ""}`}
      >
        <SectionTorch sectionId={index} />
        <span className="h-px w-6 grad-lamp" />
        <span>{index} — {label}</span>
        {center && <span className="h-px w-6 grad-lamp" />}
      </div>
      <h2 className="mt-5 font-display text-[clamp(2.1rem,4.8vw,3.9rem)] font-[400] leading-[1.04] tracking-[-0.01em] text-parchment">
        {title}
      </h2>
      {sub && (
        <p
          className={`mt-4 max-w-xl text-[15.5px] leading-relaxed text-faded ${
            center ? "mx-auto" : ""
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
