import { track } from "@vercel/analytics";
import { isTauri } from "./desktop";

/** Funnel events for the hosted-pass flow. Web only — the desktop shell has
 *  no analytics endpoint, and a beacon there would be lost traffic. Never
 *  throws: measurement must not be able to break a purchase. */
export function trackEvent(
  name: string,
  data?: Record<string, string | number | boolean>,
): void {
  if (isTauri()) return;
  try {
    track(name, data);
  } catch {
    /* the app works without analytics */
  }
}
