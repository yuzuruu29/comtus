import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";

const fraunces = loadFraunces("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

const frauncesItalic = loadFraunces("italic", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

const inter = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

const jetbrains = loadJetBrainsMono("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

export const fontDisplay = fraunces.fontFamily;
export const fontDisplayItalic = frauncesItalic.fontFamily;
export const fontBody = inter.fontFamily;
export const fontMono = jetbrains.fontFamily;
