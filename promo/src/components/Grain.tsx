import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/** Subtle film grain — Remotion-safe (no CSS animation). */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.045 }) => {
  const frame = useCurrentFrame();
  const shift = (frame * 17) % 100;

  return (
    <AbsoluteFill
      style={{
        opacity,
        pointerEvents: "none",
        mixBlendMode: "overlay",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundPosition: `${shift}% ${(shift * 1.3) % 100}%`,
        backgroundSize: "180px 180px",
      }}
    />
  );
};
