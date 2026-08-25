import type { Effort } from "../lib/types";

export const EFFORT_STEPS: readonly Effort[] = ["medium", "high", "xhigh"];
const TOP_STEP = EFFORT_STEPS.length - 1;

export function effortToStep(effort: Effort): number {
  const index = EFFORT_STEPS.indexOf(effort);
  return index < 0 ? 1 : index;
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
  if (width <= 0) return 1;
  const t = (clientX - left) / width;
  return stepToEffortIndex(t * TOP_STEP);
}

function stepToEffortIndex(step: number): number {
  return Math.max(0, Math.min(TOP_STEP, Math.round(step)));
}
