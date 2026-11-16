import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { day, easeInOut, easeOut, font } from "./theme";
// The app's own sprite data, so the film draws exactly the Compad users meet.
import {
  BATTERY_HEIGHT,
  BATTERY_WIDTH,
  COZY_PIXEL_BATTERY_ANIMATIONS,
} from "../../../src/components/pixel/pixelBatteryFrames";

/** 0 to 1 over [start, start + dur], eased and clamped. */
export const prog = (f: number, start: number, dur: number, ease = easeOut) =>
  interpolate(f, [start, start + dur], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const move = (f: number, start: number, dur: number) => prog(f, start, dur, easeInOut);

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** A gentle overshoot for things that land, like a card set on a desk. */
export const pop = (f: number, start: number, dur = 18) => {
  const t = Math.min(1, Math.max(0, (f - start) / dur));
  const c = 1.6;
  return t === 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** Characters revealed at `cps` characters per frame from `start`. */
export const typed = (text: string, f: number, start: number, cps = 1.4) =>
  text.slice(0, Math.max(0, Math.floor((f - start) * cps)));

/** Fades and lifts children in at `at`, and out again at `out` if given. */
export const Rise: React.FC<{
  at: number;
  out?: number;
  dy?: number;
  dur?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ at, out, dy = 28, dur = 20, style, children }) => {
  const f = useCurrentFrame();
  const t = prog(f, at, dur);
  const o = out === undefined ? 0 : prog(f, out, 14, easeInOut);
  return (
    <div style={{ opacity: t * (1 - o), transform: `translateY(${(1 - t) * dy - o * 18}px)`, ...style }}>
      {children}
    </div>
  );
};

/** The left column every step shares: number, headline, plain caption. */
export const StepHeader: React.FC<{
  n: string;
  title: React.ReactNode;
  caption: string;
  at?: number;
}> = ({ n, title, caption, at = 0 }) => {
  const f = useCurrentFrame();
  const rule = prog(f, at + 4, 26);
  return (
    <div style={{ position: "absolute", left: 150, top: 190, width: 640 }}>
      <Rise at={at} dy={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: font.mono, fontSize: 30, fontWeight: 500, color: day.brass, letterSpacing: "0.04em" }}>
          <span>{n}</span>
          <span style={{ height: 2, width: 120 * rule, background: day.brass, borderRadius: 2 }} />
          <span style={{ color: day.muted, fontWeight: 400 }}>of 04</span>
        </div>
      </Rise>
      <Rise at={at + 5} dy={34} dur={24}>
        <h2 style={{ margin: "26px 0 0", fontFamily: font.read, fontWeight: 600, fontSize: 112, lineHeight: 1.0, letterSpacing: "-0.03em", color: day.ink }}>
          {title}
        </h2>
      </Rise>
      <Rise at={at + 14} dy={22}>
        <p style={{ margin: "34px 0 0", fontFamily: font.ui, fontSize: 38, lineHeight: 1.35, color: day.muted, maxWidth: 600 }}>
          {caption}
        </p>
      </Rise>
    </div>
  );
};

export type Mood = "idle" | "read" | "nod" | "think" | "poke" | "sleep" | "cheer";

/** Compad on the video clock. Frame durations come from the sprite data;
 *  looping moods wrap and one-shot moods hold their last frame. */
export const Compad: React.FC<{ mood: Mood; since?: number; px: number; style?: React.CSSProperties }> = ({
  mood,
  since = 0,
  px,
  style,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = COZY_PIXEL_BATTERY_ANIMATIONS[mood];
  const frames = anim.frames;
  const per = anim.frameDurationMs ?? 1000 / (anim.fps ?? 6);
  const dur = (i: number) => frames[i].durationMs ?? per;
  const total = frames.reduce((sum, _, i) => sum + dur(i), 0);
  let t = (Math.max(0, f - since) / fps) * 1000;
  if (anim.loop) t %= total;
  let i = 0;
  while (i < frames.length - 1 && t >= dur(i)) t -= dur(i++);
  const frame = frames[i];
  return (
    <svg
      width={BATTERY_WIDTH * px}
      height={BATTERY_HEIGHT * px}
      viewBox={`0 0 ${BATTERY_WIDTH} ${BATTERY_HEIGHT}`}
      shapeRendering="crispEdges"
      style={{ display: "block", overflow: "visible", ...style }}
    >
      <g transform={`translate(${frame.offsetX ?? 0} ${frame.offsetY ?? 0})`}>
        {(frame.runs ?? []).map((run, k) => {
          const [x, y, w, h, c] = run as readonly [number, number, number, number | string, string?];
          return (
            <rect
              key={k}
              x={x}
              y={y}
              width={w}
              height={typeof h === "number" ? h : 1}
              fill={typeof h === "string" ? h : c}
            />
          );
        })}
      </g>
    </svg>
  );
};

/** Compad parked under the step copy, with a soft shadow on the desk. */
export const Guide: React.FC<{ mood: Mood; since?: number; at?: number; out?: number }> = ({ mood, since, at = 0, out }) => {
  const f = useCurrentFrame();
  const t = pop(f, at, 22);
  const o = out === undefined ? 0 : prog(f, out, 12, easeInOut);
  return (
    <div style={{ position: "absolute", left: 150, top: 742, opacity: Math.min(1, t) * (1 - o), transform: `translateY(${(1 - t) * 60}px) scale(${0.7 + 0.3 * t})`, transformOrigin: "50% 100%" }}>
      <Compad mood={mood} since={since} px={5} />
    </div>
  );
};

type IconName = "check" | "x" | "lock" | "laptop" | "cloud" | "key" | "spark" | "flag" | "clock";

const PATHS: Record<IconName, React.ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  laptop: (
    <>
      <rect x="4.5" y="5.5" width="15" height="10" rx="1.5" />
      <path d="M2.5 18.5h19" />
    </>
  ),
  cloud: <path d="M7.5 18.5h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7.5 18.5z" />,
  key: (
    <>
      <circle cx="8" cy="15" r="3.5" />
      <path d="M10.5 12.5l8-8M15.5 7.5l2.5 2.5" />
    </>
  ),
  spark: <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4L18 18M18 6l-2.6 2.6M8.6 15.4L6 18" />,
  flag: <path d="M6 20.5v-16M6 4.5h11l-2.5 4 2.5 4H6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
};

