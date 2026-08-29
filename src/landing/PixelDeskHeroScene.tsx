import { useEffect, useRef, useState, useId, type PointerEvent as ReactPointerEvent } from "react";
import { useLandingPlay } from "./LandingPlay";
import { playProceduralSfx } from "../studio/companion/sfx";

interface MoteParticle {
  id: number;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  speedY: number;
  swaySpeed: number;
  swayAmount: number;
  phase: number;
  color: string;
}

interface StarParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: string;
  duration: string;
}

interface RainParticle {
  id: number;
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

/**
 * 16-Bit Cozy Pixel Bookshop Hero Scene.
 *
 * Implements the signature Comtus study desk:
 * - Warm mahogany/leather desk with brass corner brackets.
 * - Glowing brass lamp with reactive light cone and interactive poke/ignite.
 * - Floating golden dust motes that softly disperse on cursor hover.
 * - Window overlooking a cozy night with twinkling pixel stars and drifting rain.
 * - Antique tomes with colorful spines and an open notebook with stepped page shimmer.
 * - Steaming ceramic mug of tea/coffee with rising 16-bit steam puffs.
 * - Full reduced-motion safety adhering to the 16-color master palette.
 */
export default function PixelDeskHeroScene({ className = "" }: { className?: string }) {
  const { lampLit, mood, pokeCount, poke, ignite } = useLandingPlay();
  const [lampHovered, setLampHovered] = useState(false);
  const [bookHovered, setBookHovered] = useState(false);
  const [mugHovered, setMugHovered] = useState(false);
  const [shimmerActive, setShimmerActive] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerPos = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const filterId = useId();

  // Procedural Stars in the Night Window
  const stars: StarParticle[] = useRef<StarParticle[]>([
    { id: 1, x: 28, y: 32, size: 3, delay: "0s", duration: "2.4s" },
    { id: 2, x: 64, y: 18, size: 2, delay: "0.8s", duration: "3.1s" },
    { id: 3, x: 92, y: 48, size: 4, delay: "1.5s", duration: "2.8s" },
    { id: 4, x: 130, y: 24, size: 2, delay: "0.3s", duration: "3.6s" },
    { id: 5, x: 172, y: 56, size: 3, delay: "1.1s", duration: "2.2s" },
    { id: 6, x: 210, y: 20, size: 4, delay: "1.9s", duration: "3.4s" },
    { id: 7, x: 254, y: 38, size: 2, delay: "0.6s", duration: "2.7s" },
    { id: 8, x: 288, y: 16, size: 3, delay: "1.3s", duration: "3.0s" },
    { id: 9, x: 320, y: 50, size: 2, delay: "0.4s", duration: "2.5s" },
    { id: 10, x: 350, y: 28, size: 3, delay: "1.7s", duration: "3.2s" },
    { id: 11, x: 390, y: 14, size: 4, delay: "0.9s", duration: "2.9s" },
    { id: 12, x: 420, y: 44, size: 2, delay: "1.4s", duration: "3.5s" },
  ]).current;

  // Drifting Rain Lines in the Window
  const rainStreaks: RainParticle[] = useRef<RainParticle[]>([
    { id: 1, x: 35, y: 10, length: 14, speed: 1.2, opacity: 0.35 },
    { id: 2, x: 80, y: 25, length: 18, speed: 1.5, opacity: 0.45 },
    { id: 3, x: 145, y: 5, length: 12, speed: 1.1, opacity: 0.3 },
    { id: 4, x: 200, y: 30, length: 16, speed: 1.4, opacity: 0.4 },
    { id: 5, x: 260, y: 15, length: 20, speed: 1.6, opacity: 0.5 },
    { id: 6, x: 315, y: 40, length: 14, speed: 1.3, opacity: 0.35 },
    { id: 7, x: 375, y: 8, length: 18, speed: 1.5, opacity: 0.45 },
    { id: 8, x: 425, y: 28, length: 12, speed: 1.2, opacity: 0.3 },
  ]).current;

  // Interactive Dust Motes in the Lamplight (Canvas Layer)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animId = 0;
    let isMounted = true;

    const width = 800;
    const height = 450;
    canvas.width = width;
    canvas.height = height;

    const MOTE_COLORS = ["#E3B04B", "#F7D486", "#F5F0E6", "#FF9E43", "#E8DEC8"];
    const motes: MoteParticle[] = Array.from({ length: 32 }, (_, i) => {
      const bx = 420 + Math.random() * 320;
      const by = 80 + Math.random() * 320;
      return {
        id: i,
        x: bx,
        y: by,
        baseX: bx,
        baseY: by,
        size: Math.random() > 0.6 ? 2.5 : 1.5,
        speedY: 0.2 + Math.random() * 0.4,
        swaySpeed: 0.015 + Math.random() * 0.02,
        swayAmount: 12 + Math.random() * 20,
        phase: Math.random() * Math.PI * 2,
        color: MOTE_COLORS[Math.floor(Math.random() * MOTE_COLORS.length)],
      };
    });

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      for (const m of motes) {
        ctx.fillStyle = m.color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      }
    };

