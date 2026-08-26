import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors } from "../brand/tokens";

type EmblemProps = {
  size?: number;
  glow?: number;
};

export const Emblem: React.FC<EmblemProps> = ({ size = 96, glow = 1 }) => {
  const frame = useCurrentFrame();
  const pulse = 0.85 + 0.15 * Math.sin(frame * 0.08);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      style={{
        filter: `drop-shadow(0 0 ${18 * glow * pulse}px rgba(227,176,75,${0.45 * glow}))`,
      }}
    >
      <defs>
        <radialGradient id="promoLampBloom" cx="50%" cy="42%" r="48%">
          <stop offset="0%" stopColor="#FFE4A0" stopOpacity={0.45 * glow} />
          <stop offset="50%" stopColor="#E3B04B" stopOpacity={0.2 * glow} />
          <stop offset="100%" stopColor="#E3B04B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="promoFlame" x1="24" y1="6" x2="24" y2="34">
          <stop offset="0%" stopColor="#FFF1C2" />
          <stop offset="28%" stopColor="#F5C869" />
          <stop offset="72%" stopColor="#E3B04B" />
          <stop offset="100%" stopColor="#A86E18" />
        </linearGradient>
        <linearGradient id="promoCore" x1="24" y1="14" x2="24" y2="30">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#FFF8E0" />
          <stop offset="100%" stopColor="#F7D486" />
        </linearGradient>
        <linearGradient id="promoBrass" x1="16" y1="32" x2="32" y2="42">
          <stop offset="0%" stopColor="#F5C869" />
          <stop offset="50%" stopColor="#E3B04B" />
          <stop offset="100%" stopColor="#8C5810" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="22" r="20" fill="url(#promoLampBloom)" />
      <path
        d="M24 6.5C24 6.5 32.5 16.2 32.5 24C32.5 28.6944 28.6944 32.5 24 32.5C19.3056 32.5 15.5 28.6944 15.5 24C15.5 16.2 24 6.5 24 6.5Z"
        fill="url(#promoFlame)"
        opacity={interpolate(frame, [0, 20], [0.7, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      />
      <path
        d="M24 14.5C24 14.5 28.2 20.2 28.2 24.5C28.2 26.8196 26.3196 28.7 24 28.7C21.6804 28.7 19.8 26.8196 19.8 24.5C19.8 20.2 24 14.5 24 14.5Z"
        fill="url(#promoCore)"
        opacity={0.92}
      />
      <path
        d="M17 32C17 30.5 19.5 29.5 24 29.5C28.5 29.5 31 30.5 31 32C31 34.5 28 36 24 36C20 36 17 34.5 17 32Z"
        fill="url(#promoBrass)"
      />
      <path d="M22.5 35.5H25.5V38.5H22.5V35.5Z" fill="url(#promoBrass)" />
      <rect
        x="18"
        y="38.5"
        width="12"
        height="2.5"
        rx="1.25"
        fill="url(#promoBrass)"
      />
      <circle
        cx="24"
        cy="24"
        r="1"
        fill={colors.parchment}
        opacity={0}
      />
    </svg>
  );
};
