import { useEffect, useRef } from "react";

type Mote = { x: number; y: number; r: number; vy: number; sway: number; phase: number };
type Node = { x: number; y: number; vx: number; vy: number; tw: number };

/** The lamplight field: a warm cone from above, dust motes rising through
 *  it, and a quiet constellation of idea-nodes that leans toward the
 *  pointer. Static single frame under reduced motion. */
export default function LampCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const isMobile = window.innerWidth < 768 || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;
    const pointer = { x: -9999, y: -9999 };

    let motes: Mote[] = [];
    let nodes: Node[] = [];

    const seed = () => {
      const density = isMobile ? 48000 : 26000;
      const count = Math.round((w * h) / density);
      const maxMotes = isMobile ? 38 : 90;
      const minMotes = isMobile ? 18 : 36;
      motes = Array.from({ length: Math.min(maxMotes, Math.max(minMotes, count)) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * (isMobile ? 1.1 : 1.5),
        vy: 0.12 + Math.random() * 0.3,
        sway: 0.3 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
      }));
      const nCount = isMobile ? 10 : w < 1024 ? 16 : 24;
      nodes = Array.from({ length: nCount }, () => ({
        x: w * 0.08 + Math.random() * w * 0.84,
        y: h * 0.38 + Math.random() * h * 0.55,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduced) draw(0);
    };

    const coneAlpha = (x: number, y: number) => {
      // Warmth falls off with distance from the lamp axis (top center).
      const axisX = w / 2;
      const dx = Math.abs(x - axisX);
      const spread = 60 + (y / h) * w * 0.34;
      const lateral = Math.max(0, 1 - dx / spread);
      const vertical = Math.max(0.12, 1 - y / (h * 1.15));
      return lateral * lateral * vertical;
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);

      // Lamp cone — layered radial wash with a slow breath.
      const flicker = 0.92 + Math.sin(time * 0.0011) * 0.03 + Math.sin(time * 0.0043) * 0.012;
      const cx = w / 2;
      const lamp = ctx.createRadialGradient(cx, -h * 0.12, 0, cx, -h * 0.12, h * 1.15);
      lamp.addColorStop(0, `rgba(227, 176, 75, ${0.16 * flicker})`);
      lamp.addColorStop(0.35, `rgba(201, 146, 54, ${0.07 * flicker})`);
      lamp.addColorStop(0.7, `rgba(42, 54, 84, ${0.1 * flicker})`);
      lamp.addColorStop(1, "rgba(11, 15, 26, 0)");
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, w, h);

      // Constellation of idea-nodes.
      for (const n of nodes) {
        if (!reduced) {
          n.x += n.vx;
          n.y += n.vy;
          const dx = pointer.x - n.x;
          const dy = pointer.y - n.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 160 * 160 && d2 > 1) {
            const d = Math.sqrt(d2);
            n.x += (dx / d) * 0.22;
            n.y += (dy / d) * 0.22;
          }
          if (n.x < 20 || n.x > w - 20) n.vx *= -1;
          if (n.y < h * 0.34 || n.y > h - 24) n.vy *= -1;
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < 150) {
            const alpha = (1 - d / 150) * 0.14;
            ctx.strokeStyle = `rgba(127, 168, 201, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        const tw = 0.5 + 0.5 * Math.sin(time * 0.0016 + n.tw);
        const glow = 3 + tw * 2;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glow * 4);
        g.addColorStop(0, `rgba(240, 206, 140, ${0.5 * tw + 0.15})`);
        g.addColorStop(1, "rgba(240, 206, 140, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, glow * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(242, 237, 227, ${0.55 + tw * 0.35})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Motes rising through the light.
      for (const m of motes) {
        if (!reduced) {
          m.y -= m.vy;
          m.x += Math.sin(time * 0.0006 + m.phase) * m.sway * 0.24;
          if (m.y < -8) {
            m.y = h + 8;
            m.x = Math.random() * w;
          }
        }
        const warm = coneAlpha(m.x, m.y);
        ctx.fillStyle = `rgba(${232 + warm * 18}, ${200 + warm * 30}, ${140 + warm * 60}, ${
          0.1 + warm * 0.5
        })`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (time: number) => {
      if (!running) return;
      draw(time);
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (reduced) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", onLeave);
    }

    // Pause when the hero scrolls away or the tab hides.
    const io = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && !document.hidden;
      if (visible && !running && !reduced) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else if (!visible && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(canvas);
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduced) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
