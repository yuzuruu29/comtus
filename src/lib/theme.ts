import { useEffect } from "react";
import { DEFAULT_LEADING, DEFAULT_READING } from "./fontPresets";
import { useSettings } from "./settings";

export type ThemePref = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

export function resolveAppTheme(
  pref: ThemePref,
  opts: { prefersLight: boolean },
): ResolvedTheme {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return opts.prefersLight ? "light" : "dark";
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", resolved === "light" ? "#F5F1E8" : "#14100C");
  const scheme = document.querySelector('meta[name="color-scheme"]');
  scheme?.setAttribute("content", resolved);
}

/** Optional pixel accent chrome — display lettering only (styles/chrome-pixel.css).
 *  It never touches the palette; colour always comes from tokens.css.
 *  DeskShell clears this on leave. */
export function applyChrome(on: boolean): void {
  if (on) document.documentElement.dataset.chrome = "pixel";
  else delete document.documentElement.dataset.chrome;
}

/** Reading size lives on html[data-reading] and line spacing on
 *  html[data-leading]; styles/font-presets.css maps them to --text-read and
 *  --leading-read. Undefined clears back to the token default. The faces
 *  themselves are fixed in tokens.css and are not a user choice (spec 5.1). */
export function applyReading(size: string | undefined, leading?: string): void {
  const root = document.documentElement.dataset;
  if (size) root.reading = size;
  else delete root.reading;
  if (leading) root.leading = leading;
  else delete root.leading;
}

/** Reading size and spacing (see fontPresets.ts). Studio-only; the landing sets its own measure. */
export function useReadingEffect() {
  const reading = useSettings((s) => s.reading ?? DEFAULT_READING);
  const leading = useSettings((s) => s.leading ?? DEFAULT_LEADING);
  useEffect(() => {
    applyReading(reading, leading);
    return () => applyReading(undefined);
  }, [reading, leading]);
}

/** Pixel accent lettering while the desk is mounted. Off unless asked for. */
export function useChromeEffect() {
  const chrome = useSettings((s) => s.pixelDesk === true);
  useEffect(() => {
    applyChrome(chrome);
    return () => applyChrome(false);
  }, [chrome]);
}

/** Sets html[data-theme] for landing and studio from the same preference. */
export function useThemeEffect() {
  const theme = useSettings((s) => s.theme ?? "light");

  useEffect(() => {
    const apply = () => {
      const prefersLight =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: light)").matches;
      applyResolvedTheme(resolveAppTheme(theme, { prefersLight }));
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}
