export const HOUSE_EASE = "power3.out";
export const PIXEL_STEPS = "steps(6)";
export const PIXEL_HOP = "steps(4)";

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function applyLandingPixel(on: boolean): void {
  if (on) document.documentElement.dataset.landingPixel = "on";
  else {
    delete document.documentElement.dataset.landingPixel;
    delete document.documentElement.dataset.lamp;
  }
}
