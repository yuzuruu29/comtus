import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSettings } from "./settings";

export type ThemePref = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

export function resolveAppTheme(
  pref: ThemePref,
  opts: { landing: boolean; prefersLight: boolean },
): ResolvedTheme {
  if (opts.landing) return "dark";
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

/** Pixelify on all desk text + arcade press while the desk is mounted. */
export function usePixelDeskEffect() {
  const pixelDesk = useSettings((s) => s.pixelDesk !== false);
  useEffect(() => {
    applyPixelDesk(pixelDesk);
    return () => applyPixelDesk(false);
  }, [pixelDesk]);
}

/** Sets html[data-theme] for app surfaces. The landing route is always dark. */
export function useThemeEffect() {
  const theme = useSettings((s) => s.theme);
  const location = useLocation();
  const landing = location.pathname === "/";

  useEffect(() => {
    const apply = () => {
      const prefersLight =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: light)").matches;
      applyResolvedTheme(resolveAppTheme(theme, { landing, prefersLight }));
    };
    apply();
    if (theme !== "system" || landing) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, landing]);
}
