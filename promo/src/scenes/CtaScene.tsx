import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  fontBody,
  fontDisplay,
  fontDisplayItalic,
  fontMono,
} from "../brand/fonts";
import { useBrandScale } from "../brand/useBrandScale";
import { colors, ease, siteUrl } from "../brand/tokens";
import { Emblem } from "../components/Emblem";
import { MonoLabel } from "../components/MonoLabel";
import { SceneShell } from "../components/SceneShell";

export const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { display, body, isVertical } = useBrandScale();

  const emblemOpacity = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleMask = interpolate(frame, [0.35 * fps, 1.2 * fps], [110, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });
  const buttonOpacity = interpolate(frame, [1.3 * fps, 2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const buttonY = interpolate(frame, [1.3 * fps, 2 * fps], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...ease.out),
  });
  const urlOpacity = interpolate(frame, [2 * fps, 2.7 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowPulse = 0.9 + 0.1 * Math.sin(frame * 0.12);

  return (
    <SceneShell intensity={1.1}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: isVertical ? 32 : 28,
        }}
      >
        <div style={{ opacity: emblemOpacity * 0.95 }}>
          <MonoLabel>The Desk Is Set</MonoLabel>
        </div>
        <div style={{ opacity: emblemOpacity }}>
          <Emblem size={display(isVertical ? 100 : 88)} glow={glowPulse} />
        </div>
        <div
          style={{
            overflow: "hidden",
            textAlign: "center",
            maxWidth: isVertical ? 900 : 1400,
            padding: "0 16px",
          }}
        >
          <div
            style={{
              transform: `translateY(${titleMask}%)`,
              fontFamily: fontDisplay,
              fontSize: display(isVertical ? 52 : 72),
              fontWeight: 400,
              color: colors.parchment,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
            }}
          >
            Open the studio.{" "}
            <span
              style={{
                fontFamily: fontDisplayItalic,
                fontStyle: "italic",
                color: colors.brassPale,
              }}
            >
              Think tonight.
            </span>
          </div>
        </div>

        <div
          style={{
            opacity: buttonOpacity,
            transform: `translateY(${buttonY}px)`,
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: `${body(16)}px ${body(20)}px ${body(16)}px ${body(32)}px`,
            borderRadius: 999,
            background: `linear-gradient(92deg, ${colors.brassDeep}, ${colors.brassPale})`,
            boxShadow: `0 12px 50px rgba(227,176,75,${0.28 * glowPulse})`,
            fontFamily: fontBody,
            fontSize: body(isVertical ? 18 : 20),
            fontWeight: 600,
            color: colors.night,
          }}
        >
          Open the studio
          <span
            style={{
              width: body(36),
              height: body(36),
              borderRadius: "50%",
              backgroundColor: "rgba(11,15,26,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: body(16),
            }}
          >
            →
          </span>
        </div>

        <div
          style={{
            opacity: urlOpacity,
            marginTop: 8,
            fontFamily: fontMono,
            fontSize: body(isVertical ? 16 : 18),
            letterSpacing: "0.14em",
            color: colors.faded,
          }}
        >
          {siteUrl}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
