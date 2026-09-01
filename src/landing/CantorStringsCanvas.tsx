import { useEffect, useRef } from "react";

interface Point {
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
}

interface StringLine {
  points: Point[];
  baseY: number;
  amplitude: number;
  frequency: number;
  phase: number;
  accent: boolean;
  alpha: number;
}

function tokenRgba(token: string, alpha: number): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : "";
  if (hex.length !== 6) {
    return token === "--brass"
      ? `rgba(165, 115, 28, ${alpha})`
      : `rgba(11, 19, 43, ${alpha})`;
  }
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CantorStringsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;

    const strings: StringLine[] = [];
    const NUM_STRINGS = 16;
    const POINTS_PER_STRING = 32;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Re-initialize strings
      strings.length = 0;
      const stepY = height / (NUM_STRINGS + 1);

      for (let i = 0; i < NUM_STRINGS; i++) {
        const baseY = stepY * (i + 1);
        const points: Point[] = [];
        const stepX = width / (POINTS_PER_STRING - 1);

        for (let j = 0; j < POINTS_PER_STRING; j++) {
          const px = stepX * j;
          points.push({
            x: px,
            y: baseY,
            ox: px,
            oy: baseY,
            vx: 0,
            vy: 0,
          });
        }

        const alpha = 0.1 + (i / NUM_STRINGS) * 0.22;
        strings.push({
          points,
          baseY,
          amplitude: 8 + Math.sin(i * 0.5) * 6,
          frequency: 0.002 + i * 0.0004,
          phase: i * 0.4,
          accent: i % 3 === 0,
          alpha,
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let time = 0;

    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Physics update and drawing
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseActive = mouseRef.current.active;

      strings.forEach((str, sIdx) => {
        ctx.beginPath();
        ctx.strokeStyle = str.accent
          ? tokenRgba("--brass", str.alpha + 0.12)
          : tokenRgba("--ink", str.alpha);
        ctx.lineWidth = sIdx % 3 === 0 ? 1.5 : 1;

        const pts = str.points;

        for (let j = 0; j < pts.length; j++) {
          const pt = pts[j];

          // Natural harmonic wave
          const waveY = Math.sin(time * str.frequency + str.phase + j * 0.25) * str.amplitude;
          const targetY = pt.oy + waveY;

          // Mouse spring repulsion
          if (mouseActive) {
            const dx = mx - pt.x;
            const dy = my - pt.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const radius = 140;

            if (dist < radius) {
              const force = (1 - dist / radius) * 45;
              const angle = Math.atan2(dy, dx);
              pt.vx -= Math.cos(angle) * force * 0.06;
              pt.vy -= Math.sin(angle) * force * 0.06;
            }
          }

          // Spring dampening
          const k = 0.08;
          const damping = 0.88;
          const dy = targetY - pt.y;
          pt.vy += dy * k;
          pt.vy *= damping;
          pt.y += pt.vy;

          const dx = pt.ox - pt.x;
          pt.vx += dx * k;
          pt.vx *= damping;
          pt.x += pt.vx;
        }

        // Draw smooth bezier curve through points
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let j = 1; j < pts.length - 2; j++) {
          const xc = (pts[j].x + pts[j + 1].x) / 2;
          const yc = (pts[j].y + pts[j + 1].y) / 2;
          ctx.quadraticCurveTo(pts[j].x, pts[j].y, xc, yc);
        }
        if (pts.length > 2) {
          ctx.quadraticCurveTo(
            pts[pts.length - 2].x,
            pts[pts.length - 2].y,
            pts[pts.length - 1].x,
            pts[pts.length - 1].y
          );
        }
        ctx.stroke();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div className="c8-hero-canvas-wrap">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        aria-hidden="true"
      />
    </div>
  );
}
