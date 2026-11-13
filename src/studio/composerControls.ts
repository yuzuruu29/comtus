import type { Effort } from "../lib/types";

export const EFFORT_STEPS: readonly Effort[] = ["low", "medium", "high", "xhigh"];
export const WEB_EFFORT_STEPS: readonly Effort[] = ["low", "medium", "high"];

export function effortStepsFor(includeExtraDeep: boolean): readonly Effort[] {
  return includeExtraDeep ? EFFORT_STEPS : WEB_EFFORT_STEPS;
}

export function effortToStep(effort: Effort, steps: readonly Effort[] = EFFORT_STEPS): number {
  const index = steps.indexOf(effort);
  const topStep = steps.length - 1;
  return index < 0 ? Math.min(2, topStep) : index;
}

export function stepToEffort(step: number, steps: readonly Effort[] = EFFORT_STEPS): Effort {
  const topStep = steps.length - 1;
  const clamped = Math.max(0, Math.min(topStep, Math.round(step)));
  return steps[clamped] ?? "high";
}

export function stepFromTrackX({
  clientX,
  left,
  width,
  steps = EFFORT_STEPS,
}: {
  clientX: number;
  left: number;
  width: number;
  steps?: readonly Effort[];
}): number {
  const topStep = steps.length - 1;
  const pad = 12;
  const innerWidth = width - pad * 2;
  if (innerWidth <= 0) return Math.min(2, topStep);
  const t = Math.max(0, Math.min(1, (clientX - (left + pad)) / innerWidth));
  return stepToEffortIndex(t * topStep, topStep);
}

function stepToEffortIndex(step: number, topStep: number): number {
  return Math.max(0, Math.min(topStep, Math.round(step)));
}
