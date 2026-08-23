/* Desktop-app context: are we running as an installed app (PWA standalone
   or Tauri shell), and on which platform? Landing + studio chrome adapt
   to this — installed windows get the native-feel treatment. */

export type Platform = "mac" | "windows" | "linux" | "other";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = globalThis as unknown as Record<string, unknown>;
  return Boolean(w.isTauri || w.__TAURI__ || w.__TAURI_INTERNALS__);
}

/** The native desk surface, plus an opt-in browser preview used for
 * desktop QA without weakening the checks around native-only APIs. */
export function isDeskShell(): boolean {
  return isTauri() || import.meta.env.VITE_DESKTOP_SHELL === "1";
}

/** True when the user installed Comtus (PWA or native desktop build). */
export function isDesktopApp(): boolean {
  return isStandalone() || isTauri();
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "other";
}

/** Warm, quiet greeting for the desk home. */
export function greeting(): { hello: string; phase: string } {
  const h = new Date().getHours();
  if (h < 5) return { hello: "Burning the midnight oil", phase: "night" };
  if (h < 12) return { hello: "Good morning", phase: "morning" };
  if (h < 18) return { hello: "Good afternoon", phase: "afternoon" };
  return { hello: "Good evening", phase: "evening" };
}

export function todayLine(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
