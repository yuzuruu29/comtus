import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontDisplay, fontBody } from "../brand/fonts";
import { useBrandScale } from "../brand/useBrandScale";
import { colors, ease } from "../brand/tokens";
import { Emblem } from "../components/Emblem";
import { MonoLabel } from "../components/MonoLabel";
import { SceneShell } from "../components/SceneShell";

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { display, body, isVertical } = useBrandScale();

  const emblemScale = interpolate(frame, [0, 1.1 * fps], [0.72, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });
  const emblemOpacity = interpolate(frame, [0, 0.7 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordOpacity = interpolate(frame, [0.55 * fps, 1.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordY = interpolate(frame, [0.55 * fps, 1.2 * fps], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });
  const labelOpacity = interpolate(frame, [1.1 * fps, 1.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneShell>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: isVertical ? 36 : 28,
        }}
      >
        <div
          style={{
            opacity: emblemOpacity,
            transform: `scale(${emblemScale})`,
          }}
        >
          <Emblem size={display(isVertical ? 140 : 120)} glow={1.15} />
        </div>
        <div
          style={{
            opacity: wordOpacity,
            transform: `translateY(${wordY}px)`,
            fontFamily: fontDisplay,
            fontSize: display(isVertical ? 84 : 92),
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: colors.parchment,
            lineHeight: 1,
          }}
        >
          COMTUS
        </div>
        <Sequence from={Math.round(1.1 * fps)} layout="none">
          <div style={{ opacity: labelOpacity }}>
            <MonoLabel>AI Study Companion</MonoLabel>
          </div>
        </Sequence>
        <div
          style={{
            opacity: labelOpacity,
            marginTop: 8,
            fontFamily: fontBody,
            fontSize: body(22),
            color: colors.faded,
            letterSpacing: "0.01em",
            textAlign: "center",
            padding: "0 24px",
          }}
        >
          Study in a warmer light.
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
