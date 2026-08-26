import { useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { HOUSE_EASE } from "./pixelMotion";

/** Pixel arcade card: pointer glow, stepped press, click to light. */
export default function TiltCard({
  children,
  className = "",
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);

  const onMove = (e: React.MouseEvent) => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const r = outer.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    outer.style.setProperty("--gx", `${px * 100}%`);
    outer.style.setProperty("--gy", `${py * 100}%`);
    if (window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches)
      return;
    gsap.to(inner, {
      rotateY: (px - 0.5) * 4,
      rotateX: (0.5 - py) * 3,
      transformPerspective: 900,
      duration: 0.28,
      ease: HOUSE_EASE,
    });
  };

  const onLeave = () => {
    if (innerRef.current)
      gsap.to(innerRef.current, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.4,
        ease: HOUSE_EASE,
      });
  };

  return (
    <div
      ref={outerRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => setLit((v) => !v)}
      data-lit={lit}
      className={`tilt-card group relative border border-white/[0.07] bg-white/[0.035] p-1.5 ${className}`}
    >
      <div
        className="tilt-card-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--gx, 50%) var(--gy, 50%), rgba(227,176,75,0.14), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 z-[2] h-[2px] origin-left scale-x-0 grad-lamp transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100"
      />
      <div
        ref={innerRef}
        className={`tilt-card-inner relative h-full bg-study ${innerClassName ?? "p-7 sm:p-9"} shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] will-change-transform`}
      >
        {children}
      </div>
    </div>
  );
}
