import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, ease } from "../brand/tokens";

type Mote = {
  x: number;
  y: number;
  size: number;
  drift: number;
  speed: number;
  opacity: number;
};

const MOTES: Mote[] = [
  { x: 42, y: 28, size: 2.2, drift: 18, speed: 0.35, opacity: 0.55 },
  { x: 51, y: 34, size: 1.6, drift: -14, speed: 0.28, opacity: 0.4 },
  { x: 58, y: 42, size: 2.8, drift: 22, speed: 0.42, opacity: 0.5 },
  { x: 37, y: 48, size: 1.4, drift: -10, speed: 0.22, opacity: 0.35 },
  { x: 48, y: 55, size: 2, drift: 16, speed: 0.31, opacity: 0.45 },
  { x: 62, y: 52, size: 1.8, drift: -20, speed: 0.38, opacity: 0.38 },
  { x: 45, y: 62, size: 1.5, drift: 12, speed: 0.25, opacity: 0.32 },
  { x: 55, y: 68, size: 2.4, drift: -8, speed: 0.33, opacity: 0.42 },
  { x: 40, y: 38, size: 1.3, drift: 9, speed: 0.2, opacity: 0.28 },
  { x: 64, y: 36, size: 1.9, drift: -15, speed: 0.36, opacity: 0.4 },
];

type LampGlowProps = {
  intensity?: number;
  showMotes?: boolean;
};

export const LampGlow: React.FC<LampGlowProps> = ({
  intensity = 1,
  showMotes = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bloom = interpolate(frame, [0, 1.2 * fps], [0.35, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });

  const flicker =
    0.92 +
    0.08 * Math.sin(frame * 0.11) +
    0.04 * Math.sin(frame * 0.27 + 1.2);

  const glowOpacity = bloom * flicker * intensity;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.night }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 38%, rgba(227,176,75,${0.22 * glowOpacity}) 0%, rgba(42,54,84,${0.28 * glowOpacity}) 42%, transparent 72%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 45% 40% at 50% 36%, rgba(255,228,160,${0.18 * glowOpacity}) 0%, transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(60% 100% at 50% 100%, rgba(42,54,84,0.5), rgba(42,54,84,0.12) 55%, transparent 80%)",
        }}
      />
      {showMotes
        ? MOTES.map((mote, i) => {
            const y =
              mote.y +
              Math.sin((frame * mote.speed + i) * 0.08) * (mote.drift * 0.08);
            const x =
              mote.x +
              Math.cos((frame * mote.speed * 0.7 + i * 1.3) * 0.06) *
                (mote.drift * 0.05);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  width: mote.size,
                  height: mote.size,
                  borderRadius: "50%",
                  backgroundColor: colors.brassPale,
                  opacity: mote.opacity * glowOpacity * 0.85,
                  boxShadow: `0 0 ${mote.size * 3}px ${colors.brassPale}`,
                }}
              />
            );
          })
        : null}
    </AbsoluteFill>
  );
};
