export const HOUSE_EASE = "power3.out";
export const PIXEL_STEPS = "power3.out";
export const PIXEL_HOP = "power2.out";
export const PIXEL_SNAP = "cubic-bezier(0.16, 1, 0.3, 1)";
export const PAPER_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
export const QUILL_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
export const VELVET_DISSOLVE_EASE = "power2.inOut";
export const STAGE_TRANSITION_EASE = "power3.out";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The landing renders on the base tokens now. The pixel skin this used to
 *  switch on (html[data-landing-pixel]) was a whole-palette override; spec 3.3
 *  retires it and Task 4.1 rebuilds the page. Kept as a one-way clear so a
 *  stale attribute from a previous session cannot linger. */
export function clearLandingChrome(): void {
  delete document.documentElement.dataset.landingPixel;
  delete document.documentElement.dataset.lamp;
}