export const Icon: React.FC<{ name: IconName; size: number; color: string; weight?: number; draw?: number }> = ({
  name,
  size,
  color,
  weight = 1.8,
  draw,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={weight}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}
    {...(draw === undefined ? {} : { strokeDasharray: 40, strokeDashoffset: 40 * (1 - draw) })}
  >
    {PATHS[name]}
  </svg>
);

/** A file as it sits in the sources list: type tag, name, size. */
export type Source = { name: string; meta: string; tag: string; tagBg: string; tagInk: string };

export const SOURCES: Source[] = [
  { name: "Lecture 7.pdf", meta: "42 pages", tag: "PDF", tagBg: day.rust, tagInk: day.ground },
  { name: "Week 3 notes.md", meta: "4 pages", tag: "Notes", tagBg: day.candle, tagInk: day.leather },
  { name: "Lab notes.docx", meta: "6 pages", tag: "Doc", tagBg: day.ink, tagInk: day.ground },
  { name: "Photo of my notes", meta: "1 photo", tag: "Photo", tagBg: day.sage, tagInk: day.ground },
  { name: "Osmosis, explained", meta: "Web page", tag: "Link", tagBg: day.brass, tagInk: day.ground },
  { name: "Textbook ch. 4.pdf", meta: "31 pages", tag: "PDF", tagBg: day.rust, tagInk: day.ground },
];

export const SourceRow: React.FC<{ s: Source; ready?: number }> = ({ s, ready = 0 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18, width: "100%", height: "100%", padding: "0 22px" }}>
    <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 19, letterSpacing: "0.02em", padding: "6px 12px", borderRadius: 8, background: s.tagBg, color: s.tagInk, minWidth: 74, textAlign: "center" }}>
      {s.tag}
    </span>
    <span style={{ fontFamily: font.ui, fontWeight: 500, fontSize: 27, color: day.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{s.name}</span>
    <span style={{ fontFamily: font.mono, fontSize: 20, color: day.muted, whiteSpace: "nowrap" }}>{s.meta}</span>
    <span style={{ width: 34, opacity: ready, transform: `scale(${0.6 + 0.4 * ready})` }}>
      <Icon name="check" size={30} color={day.sage} weight={2.4} draw={ready} />
    </span>
  </div>
);

/** A paper window: the notebook surface every demo sits on. */
export const Sheet: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; lifted?: boolean }> = ({ style, children, lifted }) => (
  <div
    style={{
      position: "absolute",
      background: day.surface,
      borderRadius: 22,
      border: `1px solid ${day.hairlineStrong}`,
      boxShadow: lifted ? day.lift : day.elev,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

/** The window header: three quiet dots and a title, like the desk app. */
export const SheetBar: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div style={{ height: 70, display: "flex", alignItems: "center", gap: 14, padding: "0 26px", borderBottom: `1px solid ${day.hairline}` }}>
    {[0, 1, 2].map((i) => (
      <span key={i} style={{ width: 13, height: 13, borderRadius: 7, background: day.raised, border: `1px solid ${day.hairlineStrong}` }} />
    ))}
    <span style={{ marginLeft: 12, fontFamily: font.ui, fontWeight: 600, fontSize: 25, color: day.ink }}>{title}</span>
    <span style={{ marginLeft: "auto" }}>{right}</span>
  </div>
);
