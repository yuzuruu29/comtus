import { renderToStaticMarkup } from "react-dom/server";
import html2canvas from "html2canvas";
import katexCss from "katex/dist/katex.min.css?inline";
import assessmentCss from "../components/assessmentContent.css?inline";
import { AssessmentContent, AssessmentGraph } from "../components/AssessmentContent";
import type { QuestionGraph } from "./types";

export interface AssessmentImage {
  data: string;
  width: number;
  height: number;
}

export function findPageBreak(blankRows: boolean[], start: number, limit: number): number {
  const end = Math.min(blankRows.length, start + limit);
  if (end === blankRows.length) return end;
  for (let y = end; y > start + limit / 2; y--) {
    if (blankRows[y] && blankRows[y - 1]) return y;
  }
  return start;
}

export function createAssessmentCapture(dark = false) {
  const background = dark ? "#111827" : "#ffffff";
  const ink = dark ? "#f3ead8" : "#21242e";
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:-12000px;top:0;width:1000px;height:1000px;border:0;pointer-events:none";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not create the assessment export document.");
  }
  doc.open();
  doc.write('<!doctype html><html><head></head><body><main></main></body></html>');
  doc.close();
  const style = doc.createElement("style");
  style.textContent = `${katexCss}\n${assessmentCss}
    :root { color-scheme: ${dark ? "dark" : "light"}; --color-ink:${ink}; --color-brass:${dark ? "#e3b04b" : "#8f6a1f"}; --color-sage:${dark ? "#a0c5ad" : "#426c50"}; --color-rust:#b3543f; }
    * { box-sizing:border-box; } body { margin:0; background:${background}; color:${ink}; }
    main { width:1000px; padding:8px; font: ${dark ? 28 : 23}px/1.5 Arial,sans-serif; overflow:visible; }
    p { margin:0 0 10px; } p:last-child { margin-bottom:0; }
    .assessment-content { min-width:0; overflow:visible; } .katex { color:inherit; font-size:1.15em; }
    .assessment-content .katex-display, .assessment-content .katex:not(.katex-display .katex), .assessment-table { max-width:none; overflow:visible; }
    .katex-display { margin:12px 0; text-align:left; overflow:visible; } .katex-display>.katex { text-align:left; }
    table { border-collapse:collapse; width:100%; } th,td { border:1px solid #9ba3b5; padding:6px 10px; text-align:left; }
    figure.assessment-graph { margin:0; max-width:none; } .assessment-graph details { display:none; } svg { max-width:100%; height:auto; } figcaption { font-weight:bold; margin-bottom:12px; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); }
    a { color:inherit; } img { max-width:100%; }`;
  doc.head.appendChild(style);
  const root = doc.querySelector("main")!;

  return {
    async render(content: string | QuestionGraph, maxAspect: number): Promise<AssessmentImage[]> {
      root.innerHTML = renderToStaticMarkup(typeof content === "string"
        ? <AssessmentContent>{content}</AssessmentContent>
        : <AssessmentGraph graph={content} />);
      root.getBoundingClientRect();
      await doc.fonts.ready;
      for (const svg of root.querySelectorAll("svg")) {
        for (const node of [svg, ...svg.querySelectorAll("*")]) {
          const computed = doc.defaultView!.getComputedStyle(node);
          for (const property of ["color", "fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-family", "font-size", "font-weight"]) {
            (node as SVGElement).style.setProperty(property, computed.getPropertyValue(property));
          }
        }
      }
      const width = Math.max(1000, root.scrollWidth);
      const height = Math.ceil(root.getBoundingClientRect().height);
      if (width > 8000 || height > 16000 || width * height > 16_000_000) throw new Error("This assessment block is too large to export. Split it into shorter items.");
      const canvas = await html2canvas(root, { backgroundColor: background, scale: 2, width, height,
        logging: false, windowWidth: width, windowHeight: height });
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not render the assessment export.");
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const rgb = background.match(/[a-f\d]{2}/gi)!.map((v) => parseInt(v, 16));
      const blankRows = Array.from({ length: canvas.height }, (_, y) => {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (Math.abs(pixels[i] - rgb[0]) > 8 || Math.abs(pixels[i + 1] - rgb[1]) > 8 || Math.abs(pixels[i + 2] - rgb[2]) > 8) return false;
        }
        return true;
      });
      const images: AssessmentImage[] = [];
      const limit = Math.floor(canvas.width * maxAspect);
      for (let start = 0; start < canvas.height;) {
        let end = typeof content === "string" ? findPageBreak(blankRows, start, limit) : canvas.height;
        if (end === start) {
          end = Math.min(start + limit, canvas.height);
          while (end < canvas.height && !blankRows[end]) end++;
        }
        const part = doc.createElement("canvas");
        part.width = canvas.width;
        part.height = end - start;
        part.getContext("2d")!.drawImage(canvas, 0, start, canvas.width, part.height, 0, 0, canvas.width, part.height);
        images.push({ data: part.toDataURL("image/png"), width: part.width, height: part.height });
        start = end;
      }
      return images;
    },
    close() { iframe.remove(); },
  };
}
