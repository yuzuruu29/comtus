import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontDisplay, fontDisplayItalic } from "../brand/fonts";
import { useBrandScale } from "../brand/useBrandScale";
import { colors, ease } from "../brand/tokens";
import { MonoLabel } from "../components/MonoLabel";
import { SceneShell } from "../components/SceneShell";

export const TaglineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { display, isVertical } = useBrandScale();

  const line1Mask = interpolate(frame, [0.15 * fps, 1.1 * fps], [118, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });
  const line2Mask = interpolate(frame, [0.45 * fps, 1.4 * fps], [118, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });
  const polishOpacity = interpolate(frame, [1.2 * fps, 2 * fps], [0.35, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ruleScale = interpolate(frame, [1.6 * fps, 2.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });
  const labelOpacity = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneShell intensity={1.05}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: 36,
        }}
      >
        <div style={{ opacity: labelOpacity }}>
          <MonoLabel>01 — The Craft</MonoLabel>
        </div>
        <div style={{ textAlign: "center", maxWidth: isVertical ? 900 : 1400 }}>
          <div style={{ overflow: "hidden", paddingBottom: 8 }}>
            <div
              style={{
                transform: `translateY(${line1Mask}%)`,
                fontFamily: fontDisplay,
                fontSize: display(isVertical ? 56 : 78),
                fontWeight: 400,
                color: colors.parchment,
                letterSpacing: "-0.015em",
                lineHeight: 1.08,
                padding: "0 12px",
              }}
            >
              Study smarter with Comtus.
            </div>
          </div>
          <div style={{ overflow: "hidden", paddingBottom: 12 }}>
            <div
              style={{
                transform: `translateY(${line2Mask}%)`,
                fontFamily: fontDisplayItalic,
                fontSize: display(isVertical ? 40 : 56),
                fontWeight: 400,
                fontStyle: "italic",
                color: colors.faded,
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
                padding: "0 12px",
              }}
            >
              Rough thought,{" "}
              <span style={{ color: colors.brassPale, opacity: polishOpacity }}>
                polished.
              </span>
            </div>
          </div>
        </div>
        <div
          style={{
            width: 160,
            height: 2,
            borderRadius: 2,
            transform: `scaleX(${ruleScale})`,
            transformOrigin: "center",
            background: `linear-gradient(92deg, ${colors.brassDeep}, ${colors.brassPale})`,
          }}
        />
      </AbsoluteFill>
    </SceneShell>
  );
};
