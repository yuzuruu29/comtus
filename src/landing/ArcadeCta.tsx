import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import gsap from "gsap";

type Spark = { id: number; x: number; y: number; sx: number; sy: number };

/** Magnetic wrapper with brass spark pixels. House ease only — no bounce. */
export default function ArcadeCta({
  children,
  className = "",
  magnetY = true,
}: {
  children: ReactNode;
  className?: string;
  magnetY?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.28, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.28, ease: "power3.out" });
    const strength = 12;

    const move = (e: globalThis.MouseEvent) => {
      const r = el.getBoundingClientRect();
      xTo(((e.clientX - (r.left + r.width / 2)) / r.width) * strength * 2);
      yTo(magnetY ? ((e.clientY - (r.top + r.height / 2)) / r.height) * strength * 2 : 0);
    };
    const leave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.45, ease: "power3.out" });
    };

    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
    };
  }, [magnetY]);

  const burst = (e: MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    const next: Spark[] = Array.from({ length: 6 }, () => {
      idRef.current += 1;
      return {
        id: idRef.current,
        x: ox,
        y: oy,
        sx: (Math.random() - 0.5) * 36,
        sy: -8 - Math.random() * 28,
      };
    });
    setSparks((prev) => [...prev, ...next]);
    window.setTimeout(() => {
      const ids = new Set(next.map((n) => n.id));
      setSparks((prev) => prev.filter((s) => !ids.has(s.id)));
    }, 560);
  };

  return (
    <div ref={ref} className={`arcade-cta ${className}`} onClick={burst} onMouseEnter={burst}>
      {children}
      <span className="spark-layer" aria-hidden>
        {sparks.map((s) => (
          <span
            key={s.id}
            className="pixel-spark"
            style={{
              left: s.x,
              top: s.y,
              ["--sx" as string]: `${s.sx}px`,
              ["--sy" as string]: `${s.sy}px`,
            }}
          />
        ))}
      </span>
    </div>
  );
}
