import { cancelRender, continueRender, delayRender } from "remotion";
// The app's own self-hosted faces, resolved from the root workspace's
// @fontsource packages so the film never drifts from the product type.
import literata from "@fontsource-variable/literata/files/literata-latin-opsz-normal.woff2";
import literataItalic from "@fontsource-variable/literata/files/literata-latin-opsz-italic.woff2";
import instrument from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2";
import mono400 from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2";
import mono500 from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2";

const FACES: [string, string, FontFaceDescriptors][] = [
  ["Literata", literata, { style: "normal", weight: "200 900" }],
  ["Literata", literataItalic, { style: "italic", weight: "200 900" }],
  ["Instrument Sans", instrument, { style: "normal", weight: "400 700" }],
  ["JetBrains Mono", mono400, { style: "normal", weight: "400" }],
  ["JetBrains Mono", mono500, { style: "normal", weight: "500" }],
];

let started = false;

/** Call at module level. promo/package.json marks only CSS as having side
 *  effects, so a bare `import "./fonts"` would be tree-shaken away. */
export function loadFonts() {
  if (started) return;
  started = true;
  // Layouts measure text, so no frame may render before every face is usable.
  const handle = delayRender("Loading Comtus fonts");
  Promise.all(
    FACES.map(async ([family, url, desc]) => {
      const face = new FontFace(family, `url(${url}) format("woff2")`, desc);
      document.fonts.add(await face.load());
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => cancelRender(err));
}
