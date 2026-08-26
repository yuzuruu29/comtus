import React from "react";
import { fontMono } from "../brand/fonts";
import { colors } from "../brand/tokens";

type MonoLabelProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export const MonoLabel: React.FC<MonoLabelProps> = ({ children, style }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontFamily: fontMono,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: colors.brassPale,
        ...style,
      }}
    >
      <span
        style={{
          width: 40,
          height: 1,
          background: `linear-gradient(92deg, ${colors.brassDeep}, ${colors.brassPale})`,
        }}
      />
      <span>{children}</span>
      <span
        style={{
          width: 40,
          height: 1,
          background: `linear-gradient(92deg, ${colors.brassPale}, ${colors.brassDeep})`,
        }}
      />
    </div>
  );
};
