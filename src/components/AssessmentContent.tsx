import { useId } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mathRemarkPlugins, mathRehypePlugins } from "../lib/markdownMath";
import { normalizeAssessmentContent, validateQuestionGraph, formatGraphTick } from "../lib/assessmentContent";
import type { QuestionGraph } from "../lib/types";
import "./assessmentContent.css";

export function AssessmentContent({ children, className = "", inline = false }: { children: string; className?: string; inline?: boolean }) {
  const Tag = inline ? "span" : "div";
  return <Tag className={`assessment-content ${inline ? "assessment-inline" : ""} ${className}`}>
    <Markdown remarkPlugins={[remarkGfm, ...mathRemarkPlugins]} rehypePlugins={mathRehypePlugins}
      skipHtml disallowedElements={["img", "input"]} unwrapDisallowed
      components={{ a: ({ children }) => <span>{children}</span>, p: ({ children }) => <span className="assessment-paragraph">{children}</span>,
        table: ({ children }) => <span className="assessment-table"><table>{children}</table></span> }}>
      {normalizeAssessmentContent(children)}
    </Markdown>
  </Tag>;
}

export function AssessmentGraph({ graph }: { graph: QuestionGraph }) {
  const id = useId();
  const g = validateQuestionGraph(graph);
  if (!g) return <p role="alert">This graph could not be displayed. Regenerate this assessment before answering.</p>;
  const points = g.series.flatMap(s => s.points);
  const extent = (axis: 0 | 1): [number, number] => {
    const lo = Math.min(...points.map(p => p[axis])), hi = Math.max(...points.map(p => p[axis]));
    const pad = Math.max((hi - lo) * .08, Math.abs(lo) * .01, 1e-6);
    return [lo - pad, hi + pad];
  };
  const [xmin, xmax] = g.xRange ?? extent(0), [ymin, ymax] = g.yRange ?? extent(1);
  const x = (v: number) => 78 + (v - xmin) / (xmax - xmin) * 414;
  const y = (v: number) => 270 - (v - ymin) / (ymax - ymin) * 235;
  const axisLabel = (label: string, limit: number) => label.length > limit ? `${label.slice(0, limit - 1)}…` : label;
  return <figure className="assessment-graph">
    <figcaption>{g.title}</figcaption>
    <p className="assessment-graph-scroll-hint">Scroll the graph horizontally to read both axes.</p>
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The overflow region needs keyboard scrolling. */}
    <div className="assessment-plot" role="region" aria-label={`${g.title}: scrollable graph`} tabIndex={0}>
    <svg viewBox="0 0 540 330" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{g.title}</title>
      <desc id={`${id}-desc`}>{g.xLabel} on the horizontal axis; {g.yLabel} on the vertical axis. Series: {g.series.map(s => s.label).join(", ")}. Exact coordinates are in Graph data below.</desc>
      {[0, 1, 2, 3, 4].map(i => {
        const xv = xmin + (xmax - xmin) * i / 4, yv = ymin + (ymax - ymin) * i / 4;
        return <g key={i}>
          <path className="assessment-grid" d={`M${x(xv)} 35V270 M78 ${y(yv)}H492`} />
          <text x={x(xv)} y={289} textAnchor="middle">{formatGraphTick(xv, (xmax - xmin) / 4)}</text>
          <text x={69} y={y(yv) + 4} textAnchor="end">{formatGraphTick(yv, (ymax - ymin) / 4)}</text>
        </g>;
      })}
      <path className="assessment-axis" d={`M78 35V270H492${xmin <= 0 && xmax >= 0 ? ` M${x(0)} 35V270` : ""}${ymin <= 0 && ymax >= 0 ? ` M78 ${y(0)}H492` : ""}`} />
      {g.series.map((s, i) => <g key={i} className={`assessment-series assessment-series-${i}`}>
        <polyline fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={i % 2 ? "7 4" : undefined} points={s.points.map(([a, b]) => `${x(a)},${y(b)}`).join(" ")} />
        {s.points.map(([a, b], n) => <circle key={n} cx={x(a)} cy={y(b)} r="3" fill="currentColor" />)}
      </g>)}
      <text x="285" y="320" textAnchor="middle"><title>{g.xLabel}</title>{axisLabel(g.xLabel, 60)}</text>
      <text transform="translate(16 155) rotate(-90)" textAnchor="middle"><title>{g.yLabel}</title>{axisLabel(g.yLabel, 36)}</text>
    </svg>
    </div>
    <ul className="assessment-legend">{g.series.map((s, i) => <li key={i} className={`assessment-series assessment-series-${i}`}><span aria-hidden="true">{i % 2 ? "┄" : "━"}</span> {s.label}</li>)}</ul>
    <details><summary>Graph data</summary><div className="assessment-table"><table><thead><tr><th>Series</th><th>{g.xLabel}</th><th>{g.yLabel}</th></tr></thead><tbody>{g.series.flatMap((s, i) => s.points.map(([a, b], j) => <tr key={`${i}-${j}`}><th scope="row">{s.label}</th><td>{a}</td><td>{b}</td></tr>))}</tbody></table></div></details>
  </figure>;
}
