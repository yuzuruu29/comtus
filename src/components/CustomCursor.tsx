import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import PixelTorch from "./PixelTorch";

/**
 * Animated Torch Cursor & Brass Trail.
 * - In Torch Mode (`body.torch-on`), renders the pixel-art torch cursor with active flame & sparks.
 * - In Standard Mode, renders the minimal brass dot + lagging ring.
 * - Hidden on coarse pointers / touch screens.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const torchRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced || !dotRef.current || !ringRef.current || !torchRef.current) return;

    document.body.classList.add("has-custom-cursor");
    const dot = dotRef.current;
    const ring = ringRef.current;
    const torch = torchRef.current;

    const dotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power2.out" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power2.out" });
    const torchX = gsap.quickTo(torch, "x", { duration: 0.05, ease: "power2.out" });
    const torchY = gsap.quickTo(torch, "y", { duration: 0.05, ease: "power2.out" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.42, ease: "power2.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.42, ease: "power2.out" });

    const move = (e: MouseEvent) => {
      dotX(e.clientX);
      dotY(e.clientY);
      torchX(e.clientX);
      torchY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
    };

    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const hoverable = !!t.closest("a, button, [data-cursor], [data-torch-sconce]");
      setIsActive(hoverable);
      ring.classList.toggle("is-active", hoverable);
      torch.classList.toggle("is-active", hoverable);
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseover", over, { passive: true });
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      document.body.classList.remove("has-custom-cursor");
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden />
      <div ref={ringRef} className="cursor-ring" aria-hidden />
      <div ref={torchRef} className="cursor-torch" aria-hidden>
        <PixelTorch
          size={38}
          isLit={true}
          isIgniting={isActive}
          variant="handheld"
        />
      </div>
    </>
  );
}
