import React from "react";
import { AbsoluteFill } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Rail } from "./backdrop";
import { AddScene, AskScene, PlanScene, PracticeScene } from "./steps";
import { FinaleScene, TrustScene } from "./closing";
import { day } from "./theme";
import { loadFonts } from "./fonts";

loadFonts();

const SCENES = [
  { id: "add", len: 285, C: AddScene },
  { id: "ask", len: 225, C: AskScene },
  { id: "practice", len: 225, C: PracticeScene },
  { id: "plan", len: 135, C: PlanScene },
  { id: "trust", len: 120, C: TrustScene },
  { id: "finale", len: 150, C: FinaleScene },
] as const;

const XFADE = 15;

/** Global frame each scene starts on, once the cross-fades overlap them. */
const STARTS = SCENES.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SCENES[i - 1].len - XFADE], []);

export const HOW_DURATION = STARTS[STARTS.length - 1] + SCENES[SCENES.length - 1].len;

/** Step 01 begins after the hook, 120 frames into the first scene. */
const RAIL_STARTS = [120, STARTS[1], STARTS[2], STARTS[3]] as const;

export const HowItWorks: React.FC = () => (
  <AbsoluteFill style={{ background: day.ground }}>
    <TransitionSeries>
      {SCENES.flatMap(({ id, len, C }, i) => [
        ...(i === 0 ? [] : [<TransitionSeries.Transition key={`${id}-x`} presentation={fade()} timing={linearTiming({ durationInFrames: XFADE })} />]),
        <TransitionSeries.Sequence key={id} durationInFrames={len}>
          <C />
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
    <Rail starts={RAIL_STARTS} end={STARTS[4] + 4} />
  </AbsoluteFill>
);
