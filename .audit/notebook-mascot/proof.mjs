import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/components/pixel/pixelBatteryFrames.tsx", "utf8");
const { outputText: code } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { COZY_PIXEL_BATTERY_ANIMATIONS: animations } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const modes = Object.entries(animations);
const rows = [
  { background: "#F5F1E8", text: "#27372E", name: "Daylight" },
  { background: "#0B0F1A", text: "#F5ECDC", name: "Lamplight" },
];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="520" viewBox="0 0 1080 520">
${rows.map((theme, row) => `<g transform="translate(0 ${row * 260})">
<rect width="1080" height="260" fill="${theme.background}"/>
<text x="24" y="26" fill="${theme.text}" font-family="sans-serif" font-size="12">${theme.name} · Notebook companion · 36 × 38 pixels</text>
${modes.map(([name, animation], column) => `<g transform="translate(${column * 180 + 18} 44)">
<g transform="scale(4)" shape-rendering="crispEdges">${animation.frames[0].runs.map((run) => {
  const [x, y, width] = run;
  const height = run.length === 5 ? run[3] : 1;
  const fill = run.length === 5 ? run[4] : run[3];
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}).join("")}</g>
<text x="72" y="182" text-anchor="middle" fill="${theme.text}" font-family="sans-serif" font-size="13">${name}</text>
</g>`).join("")}</g>`).join("")}
</svg>`;
await writeFile(".audit/notebook-mascot/notebook-mascot-proof.svg", svg);
console.log("Saved .audit/notebook-mascot/notebook-mascot-proof.svg from the actual exported frames.");
