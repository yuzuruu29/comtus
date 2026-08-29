import { useEffect, useRef, useState } from "react";

export default function CustomCursor() {
  const dotWrapRef = useRef<HTMLDivElement>(null);
  const ringWrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced || !dotWrapRef.current || !ringWrapRef.current) return;

    document.body.classList.add("has-custom-cursor");

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let rafId: number;

    const dotWrap = dotWrapRef.current;
    const ringWrap = ringWrapRef.current;

    // Instant update for laser dot + smooth interpolation for reticle ring
    const render = () => {
      // Direct positioning on the dot wrapper
      dotWrap.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;

      // Smooth lag-free lerp on ring wrapper
      ringX += (mouseX - ringX) * 0.22;
      ringY += (mouseY - ringY) * 0.22;
      ringWrap.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

      rafId = requestAnimationFrame(render);
    };

    const handlePointerMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) setVisible(true);
    };

    const handlePointerOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t) return;
      const isInteractive = !!t.closest(
        "a, button, [role='button'], input, textarea, select, .c8-bento-card, .c8-btn, .c8-curriculum-item, [data-cursor], article, .faq-item, .model-card, .tab-btn"
      );
      setHovered(isInteractive);
    };

    const handlePointerDown = () => setClicking(true);
    const handlePointerUp = () => setClicking(false);

    const handleMouseLeave = () => setVisible(false);
    const handleMouseEnter = () => setVisible(true);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mouseover", handlePointerOver, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mouseover", handlePointerOver);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.body.classList.remove("has-custom-cursor");
    };
  }, [visible]);

  return (
    <>
      {/* 1. Laser Core Dot Wrapper (Instant Tracking) */}
      <div
        ref={dotWrapRef}
        className={`c8-cursor-pos c8-cursor-dot-wrap ${visible ? "is-visible" : ""}`}
        aria-hidden="true"
      >
        <div
          className={`c8-cursor-dot-inner ${hovered ? "is-hover" : ""} ${clicking ? "is-click" : ""}`}
        />
      </div>

      {/* 2. Reticle Ring Wrapper (Fluid Interpolation Tracking) */}
      <div
        ref={ringWrapRef}
        className={`c8-cursor-pos c8-cursor-ring-wrap ${visible ? "is-visible" : ""}`}
        aria-hidden="true"
      >
        <div
          className={`c8-cursor-ring-inner ${hovered ? "is-hover" : ""} ${clicking ? "is-click" : ""}`}
        >
          <span className="c8-reticle-tick top" />
          <span className="c8-reticle-tick right" />
          <span className="c8-reticle-tick bottom" />
          <span className="c8-reticle-tick left" />
        </div>
      </div>
    </>
  );
}