    if (reduced) {
      drawStatic();
      return;
    }

    let tick = 0;
    const render = () => {
      if (!isMounted) return;
      ctx.clearRect(0, 0, width, height);
      tick += 1;

      const px = pointerPos.current.x;
      const py = pointerPos.current.y;

      for (const m of motes) {
        // Vertical upward drift
        m.y -= m.speedY;
        if (m.y < 70) {
          m.y = 410;
          m.x = 420 + Math.random() * 320;
        }

        // Horizontal sinusoidal sway
        const targetX = m.baseX + Math.sin(tick * m.swaySpeed + m.phase) * m.swayAmount;
        m.x += (targetX - m.x) * 0.05;

        // Pointer repulsion / curiosity reaction
        const dx = m.x - px;
        const dy = m.y - py;
        const distSq = dx * dx + dy * dy;
        if (distSq < 9000 && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / 95) * 1.8;
          m.x += (dx / dist) * force;
          m.y += (dy / dist) * force;
        }

        // Stepped pixel snapping
        const drawX = Math.floor(m.x);
        const drawY = Math.floor(m.y);

        // Alpha calculation based on light cone presence (center at lamp head ~580, 140)
        const coneDist = Math.hypot(m.x - 580, m.y - 140);
        const alpha = Math.max(0.15, Math.min(0.85, 1 - coneDist / 340));

        ctx.fillStyle = m.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(drawX, drawY, m.size, m.size);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, []);

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 450 / rect.height;
    pointerPos.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerLeave = () => {
    pointerPos.current = { x: -9999, y: -9999 };
  };

  const handleLampClick = () => {
    poke();
    playProceduralSfx("ignite");
  };

  const handleBookClick = () => {
    setShimmerActive(true);
    playProceduralSfx("flip");
    window.setTimeout(() => setShimmerActive(false), 900);
  };

  const handleMugClick = () => {
    setMugHovered(true);
    playProceduralSfx("pop");
    window.setTimeout(() => setMugHovered(false), 800);
  };

