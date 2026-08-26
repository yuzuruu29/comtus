import React from "react";
import { AbsoluteFill } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { HookScene } from "./scenes/HookScene";
import { TaglineScene } from "./scenes/TaglineScene";
import { ManifestoScene } from "./scenes/ManifestoScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { PrivacyScene } from "./scenes/PrivacyScene";
import { CtaScene } from "./scenes/CtaScene";

const FPS = 30;

export const SCENE = {
  hook: 120,
  tagline: 135,
  manifesto: 165,
  features: 210,
  privacy: 150,
  cta: 180,
} as const;

export const TRANSITION = 22;

export const PROMO_DURATION =
  SCENE.hook +
  SCENE.tagline +
  SCENE.manifesto +
  SCENE.features +
  SCENE.privacy +
  SCENE.cta -
  TRANSITION * 5;

const timing = () => linearTiming({ durationInFrames: TRANSITION });

export const ComtusPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0F1A" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE.hook}>
          <HookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing()} />

        <TransitionSeries.Sequence durationInFrames={SCENE.tagline}>
          <TaglineScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing()} />

        <TransitionSeries.Sequence durationInFrames={SCENE.manifesto}>
          <ManifestoScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing()} />

        <TransitionSeries.Sequence durationInFrames={SCENE.features}>
          <FeaturesScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing()} />

        <TransitionSeries.Sequence durationInFrames={SCENE.privacy}>
          <PrivacyScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing()} />

        <TransitionSeries.Sequence durationInFrames={SCENE.cta}>
          <CtaScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

export { FPS };
