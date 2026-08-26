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

const FEATURES = [
  {
    index: "01",
    title: "Document Studio",
    line: "Flashcards, quizzes, study guides, and lecture notes from your sources.",
  },
  {
    index: "02",
    title: "Grounded answers",
    line: "Citations back to the pages you added — or silence, never guesswork.",
  },
  {
    index: "03",
    title: "Socratic tutoring",
    line: "Hints first, worked reasoning visible — thinking stays yours.",
  },
  {
    index: "04",
    title: "Exam modes",
    line: "Mock exams, rapid quizzes, essay rubric coach — one workspace.",
  },
];

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { display, body, isVertical } = useBrandScale();

  const headerOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneShell intensity={0.9} showMotes={false}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: isVertical ? 40 : 48,
        }}
      >
        <div
          style={{
            opacity: headerOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            textAlign: "center",
          }}
        >
          <MonoLabel>03 — The Method</MonoLabel>
          <div
            style={{
              fontFamily: fontDisplay,
              fontSize: display(isVertical ? 40 : 52),
              fontWeight: 400,
              color: colors.parchment,
              letterSpacing: "-0.015em",
              padding: "0 16px",
            }}
          >
            One desk for the whole craft.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isVertical ? "1fr" : "1fr 1fr",
            gap: isVertical ? 22 : 28,
            width: "100%",
            maxWidth: isVertical ? 880 : 1180,
          }}
        >
          {FEATURES.map((feature, i) => {
            const start = 0.5 * fps + i * 10;
            const opacity = interpolate(frame, [start, start + 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const y = interpolate(frame, [start, start + 16], [24, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(...ease.out),
            });
            const rule = interpolate(frame, [start + 8, start + 28], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(...ease.out),
            });

            return (
              <div
                key={feature.index}
                style={{
                  opacity,
                  transform: `translateY(${y}px)`,
                  borderTop: `1px solid ${colors.hairline}`,
                  paddingTop: 22,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: `${rule * 100}%`,
                    height: 1,
                    background: `linear-gradient(92deg, ${colors.brassDeep}, ${colors.brassPale})`,
                  }}
                />
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: body(12),
                    letterSpacing: "0.18em",
                    color: colors.brass,
                    marginBottom: 10,
                  }}
                >
                  {feature.index}
                </div>
                <div
                  style={{
                    fontFamily: fontDisplay,
                    fontSize: display(isVertical ? 26 : 30),
                    color: colors.parchment,
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {feature.title}
                </div>
                <div
                  style={{
                    fontFamily: fontBody,
                    fontSize: body(isVertical ? 16 : 18),
                    color: colors.faded,
                    lineHeight: 1.45,
                    maxWidth: 460,
                  }}
                >
                  {feature.line}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
