import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Grain } from "./Grain";
import { LampGlow } from "./LampGlow";

type SceneShellProps = {
  children: React.ReactNode;
  intensity?: number;
  showMotes?: boolean;
};

export const SceneShell: React.FC<SceneShellProps> = ({
  children,
  intensity = 1,
  showMotes = true,
}) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;
  const isSquare = Math.abs(width - height) < 40;
  const padX = isVertical ? 56 : isSquare ? 64 : 96;
  const padY = isVertical ? 120 : 48;

  return (
    <AbsoluteFill>
      <LampGlow intensity={intensity} showMotes={showMotes} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: `${padY}px ${padX}px`,
        }}
      >
        {children}
      </AbsoluteFill>
      <Grain />
    </AbsoluteFill>
  );
};
