export const HOUSE_EASE = "power3.out";
export const PIXEL_STEPS = "power3.out";
export const PIXEL_HOP = "power2.out";
export const PIXEL_SNAP = "cubic-bezier(0.16, 1, 0.3, 1)";
export const PAPER_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
export const QUILL_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

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
