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

/** Studio-only pixel chrome. Landing uses html[data-landing-pixel] instead. DeskShell clears this on leave. */
export function applyPixelDesk(on: boolean): void {
  if (on) document.documentElement.dataset.pixel = "on";
  else delete document.documentElement.dataset.pixel;
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

/** Pixelify on all desk text + arcade press while the desk is mounted. */
export function usePixelDeskEffect() {
  const pixelDesk = useSettings((s) => s.pixelDesk !== false);
  useEffect(() => {
    applyPixelDesk(pixelDesk);
    return () => applyPixelDesk(false);
  }, [pixelDesk]);
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
