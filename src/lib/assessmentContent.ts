import type { QuestionGraph, QuizQuestion } from "./types";

export function assessmentGradingStem(question: QuizQuestion): string {
  return question.graph ? `${question.stem}\nGraph data (given to the student): ${JSON.stringify(question.graph)}` : question.stem;
}

export function assessmentOptionLabel(option: string, index: number): string {
  const text = normalizeAssessmentContent(option)
    .replace(/\\begin\{[bp]?matrix\}([\s\S]*?)\\end\{[bp]?matrix\}/g, (_, body: string) => `matrix: ${body.split(/\\\\/).map((row, i) => `row ${i + 1}: ${row.replace(/&/g, ",").trim()}`).join("; ")}`)
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "fraction $1 over $2")
    .replace(/_\{([^{}]*)\}|_([a-zA-Z0-9])/g, " subscript $1$2 ")
    .replace(/\^\{([^{}]*)\}|\^([a-zA-Z0-9])/g, " to the power $1$2 ")
    .replace(/(?<!\\)\$/g, "").replace(/\\\$/g, " dollars ")
    .replace(/\\([a-zA-Z]+)/g, "$1 ").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  return `${String.fromCharCode(65 + index)}. ${text}`;
}

export function formatGraphTick(value: number, step: number): string {
  const precision = Math.min(17, Math.max(15, Math.ceil(Math.log10(Math.max(Math.abs(value), step) / step)) + 2));
  return Number(value.toPrecision(precision)).toString();
}

/** Keep existing code and math intact; upgrade only rectangular numeric arrays. */
export function normalizeAssessmentContent(source: string): string {
  return source.split(/(```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|(?<!\\)\$(?!\s)(?!\d[\d,.]*[ \t]+[^$\\=+*/^_-]*\$)[^$\n]*?\S\$(?!\d)|(?<!\\)\$[^\s$]\$(?!\d))/g)
    .map((part, i) => {
      if (i % 2) return part;
      return part.replace(/(?<!\\)\$/g, "\\$").replace(/\[\s*\[[^\[\]]+\](?:\s*,\s*\[[^\[\]]+\])+\s*\]/g, (value) => {
        try {
          const rows: unknown = JSON.parse(value);
          if (!Array.isArray(rows) || rows.length > 20 || !rows.every(row => Array.isArray(row) && row.length > 0 && row.length <= 20 && row.length === rows[0].length && row.every(n => typeof n === "number" && Number.isFinite(n)))) return value;
          return "$\\begin{bmatrix}" + rows.map(row => row.join(" & ")).join(" \\\\ ") + "\\end{bmatrix}$";
        } catch { return value; }
      });
    }).join("");
}

export function validateQuestionGraph(value: unknown): QuestionGraph | null {
  if (!value || typeof value !== "object") return null;
  const g = value as Record<string, unknown>;
  const label = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 120;
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e9;
  const range = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(finite) && v[1] - v[0] >= 1e-9;
  if (!label(g.title) || !label(g.xLabel) || !label(g.yLabel) || !Array.isArray(g.series) || g.series.length < 1 || g.series.length > 6) return null;
  if ((g.xRange !== undefined && !range(g.xRange)) || (g.yRange !== undefined && !range(g.yRange))) return null;
  const series: QuestionGraph["series"] = [];
  for (const raw of g.series) {
    if (!raw || typeof raw !== "object" || !label(raw.label) || !Array.isArray(raw.points) || raw.points.length < 2 || raw.points.length > 100) return null;
    if (!raw.points.every((p: unknown) => Array.isArray(p) && p.length === 2 && p.every(finite))) return null;
    const points = raw.points as [number, number][];
    if (points.some(([x, y]) => (range(g.xRange) && (x < g.xRange[0] || x > g.xRange[1])) || (range(g.yRange) && (y < g.yRange[0] || y > g.yRange[1])))) return null;
    series.push({ label: raw.label, points });
  }
  return { title: g.title, xLabel: g.xLabel, yLabel: g.yLabel, series, ...(range(g.xRange) ? { xRange: g.xRange } : {}), ...(range(g.yRange) ? { yRange: g.yRange } : {}) };
}
