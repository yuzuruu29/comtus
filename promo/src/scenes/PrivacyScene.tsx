import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontBody, fontDisplay, fontMono } from "../brand/fonts";
import { useBrandScale } from "../brand/useBrandScale";
import { colors, ease } from "../brand/tokens";
import { MonoLabel } from "../components/MonoLabel";
import { SceneShell } from "../components/SceneShell";

const PILLARS = [
  {
    tag: "Local-first",
    line: "Notebooks, sources, and history stay on your device.",
  },
  {
    tag: "BYOK privacy",
    line: "Your keys never leave the machine. Hosted passes when you want them.",
  },
  {
    tag: "Everywhere",
    line: "Browser, PWA, or desktop — the same warm desk.",
  },
];

export const PrivacyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { display, body, isVertical } = useBrandScale();

  const titleOpacity = interpolate(frame, [0.1 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0.1 * fps, 0.8 * fps], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });

  return (
    <SceneShell intensity={1}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: isVertical ? 44 : 52,
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            textAlign: "center",
          }}
        >
          <MonoLabel>04 — Trust</MonoLabel>
          <div
            style={{
              fontFamily: fontDisplay,
              fontSize: display(isVertical ? 44 : 56),
              fontWeight: 400,
              color: colors.parchment,
              letterSpacing: "-0.015em",
              maxWidth: isVertical ? 860 : 900,
              lineHeight: 1.1,
              padding: "0 12px",
            }}
          >
            Your library stays yours.
          </div>
          <div
            style={{
              fontFamily: fontBody,
              fontSize: body(isVertical ? 18 : 22),
              color: colors.faded,
              maxWidth: 640,
              lineHeight: 1.45,
              padding: "0 16px",
            }}
          >
            Grounded or silent. Thinking visible. Keys on-device.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isVertical ? "1fr" : "repeat(3, 1fr)",
            gap: isVertical ? 28 : 36,
            width: "100%",
            maxWidth: isVertical ? 880 : 1100,
          }}
        >
          {PILLARS.map((pillar, i) => {
            const start = 0.9 * fps + i * 12;
            const opacity = interpolate(frame, [start, start + 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const y = interpolate(frame, [start, start + 16], [20, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(...ease.out),
            });

            return (
              <div
                key={pillar.tag}
                style={{
                  opacity,
                  transform: `translateY(${y}px)`,
                  borderTop: `1px solid ${colors.hairline}`,
                  paddingTop: 20,
                }}
              >
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: body(12),
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: colors.brass,
                    marginBottom: 12,
                  }}
                >
                  {pillar.tag}
                </div>
                <div
                  style={{
                    fontFamily: fontBody,
                    fontSize: body(isVertical ? 17 : 18),
                    color: colors.parchment,
                    lineHeight: 1.45,
                  }}
                >
                  {pillar.line}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
