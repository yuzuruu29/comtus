import React from "react";
import { Composition } from "remotion";
import { ComtusPromo, FPS, PROMO_DURATION } from "./ComtusPromo";
import "./index.css";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ComtusPromo"
        component={ComtusPromo}
        durationInFrames={PROMO_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="ComtusPromoSquare"
        component={ComtusPromo}
        durationInFrames={PROMO_DURATION}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="ComtusPromoVertical"
        component={ComtusPromo}
        durationInFrames={PROMO_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};
