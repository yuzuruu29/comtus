import { useVideoConfig } from "remotion";

/** Scale type and spacing from composition width (1920 baseline). */
export const useBrandScale = () => {
  const { width, height } = useVideoConfig();
  const s = Math.min(width, height) / (width >= height ? 1080 : 1080);
  const landscapeBoost = width > height ? width / 1920 : s;

  return {
    s: landscapeBoost,
    isVertical: height > width,
    isSquare: Math.abs(width - height) < 40,
    display: (px: number) => Math.round(px * landscapeBoost),
    body: (px: number) => Math.round(px * landscapeBoost),
  };
};
