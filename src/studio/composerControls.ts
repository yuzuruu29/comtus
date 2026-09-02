import type { Effort } from "../lib/types";

export const EFFORT_STEPS: readonly Effort[] = ["low", "medium", "high", "xhigh"];
const TOP_STEP = EFFORT_STEPS.length - 1;

export function effortToStep(effort: Effort): number {
  const index = EFFORT_STEPS.indexOf(effort);
  return index < 0 ? 2 : index;
}

export function stepToEffort(step: number): Effort {
  const clamped = Math.max(0, Math.min(TOP_STEP, Math.round(step)));
  return EFFORT_STEPS[clamped] ?? "high";
}

export function stepFromTrackX({
  clientX,
  left,
  width,
}: {
  clientX: number;
  left: number;
  width: number;
}): number {
  const pad = 12;
  const innerWidth = width - pad * 2;
  if (innerWidth <= 0) return 2;
  const t = Math.max(0, Math.min(1, (clientX - (left + pad)) / innerWidth));
  return stepToEffortIndex(t * TOP_STEP);
}

function stepToEffortIndex(step: number): number {
  return Math.max(0, Math.min(TOP_STEP, Math.round(step)));
}
