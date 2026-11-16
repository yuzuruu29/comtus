import React from "react";
import { Composition } from "remotion";
import { HOW_DURATION, HowItWorks } from "./HowItWorks";
import { FPS } from "./theme";

export const HowRoot: React.FC = () => (
  <Composition id="ComtusHowItWorks" component={HowItWorks} durationInFrames={HOW_DURATION} fps={FPS} width={1920} height={1080} />
);
