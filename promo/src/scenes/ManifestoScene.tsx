import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontBody, fontDisplay } from "../brand/fonts";
import { useBrandScale } from "../brand/useBrandScale";
import { colors, ease } from "../brand/tokens";
import { MonoLabel } from "../components/MonoLabel";
import { SceneShell } from "../components/SceneShell";

const WORDS =
  "Between the highlight and the exam lies the thinking — quiet, patient work.".split(
    " ",
  );

export const ManifestoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { display, body, isVertical } = useBrandScale();

  const labelOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [2.2 * fps, 3.1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subY = interpolate(frame, [2.2 * fps, 3.1 * fps], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });

  return (
    <SceneShell intensity={0.95}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: isVertical ? 48 : 40,
        }}
      >
        <div style={{ opacity: labelOpacity }}>
          <MonoLabel>02 — The Space</MonoLabel>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: isVertical ? "12px 14px" : "10px 14px",
            maxWidth: isVertical ? 880 : 1100,
            textAlign: "center",
          }}
        >
          {WORDS.map((word, i) => {
            const start = 0.4 * fps + i * 4;
            const opacity = interpolate(frame, [start, start + 12], [0.12, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={`${word}-${i}`}
                style={{
                  fontFamily: fontDisplay,
                  fontSize: display(isVertical ? 36 : 48),
                  fontWeight: 400,
                  color: colors.parchment,
                  opacity,
                  letterSpacing: "-0.012em",
                  lineHeight: 1.3,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div
          style={{
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
            fontFamily: fontBody,
            fontSize: body(isVertical ? 20 : 24),
            color: colors.faded,
            maxWidth: isVertical ? 820 : 720,
            textAlign: "center",
            lineHeight: 1.45,
          }}
        >
          Comtus keeps a lamp on in that space — and never forgets which page an
          idea came from.
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
