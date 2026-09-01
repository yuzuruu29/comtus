import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface CantorPixelTransitionProps {
  fromColor?: string;
  toColor?: string;
  accentColor?: string;
}

export default function CantorPixelTransition({
  fromColor = "var(--ground)",
  toColor = "var(--surface)",
  accentColor = "var(--brasspale)",
}: CantorPixelTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const COLS = 28;
    const ROWS = 5;
    const totalCells = COLS * ROWS;

    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${ROWS}, 18px)`;

    const cells: HTMLDivElement[] = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "c8-pixel-cell";
        cell.style.backgroundColor = fromColor;
        grid.appendChild(cell);
        cells.push(cell);
      }
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cells.forEach((c) => (c.style.backgroundColor = toColor));
      return;
    }

    // Shuffle array for procedural dissolve
    const shuffled = [...cells].sort(() => Math.random() - 0.5);

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        // Compressed range: the dissolve resolves while the divider enters the
        // viewport, so it never rests half-flipped mid-scroll.
        start: "top 92%",
        end: "top 45%",
        scrub: 0.4,
        onUpdate: (self) => {
          const progress = self.progress;
          const cutoff = Math.floor(progress * totalCells);

          shuffled.forEach((cell, idx) => {
            if (idx < cutoff) {
              cell.style.backgroundColor = idx % 5 === 0 ? accentColor : toColor;
            } else {
              cell.style.backgroundColor = fromColor;
            }
          });
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, [fromColor, toColor, accentColor]);

  return (
    <div ref={containerRef} className="c8-pixel-transition" aria-hidden="true">
      <div ref={gridRef} className="c8-pixel-grid" />
    </div>
  );
}