  return (
    <div
      ref={sceneRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative w-full max-w-5xl mx-auto select-none overflow-hidden rounded-sm border-2 border-[#D3C9B4] bg-[#0F1420] shadow-[1px_4px_0_rgba(92,61,30,0.2),0_12px_36px_-6px_rgba(74,46,27,0.18)] ${className}`}
      style={{
        aspectRatio: "16 / 9",
        imageRendering: "pixelated",
      }}
      aria-label="16-bit Cozy Pixel Bookshop Desk Scene"
    >
      {/* ── 1. SVG Pixel Illustration ──────────────────────────────────── */}
      <svg
        viewBox="0 0 800 450"
        className="w-full h-full block"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
      >
        <defs>
          {/* Radial Light Cone from Brass Lamp */}
          <radialGradient
            id={`lampGlow-${filterId}`}
            cx="72%"
            cy="32%"
            r="55%"
            fx="72%"
            fy="32%"
          >
            <stop offset="0%" stopColor="#F7D486" stopOpacity={lampLit || lampHovered ? "0.6" : "0.35"} />
            <stop offset="25%" stopColor="#E3B04B" stopOpacity={lampLit || lampHovered ? "0.38" : "0.22"} />
            <stop offset="55%" stopColor="#B88428" stopOpacity={lampLit || lampHovered ? "0.18" : "0.09"} />
            <stop offset="100%" stopColor="#080B12" stopOpacity="0" />
          </radialGradient>

          {/* Stepped Steam Filter for 16-Bit Effect */}
          <linearGradient id={`woodBevel-${filterId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4A2E1B" />
            <stop offset="20%" stopColor="#332014" />
            <stop offset="100%" stopColor="#171F32" />
          </linearGradient>

          {/* Book Spine Gradients */}
          <linearGradient id={`spineRust-${filterId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C85848" />
            <stop offset="60%" stopColor="#A34133" />
            <stop offset="100%" stopColor="#7A2D23" />
          </linearGradient>

          <linearGradient id={`spineSage-${filterId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#78B084" />
            <stop offset="60%" stopColor="#5B9166" />
            <stop offset="100%" stopColor="#416E4A" />
          </linearGradient>

          <linearGradient id={`spineMoon-${filterId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6C98C2" />
            <stop offset="60%" stopColor="#4D79A3" />
            <stop offset="100%" stopColor="#325779" />
          </linearGradient>
        </defs>

        {/* ── BACKDROP: Bookshop Wall & Midnight Window ────────────────── */}
        <rect x="0" y="0" width="800" height="450" fill="#0F1420" />

        {/* Wallpaper Dither Striping */}
        {Array.from({ length: 50 }, (_, i) => (
          <rect
            key={`wall-strip-${i}`}
            x={i * 16}
            y="0"
            width="1"
            height="270"
            fill="#171F32"
            opacity="0.35"
          />
        ))}

        {/* ── WINDOW ARCH FRAME (Left & Center) ────────────────────────── */}
        {/* Window Outer Sill / Frame */}
        <rect x="36" y="24" width="428" height="236" fill="#080B12" />
        <rect x="34" y="22" width="432" height="4" fill="#4A2E1B" />
        <rect x="34" y="22" width="4" height="240" fill="#4A2E1B" />
        <rect x="462" y="22" width="4" height="240" fill="#332014" />
        <rect x="30" y="258" width="440" height="8" fill="#4A2E1B" />
        <rect x="28" y="260" width="444" height="4" fill="#B88428" opacity="0.4" />

        {/* Night Sky Outside the Window */}
        <rect x="38" y="26" width="424" height="232" fill="#080B12" />
        <rect x="38" y="140" width="424" height="118" fill="#0F1420" opacity="0.7" />
        <rect x="38" y="190" width="424" height="68" fill="#171F32" opacity="0.5" />

        {/* Distant Bookshop Rooftops & Chimney Silhouette */}
        <path
          d="M38,220 L110,185 L180,225 L260,195 L340,230 L410,205 L462,230 L462,258 L38,258 Z"
          fill="#080B12"
        />
        {/* Chimney */}
        <rect x="145" y="198" width="16" height="24" fill="#080B12" />
        <rect x="142" y="195" width="22" height="4" fill="#080B12" />

        {/* Distant Cozy Crescent Moon */}
        <g transform="translate(370, 48)">
          <circle cx="20" cy="20" r="16" fill="#F7D486" opacity="0.9" />
          <circle cx="27" cy="17" r="15" fill="#080B12" />
          {/* Subtle lunar craters */}
          <rect x="10" y="16" width="2" height="2" fill="#E3B04B" opacity="0.7" />
          <rect x="14" y="24" width="3" height="3" fill="#E3B04B" opacity="0.7" />
        </g>

        {/* Twinkling Pixel Stars */}
        {stars.map((s) => (
          <rect
            key={`star-${s.id}`}
            x={s.x + 38}
            y={s.y + 26}
            width={s.size}
            height={s.size}
            fill="#F7D486"
            className="pixel-star-twinkle"
            style={{
              animationDelay: s.delay,
              animationDuration: s.duration,
            }}
          />
        ))}

        {/* Drifting Rain Streaks in the Glass */}
        {rainStreaks.map((r) => (
          <line
            key={`rain-${r.id}`}
            x1={r.x + 38}
            y1={r.y + 26}
            x2={r.x + 38 - 6}
            y2={r.y + 26 + r.length}
            stroke="#6C98C2"
            strokeWidth="1.5"
            strokeOpacity={r.opacity}
            strokeLinecap="square"
            className="pixel-rain-streak"
            style={{
              animationDuration: `${r.speed}s`,
            }}
          />
        ))}

        {/* Window Wooden Panes (Mullions) */}
        {/* Vertical Bars */}
        <rect x="176" y="26" width="6" height="232" fill="#4A2E1B" />
        <rect x="178" y="26" width="2" height="232" fill="#33405F" opacity="0.4" />
        <rect x="316" y="26" width="6" height="232" fill="#4A2E1B" />
        <rect x="318" y="26" width="2" height="232" fill="#33405F" opacity="0.4" />
        {/* Horizontal Bars */}
        <rect x="38" y="100" width="424" height="6" fill="#4A2E1B" />
        <rect x="38" y="102" width="424" height="2" fill="#33405F" opacity="0.4" />
        <rect x="38" y="176" width="424" height="6" fill="#4A2E1B" />
        <rect x="38" y="178" width="424" height="2" fill="#33405F" opacity="0.4" />

        {/* ── WALL SHELF (Top Right) with Mini Antique Tomes ───────────── */}
        <rect x="490" y="74" width="280" height="12" fill="#4A2E1B" />
        <rect x="488" y="72" width="284" height="3" fill="#B88428" opacity="0.5" />
        <rect x="490" y="86" width="280" height="4" fill="#080B12" opacity="0.6" />

        {/* Shelf Books Row */}
        {/* Book 1 - Sage */}
        <rect x="506" y="24" width="18" height="50" fill="url(#spineSage)" />
        <rect x="508" y="28" width="14" height="2" fill="#E8DEC8" opacity="0.8" />
        <rect x="508" y="44" width="14" height="3" fill="#E3B04B" />
        {/* Book 2 - Rust */}
        <rect x="526" y="18" width="22" height="56" fill="url(#spineRust)" />
        <rect x="528" y="24" width="18" height="3" fill="#E3B04B" />
        <rect x="536" y="32" width="3" height="28" fill="#F7D486" />
        {/* Book 3 - Moon */}
        <rect x="550" y="28" width="16" height="46" fill="url(#spineMoon)" />
        <rect x="552" y="34" width="12" height="2" fill="#E8DEC8" />
        {/* Book 4 - Leather */}
        <rect x="568" y="20" width="24" height="54" fill="#4A2E1B" />
        <rect x="572" y="26" width="16" height="2" fill="#E3B04B" opacity="0.9" />
        <rect x="572" y="58" width="16" height="2" fill="#E3B04B" opacity="0.9" />
        {/* Book 5 (Tilted) */}
        <g transform="translate(604, 30) rotate(14)">
          <rect x="0" y="0" width="16" height="46" fill="url(#spineRust)" />
          <rect x="2" y="6" width="12" height="2" fill="#E8DEC8" />
        </g>
        {/* Brass Bookend */}
        <path d="M632,74 L632,38 L638,38 L638,68 L654,68 L654,74 Z" fill="#E3B04B" />
        <path d="M634,72 L634,40 L636,40 L636,70 L652,70 L652,72 Z" fill="#F7D486" />

        {/* ── DESK SURFACE: Rich Mahogany Workbench ────────────────────── */}
        <rect x="0" y="264" width="800" height="186" fill="url(#woodBevel)" />
        {/* Desk Top Bevel / Shadow Rim */}
        <rect x="0" y="264" width="800" height="4" fill="#B88428" opacity="0.3" />
        <rect x="0" y="268" width="800" height="2" fill="#080B12" opacity="0.5" />

        {/* Wood Slat Grain Lines */}
        <line x1="0" y1="305" x2="800" y2="305" stroke="#332014" strokeWidth="2" strokeDasharray="32 8 64 12" />
        <line x1="0" y1="350" x2="800" y2="350" stroke="#332014" strokeWidth="2" strokeDasharray="48 16 32 8" />
        <line x1="0" y1="395" x2="800" y2="395" stroke="#22150D" strokeWidth="2" strokeDasharray="64 24 40 16" />

        {/* ── LEATHER DESK BLOTTER / STUDY PAD ─────────────────────────── */}
        <rect x="140" y="280" width="460" height="150" fill="#171F32" stroke="#33405F" strokeWidth="2" />
        <rect x="144" y="284" width="452" height="142" fill="#0F1420" />
        {/* 16-Bit Antiqued Brass Corner Brackets */}
        {/* Top-Left Bracket */}
        <path d="M140,280 L160,280 L160,284 L144,284 L144,300 L140,300 Z" fill="#E3B04B" />
        <rect x="142" y="282" width="2" height="2" fill="#F7D486" />
        {/* Top-Right Bracket */}
        <path d="M600,280 L580,280 L580,284 L596,284 L596,300 L600,300 Z" fill="#E3B04B" />
        <rect x="596" y="282" width="2" height="2" fill="#F7D486" />
        {/* Bottom-Left Bracket */}
        <path d="M140,430 L160,430 L160,426 L144,426 L144,410 L140,410 Z" fill="#E3B04B" />
        {/* Bottom-Right Bracket */}
        <path d="M600,430 L580,430 L580,426 L596,426 L596,410 L600,410 Z" fill="#E3B04B" />

        {/* ── STACK OF ANTIQUE TOMES (Desk Left) ───────────────────────── */}
        <g
          className="cursor-pointer transition-transform duration-150 hover:-translate-y-1"
          onClick={handleBookClick}
          onMouseEnter={() => setBookHovered(true)}
          onMouseLeave={() => setBookHovered(false)}
          role="button"
          aria-label="Stack of antique study tomes. Click to shimmer notes."
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleBookClick();
          }}
        >
          {/* Bottom Tome (Rust Crimson Leather) */}
          <rect x="42" y="372" width="136" height="34" fill="url(#spineRust)" />
          <rect x="42" y="372" width="136" height="4" fill="#E3B04B" />
          <rect x="42" y="402" width="136" height="4" fill="#4A2E1B" />
          {/* Pages Edge on Right */}
          <rect x="168" y="376" width="10" height="26" fill="#E8DEC8" />
          <line x1="170" y1="380" x2="176" y2="380" stroke="#080B12" strokeWidth="1" opacity="0.3" />
          <line x1="170" y1="388" x2="176" y2="388" stroke="#080B12" strokeWidth="1" opacity="0.3" />
          <line x1="170" y1="396" x2="176" y2="396" stroke="#080B12" strokeWidth="1" opacity="0.3" />
          {/* Gold Ribs & Bookmark */}
          <rect x="58" y="372" width="4" height="34" fill="#E3B04B" />
          <rect x="76" y="372" width="4" height="34" fill="#E3B04B" />
          <path d="M120,406 L128,422 L136,406 Z" fill="#E3B04B" />

          {/* Middle Tome (Sage Green Cloth) */}
          <rect x="52" y="340" width="118" height="32" fill="url(#spineSage)" />
          <rect x="52" y="340" width="118" height="3" fill="#F7D486" opacity="0.8" />
          <rect x="160" y="344" width="10" height="24" fill="#E8DEC8" />
          <rect x="72" y="340" width="3" height="32" fill="#E3B04B" />
          <rect x="88" y="340" width="3" height="32" fill="#E3B04B" />
          <rect x="108" y="352" width="22" height="8" fill="#171F32" opacity="0.6" />

          {/* Top Tome (Midnight Moon Blue) */}
          <rect x="60" y="312" width="104" height="28" fill="url(#spineMoon)" />
          <rect x="60" y="312" width="104" height="3" fill="#F7D486" />
          <rect x="154" y="316" width="10" height="20" fill="#E8DEC8" />
          {/* Gold Emblem on Top Cover */}
          <rect x="96" y="316" width="18" height="18" fill="#E3B04B" opacity="0.9" />
          <rect x="100" y="320" width="10" height="10" fill="#080B12" />
          <rect x="103" y="323" width="4" height="4" fill="#F7D486" />
        </g>

        {/* ── OPEN STUDY TOME & NOTEBOOK (Center of Blotter) ───────────── */}
        <g
          className="cursor-pointer"
          onClick={handleBookClick}
          onMouseEnter={() => setBookHovered(true)}
          onMouseLeave={() => setBookHovered(false)}
          role="button"
          aria-label="Open study notebook with polished notes. Click to shimmer."
          tabIndex={0}
        >
          {/* Left Page (Aged Parchment) */}
          <path
            d="M210,296 Q290,292 350,298 L350,412 Q290,408 208,416 Z"
            fill="#E8DEC8"
          />
          {/* Right Page (Aged Parchment) */}
          <path
            d="M350,298 Q410,292 490,296 L492,416 Q410,408 350,412 Z"
            fill="#F5F0E6"
          />
          {/* Book Spine Center Crease & Leather Trim */}
          <line x1="350" y1="295" x2="350" y2="414" stroke="#4A2E1B" strokeWidth="4" />
          <line x1="350" y1="295" x2="350" y2="414" stroke="#080B12" strokeWidth="1" opacity="0.6" />

          {/* Left Page 16-Bit Faux Notes & Marginalia */}
          <line x1="230" y1="318" x2="328" y2="318" stroke="#171F32" strokeWidth="2" strokeDasharray="8 3 14 2" />
          <line x1="230" y1="332" x2="334" y2="332" stroke="#171F32" strokeWidth="2" strokeDasharray="16 4 10 3" />
          <line x1="230" y1="346" x2="318" y2="346" stroke="#171F32" strokeWidth="2" strokeDasharray="6 3 18 4" />
          <line x1="230" y1="360" x2="330" y2="360" stroke="#171F32" strokeWidth="2" strokeDasharray="12 4 12 2" />
          {/* Scholar Margin Highlight (Brass Amber) */}
          <line x1="230" y1="374" x2="320" y2="374" stroke="#E3B04B" strokeWidth="2.5" strokeDasharray="20 4 8 2" />
          <line x1="230" y1="388" x2="300" y2="388" stroke="#171F32" strokeWidth="2" strokeDasharray="10 3 14 3" />

          {/* Right Page 16-Bit Diagram & Key Citations */}
          <rect x="372" y="316" width="46" height="34" fill="#171F32" opacity="0.1" stroke="#33405F" strokeWidth="1" />
          <rect x="382" y="324" width="26" height="18" fill="#78B084" opacity="0.35" />
          <line x1="428" y1="322" x2="472" y2="322" stroke="#171F32" strokeWidth="2" strokeDasharray="10 3 8 2" />
          <line x1="428" y1="334" x2="466" y2="334" stroke="#171F32" strokeWidth="2" strokeDasharray="6 2 12 3" />
          <line x1="372" y1="362" x2="474" y2="362" stroke="#171F32" strokeWidth="2" strokeDasharray="14 3 18 2" />
          <line x1="372" y1="376" x2="470" y2="376" stroke="#6C98C2" strokeWidth="2" strokeDasharray="8 4 16 3" />
          <line x1="372" y1="390" x2="450" y2="390" stroke="#171F32" strokeWidth="2" strokeDasharray="12 3 10 2" />

          {/* Stepped Page Shimmer Glint */}
          <g
            className={`transition-opacity duration-300 ${
              shimmerActive || bookHovered ? "opacity-90" : "opacity-0"
            }`}
          >
            <rect x="360" y="300" width="12" height="110" fill="#F7D486" opacity="0.35" className="anim-shimmer-sweep" />
            <rect x="420" y="296" width="6" height="114" fill="#FFFFFF" opacity="0.45" />
          </g>
        </g>

        {/* ── INKWELL & BRASS QUILL PEN (Desk Center-Right) ────────────── */}
        <g transform="translate(506, 320)">
          {/* Glass / Pewter Inkwell */}
          <rect x="6" y="38" width="26" height="24" fill="#080B12" stroke="#33405F" strokeWidth="1.5" />
          <rect x="10" y="32" width="18" height="6" fill="#B88428" />
          <rect x="12" y="34" width="14" height="2" fill="#F7D486" />
          <rect x="14" y="38" width="10" height="4" fill="#080B12" />
          {/* White Feather Quill */}
          <line x1="18" y1="36" x2="46" y2="2" stroke="#E8DEC8" strokeWidth="2.5" />
          <path d="M46,2 L36,18 L32,16 L44,0 Z" fill="#F5F0E6" />
          <line x1="38" y1="12" x2="44" y2="4" stroke="#E3B04B" strokeWidth="1" />
        </g>

        {/* ── STEAMING CERAMIC MUG (Desk Right) ────────────────────────── */}
        <g
          transform="translate(562, 332)"
          className="cursor-pointer group"
          onClick={handleMugClick}
          role="button"
          aria-label="Steaming mug of hot tea. Click to warm up."
          tabIndex={0}
        >
          {/* Mug Shadow */}
          <ellipse cx="24" cy="44" rx="20" ry="6" fill="#080B12" opacity="0.6" />
          {/* Mug Body */}
          <rect x="6" y="8" width="36" height="34" fill="#171F32" stroke="#33405F" strokeWidth="1.5" />
          <rect x="8" y="10" width="32" height="6" fill="#78B084" />
          {/* Hot Tea Liquid inside rim */}
          <ellipse cx="24" cy="10" rx="16" ry="5" fill="#4A2E1B" />
          <ellipse cx="24" cy="10" rx="12" ry="3" fill="#B88428" opacity="0.6" />
          {/* Mug Handle */}
          <path d="M42,16 C48,16 50,28 42,32" stroke="#33405F" strokeWidth="3" fill="none" strokeLinecap="square" />

          {/* 16-Bit Stepped Pixel Steam Trails */}
          <g className="pixel-steam-group" opacity={mugHovered ? "0.9" : "0.55"}>
            <rect x="18" y="-6" width="3" height="5" fill="#E8DEC8" className="steam-puff-1" />
            <rect x="23" y="-12" width="4" height="6" fill="#F5F0E6" className="steam-puff-2" />
            <rect x="28" y="-18" width="3" height="6" fill="#E8DEC8" className="steam-puff-3" />
            <rect x="22" y="-24" width="4" height="5" fill="#E8DEC8" className="steam-puff-4" />
          </g>
        </g>

        {/* ── GLOWING BRASS SCHOLAR'S LAMP (Desk Right) ────────────────── */}
        <g
          transform="translate(630, 130)"
          className="cursor-pointer"
          onClick={handleLampClick}
          onMouseEnter={() => {
            setLampHovered(true);
            ignite();
          }}
          onMouseLeave={() => setLampHovered(false)}
          role="button"
          aria-label={lampLit ? "Brass desk lamp, lit. Click to flare." : "Light the brass desk lamp."}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleLampClick();
          }}
        >
          {/* Stepped Heavy Brass Base */}
          <rect x="18" y="248" width="68" height="12" fill="#B88428" stroke="#080B12" strokeWidth="1.5" />
          <rect x="22" y="244" width="60" height="4" fill="#E3B04B" />
          <rect x="28" y="240" width="48" height="4" fill="#F7D486" />
          <rect x="36" y="234" width="32" height="6" fill="#B88428" />

          {/* Curved Brass Armature Goose-Neck */}
          <path
            d="M52,234 L52,110 Q52,48 10,48 L-6,48"
            stroke="#B88428"
            strokeWidth="7"
            fill="none"
            strokeLinecap="square"
          />
          <path
            d="M54,234 L54,110 Q54,50 12,50 L-4,50"
            stroke="#E3B04B"
            strokeWidth="3"
            fill="none"
            strokeLinecap="square"
          />
          <rect x="46" y="112" width="14" height="6" fill="#E3B04B" />

          {/* Banker's / Scholar's Lamp Hood */}
          {/* Outer Brass Hood */}
          <path
            d="M-36,52 L16,52 L26,78 L-46,78 Z"
            fill="#B88428"
            stroke="#080B12"
            strokeWidth="1.5"
          />
          <path
            d="M-34,54 L14,54 L22,76 L-42,76 Z"
            fill="#E3B04B"
          />
          <rect x="-30" y="54" width="40" height="3" fill="#F7D486" />

          {/* Glowing Inner Filament & Golden Core */}
          <rect x="-36" y="78" width="56" height="8" fill="#FF9E43" />
          <rect x="-28" y="80" width="40" height="6" fill="#F7D486" className="anim-px-flicker" />
          <circle cx="-8" cy="84" r="8" fill="#FFFFFF" opacity={lampLit || lampHovered ? "0.9" : "0.7"} />

          {/* Hanging Pull-Chain Bead with Tassel */}
          <line x1="-2" y1="84" x2="-2" y2="134" stroke="#E3B04B" strokeWidth="1.5" strokeDasharray="3 2" />
          <circle cx="-2" cy="136" r="3.5" fill="#F7D486" />

          {/* Interactive Poke Sparks */}
          {(mood === "poke" || pokeCount > 0) && (
            <g className="lamp-spark-burst" opacity="0.9">
              <rect x="-14" y="60" width="3" height="3" fill="#F7D486" />
              <rect x="4" y="56" width="3" height="3" fill="#FF9E43" />
              <rect x="-24" y="92" width="4" height="4" fill="#F7D486" />
              <rect x="18" y="96" width="3" height="3" fill="#E3B04B" />
            </g>
          )}
        </g>

        {/* ── AMBIENT WARMTH LIGHT CONE (Overlays Desk & Tomes) ─────────── */}
        <polygon
          points="580,180 80,450 780,450"
          fill={`url(#lampGlow-${filterId})`}
          className="pointer-events-none mix-blend-screen"
        />
      </svg>

      {/* ── 2. Canvas Dust Motes Overlay ───────────────────────────────── */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 w-full h-full"
        aria-hidden="true"
      />

      {/* ── 3. Atmospheric Status Pill & Interactive Hint ──────────────── */}
      <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 border border-[#33405F] bg-[#080B12]/85 px-2.5 py-1 text-[11px] font-mono uppercase tracking-widest text-[#F7D486] shadow-[1px_1px_0_#080B12] backdrop-blur-sm">
          <span
            className={`h-2 w-2 ${
              lampLit ? "bg-[#E3B04B] shadow-[0_0_8px_#E3B04B]" : "bg-[#9099B0]"
            } transition-colors duration-150`}
          />
          16-Bit Study Desk {lampLit ? "· Lamp Lit" : "· Tap Lamp"}
        </span>
        {pokeCount > 0 && (
          <span className="hidden sm:inline-flex border border-[#E3B04B]/30 bg-[#171F32]/85 px-2 py-0.5 text-[10px] font-mono text-[#F5F0E6] backdrop-blur-sm">
            Flare #{pokeCount}
          </span>
        )}
      </div>

      {/* ── 4. Stepped CSS Animation Styles ────────────────────────────── */}
      <style>{`
        /* Twinkling 4-Step Star Cycle */
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          25% { opacity: 0.9; transform: scale(1.2); }
          50% { opacity: 0.4; transform: scale(0.9); }
          75% { opacity: 1; transform: scale(1.1); }
        }
        .pixel-star-twinkle {
          animation: star-twinkle 3s steps(4, jump-none) infinite;
          transform-origin: center;
        }

        /* Stepped Drifting Rain Streak */
        @keyframes rain-fall {
          0% { transform: translate(0, -20px); opacity: 0; }
          40% { opacity: 0.6; }
          80% { opacity: 0.3; }
          100% { transform: translate(-18px, 60px); opacity: 0; }
        }
        .pixel-rain-streak {
          animation: rain-fall 1.4s steps(6, jump-none) infinite linear;
        }

        /* Stepped Pixel Steam Puffs */
        @keyframes steam-rise {
          0% { transform: translate(0, 0) scale(0.9); opacity: 0.2; }
          30% { transform: translate(-2px, -6px) scale(1.1); opacity: 0.7; }
          60% { transform: translate(2px, -14px) scale(1.3); opacity: 0.4; }
          100% { transform: translate(-1px, -24px) scale(1.6); opacity: 0; }
        }
        .steam-puff-1 { animation: steam-rise 2.4s steps(4, jump-none) infinite; animation-delay: 0s; }
        .steam-puff-2 { animation: steam-rise 2.4s steps(4, jump-none) infinite; animation-delay: 0.6s; }
        .steam-puff-3 { animation: steam-rise 2.4s steps(4, jump-none) infinite; animation-delay: 1.2s; }
        .steam-puff-4 { animation: steam-rise 2.4s steps(4, jump-none) infinite; animation-delay: 1.8s; }

        /* Shimmer Page Sweep */
        @keyframes shimmer-sweep {
          0% { transform: translateX(-40px); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateX(90px); opacity: 0; }
        }
        .anim-shimmer-sweep {
          animation: shimmer-sweep 0.85s steps(6, jump-none) ease-out;
        }

        /* Reduced Motion Directives: Freeze all animations to crisp resting frame */
        @media (prefers-reduced-motion: reduce) {
          .pixel-star-twinkle,
          .pixel-rain-streak,
          .steam-puff-1,
          .steam-puff-2,
          .steam-puff-3,
          .steam-puff-4,
          .anim-shimmer-sweep,
          .anim-px-flicker {
            animation: none !important;
            transform: none !important;
            opacity: 0.7 !important;
          }
        }
      `}</style>
    </div>
  );
}
