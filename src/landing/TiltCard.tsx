import { useRef, type ReactNode } from "react";
import gsap from "gsap";

/** Double-bezel card with pointer-tracked glow and a whisper of tilt. */
export default function TiltCard({
  children,
  className = "",
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  /** Overrides the default roomy inner padding (dense grids pass e.g. "p-5"). */
  innerClassName?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

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
      rotateY: (px - 0.5) * 3.2,
      rotateX: (0.5 - py) * 2.4,
      transformPerspective: 900,
      duration: 0.6,
      ease: "power2.out",
    });
  };

  const onLeave = () => {
    if (innerRef.current)
      gsap.to(innerRef.current, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.9,
        ease: "elastic.out(1, 0.5)",
      });
  };

  return (
    <div
      ref={outerRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`group relative rounded-[1.9rem] border border-white/[0.07] bg-white/[0.035] p-1.5 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_18px_40px_rgba(11,15,26,0.45),0_0_32px_rgba(227,176,75,0.12)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${className}`}
    >
      {/* pointer glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[1.9rem] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--gx, 50%) var(--gy, 50%), rgba(227,176,75,0.10), transparent 65%)",
        }}
      />
      {/* gradient thread draws across the top edge on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 z-[2] h-[2px] origin-left scale-x-0 rounded-full grad-lamp transition-transform duration-[550ms] ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-x-100"
      />
      <div
        ref={innerRef}
        className={`relative h-full rounded-[1.55rem] bg-study ${innerClassName ?? "p-7 sm:p-9"} shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] will-change-transform`}
      >
        {children}
      </div>
    </div>
  );
}
