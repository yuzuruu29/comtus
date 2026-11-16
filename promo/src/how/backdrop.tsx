import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { day, easeInOut, font, lamp } from "./theme";
import { Icon, prog } from "./kit";

/** Daylight paper: the lamp sits upper left, a notebook margin runs down the side. */
export const DayDesk: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: day.ground }}>
    <AbsoluteFill style={{ background: `radial-gradient(1100px 760px at 8% -6%, ${day.brassPale}2e, transparent 70%)` }} />
    <div style={{ position: "absolute", left: 96, top: 0, bottom: 0, width: 1, background: `${day.rust}33` }} />
    <div style={{ position: "absolute", left: 102, top: 0, bottom: 0, width: 1, background: `${day.rust}22` }} />
    {children}
  </AbsoluteFill>
);

/** Lamplight walnut, with the lamp's pool centred where `glow` puts it. */
export const LampDesk: React.FC<{ glow?: number; children?: React.ReactNode }> = ({ glow = 1, children }) => (
  <AbsoluteFill style={{ background: lamp.ground }}>
    <AbsoluteFill
      style={{
        opacity: glow,
        background: `radial-gradient(900px 620px at 50% 38%, ${lamp.brass}24, transparent 72%)`,
      }}
    />
    {children}
  </AbsoluteFill>
);

const STEPS = ["Add", "Ask", "Practice", "Plan"] as const;

/** Where the viewer is in the four steps. `starts` are global frames. */
export const Rail: React.FC<{ starts: readonly number[]; end: number }> = ({ starts, end }) => {
  const f = useCurrentFrame();
  const shown = prog(f, starts[0] + 6, 18) * (1 - prog(f, end - 18, 14, easeInOut));
  return (
    <div style={{ position: "absolute", left: 150, top: 86, display: "flex", gap: 12, opacity: shown }}>
      {STEPS.map((label, i) => {
        const on = prog(f, starts[i], 14);
        const done = i + 1 < starts.length ? prog(f, starts[i + 1], 14) : 0;
        const active = on * (1 - done);
        return (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 46,
              padding: "0 20px",
              borderRadius: 23,
              fontFamily: font.ui,
              fontWeight: 600,
              fontSize: 22,
              border: `1.5px solid ${active > 0.5 ? day.brass : done > 0.5 ? day.hairlineStrong : day.hairline}`,
              background: `rgba(132,92,22,${active})`,
              color: active > 0.5 ? day.ground : done > 0.5 ? day.ink : day.muted,
            }}
          >
            {done > 0 && (
              <span style={{ width: 22 * done, overflow: "hidden" }}>
                <Icon name="check" size={22} color={day.sage} weight={2.6} draw={done} />
              </span>
            )}
            {label}
          </div>
        );
      })}
    </div>
  );
};
