import { useEffect } from "react";
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
  meta?.setAttribute("content", resolved === "light" ? "#F5F1E8" : "#0B0F1A");
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

/** Typography preset ownership lives on html[data-font-preset]; CSS maps each
 *  preset to its display/body/mono tokens. Undefined clears back to the
 *  Instrument defaults declared in index.css. */
export function applyFontPreset(id: string | undefined): void {
  if (id) document.documentElement.dataset.fontPreset = id;
  else delete document.documentElement.dataset.fontPreset;
}

/** Curated font systems (see fontPresets.ts). Studio-only; the landing owns its own type. */
export function useFontPresetEffect() {
  const fontPreset = useSettings((s) => s.fontPreset ?? "instrument");
  useEffect(() => {
    applyFontPreset(fontPreset);
    return () => applyFontPreset(undefined);
  }, [fontPreset]);
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
