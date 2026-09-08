import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssessmentContent, AssessmentGraph } from "./AssessmentContent";
import { normalizeAssessmentContent, validateQuestionGraph, assessmentGradingStem, assessmentOptionLabel, formatGraphTick } from "../lib/assessmentContent";
import { ASSESSMENT_FORMAT_RULES, sanitizeQuestions } from "../studio/generators/common";

const graph = { title: "Market schedules", xLabel: "Quantity", yLabel: "Price", series: [{ label: "Demand", points: [[0, 10], [10, 0]] as [number, number][] }], xRange: [0, 10] as [number, number], yRange: [0, 10] as [number, number] };

describe("assessment formatting", () => {
  it("keeps currency adjacent to formulas out of the math delimiters", () => {
    for (const value of ["Costs $20 and $P_t$...", "$20 each; use $x$.", "A basket costs $30 ($I_t=150$)."] ) {
      const { container, unmount } = render(<AssessmentContent>{value}</AssessmentContent>);
      expect(container.querySelectorAll("math")).toHaveLength(1);
      expect(container.querySelector("math")?.textContent).not.toContain("costs");
      expect(container.textContent).toMatch(/\$(20|30)/);
      unmount();
    }
    expect(normalizeAssessmentContent("A basket costs $30 ($I_t=150$).")).toBe("A basket costs \\$30 ($I_t=150$).");
  });
  it("gives matrix buttons readable names and keeps closely spaced graph ticks distinct", () => {
    expect(assessmentOptionLabel("[[2,-6],[0,8]]", 0)).toBe("A. matrix: row 1: 2 , -6; row 2: 0 , 8");
    expect(assessmentOptionLabel(String.raw`$Q_{d}=\frac{100}{P^{2}}$`, 1)).toContain("subscript d");
    const ticks = [0, 1, 2, 3, 4].map(i => formatGraphTick(100000 + i / 4, .25));
    expect(new Set(ticks).size).toBe(5);
    expect(ticks).toEqual(["100000", "100000.25", "100000.5", "100000.75", "100001"]);
    expect(formatGraphTick(27.5, 27.5)).toBe("27.5");
    expect(formatGraphTick(82.5, 27.5)).toBe("82.5");
    expect(formatGraphTick(25.1, 25)).toBe("25.1");
    expect(formatGraphTick(0.1 + 0.2, 0.1)).toBe("0.3");
  });
  it("typesets the screenshot's numeric matrices and economics notation", () => {
    const { container } = render(<AssessmentContent>{String.raw`Compute 2A for A = [[1, -3], [0, 4]]. $Q_{d}=\frac{100}{P^{2}}$`}</AssessmentContent>);
    expect(container.querySelectorAll("math")).toHaveLength(2);
    expect(container.querySelector("mtable")).not.toBeNull();
    expect(container.querySelector("mfrac")).not.toBeNull();
    expect(container.querySelector("msub")).not.toBeNull();
  });
  it("preserves currency, code and invalid arrays", () => {
    const { container } = render(<AssessmentContent>{"Costs $100 and $200. Budget $50. `[[1,2],[3,4]]` [[1,2],[3]]"}</AssessmentContent>);
    expect(container.querySelector("math")).toBeNull();
    expect(container.textContent).toContain("Costs $100 and $200. Budget $50.");
    expect(container.querySelector("code")?.textContent).toBe("[[1,2],[3,4]]");
    expect(normalizeAssessmentContent("[[1,2],[3]]")).toBe("[[1,2],[3]]");
  });
  it("keeps existing LaTeX and never introduces interactive option children", () => {
    const value = String.raw`$\begin{bmatrix}1 & 2 \\ 3 & 4\end{bmatrix}$`;
    expect(normalizeAssessmentContent(value)).toBe(value);
    const { container } = render(<button><AssessmentContent inline>{String.raw`[reference](https://example.com) $\invalidcommand{x}$ <script>alert(1)</script>`}</AssessmentContent></button>);
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector("a,script,img,input")).toBeNull();
    expect(container.textContent).toContain("invalidcommand");
  });
  it("validates graph bounds and rejects unusable generated graph questions", () => {
    expect(validateQuestionGraph(graph)).toEqual(graph);
    expect(validateQuestionGraph({ ...graph, xRange: [5, 5] })).toBeNull();
    expect(validateQuestionGraph({ ...graph, xRange: [1, 10] })).toBeNull();
    expect(validateQuestionGraph({ ...graph, series: [{ label: "Bad", points: [[0, Infinity], [1, 2]] }] })).toBeNull();
    expect(() => sanitizeQuestions([{ stem: "Read this graph", graph: {}, options: ["A", "B"] }])).toThrow(/graph/);
    const question = sanitizeQuestions([{ stem: "Read this graph", graph, options: ["A", "B"] }])[0];
    expect(question.graph).toEqual(graph);
    expect(assessmentGradingStem(question)).toContain(JSON.stringify(graph));
    expect(sanitizeQuestions([null, { stem: "Legacy question", options: ["A", "B"] }])).toHaveLength(1);
  });
  it("renders an accessible labeled graph with exact coordinate fallback", () => {
    const { container } = render(<AssessmentGraph graph={graph} />);
    expect(screen.getByRole("img", { name: /Market schedules/ })).toBeTruthy();
    expect(screen.getByRole("region", { name: /scrollable graph/ }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByText("Graph data")).toBeTruthy();
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });
  it("instructs valid JSON math, plain identification keys and grounded graph data", () => {
    expect(ASSESSMENT_FORMAT_RULES).toContain("escape EVERY LaTeX backslash");
    expect(ASSESSMENT_FORMAT_RULES).toContain("plain-text answer");
    expect(ASSESSMENT_FORMAT_RULES).toContain("no marked correct answer");
  });
});
