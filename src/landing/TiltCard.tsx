import { useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { HOUSE_EASE } from "./pixelMotion";

interface Spark {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** Pixel arcade card: 3D pointer tracking tilt, double-bezel rim, spark particles on click. */
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
  const [sparks, setSparks] = useState<Spark[]>([]);

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
      rotateY: (px - 0.5) * 6,
      rotateX: (0.5 - py) * 5,
      transformPerspective: 1000,
      duration: 0.28,
      ease: HOUSE_EASE,
    });
  };

  const onLeave = () => {
    if (innerRef.current)
      gsap.to(innerRef.current, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.45,
        ease: HOUSE_EASE,
      });
  };

  const handleClick = (e: React.PointerEvent) => {
    setLit((v) => !v);
    const outer = outerRef.current;
    if (!outer) return;
    const r = outer.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;

    const newSparks: Spark[] = Array.from({ length: 4 }).map((_, i) => ({
      id: Date.now() + i,
      x: cx,
      y: cy,
      dx: (Math.random() - 0.5) * 40,
      dy: (Math.random() - 0.5) * 40 - 10,
    }));
    setSparks(newSparks);
    window.setTimeout(() => setSparks([]), 600);
  };

  return (
    <div
      ref={outerRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onPointerDown={handleClick}
      data-lit={lit}
      className={`tilt-card group relative border-2 border-white/[0.08] bg-white/[0.03] p-1.5 transition-shadow duration-300 hover:border-brass/40 ${className}`}
    >
      {/* Pointer-Follow Radial Lamplight Glow */}
      <div
        className="tilt-card-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(460px circle at var(--gx, 50%) var(--gy, 50%), rgba(227,176,75,0.18), transparent 65%)",
        }}
      />

      {/* Top Ignited Brass Edge Accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 z-[2] h-[2px] origin-left scale-x-0 grad-lamp transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100"
      />

      {/* Interactive Sparks */}
      {sparks.map((s) => (
        <span
          key={s.id}
          className="pixel-spark"
          style={
            {
              left: `${s.x}px`,
              top: `${s.y}px`,
              "--sx": `${s.dx}px`,
              "--sy": `${s.dy}px`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Inner Machined Bezel Container */}
      <div
        ref={innerRef}
        className={`tilt-card-inner relative h-full bg-study ${
          innerClassName ?? "p-7 sm:p-8"
        } shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] will-change-transform`}
      >
        {children}
      </div>
    </div>
  );
}
