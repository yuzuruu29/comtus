import { useMediaQuery } from "./useMediaQuery";

export type Breakpoint = "sm" | "md" | "lg" | "xl";

const ORDER: readonly Breakpoint[] = ["sm", "md", "lg", "xl"];

/** Reactive sm/md/lg/xl ladder: <640 | <900 | <1200 | >=1200. Re-renders on
    resize via three matchMedia listeners (useMediaQuery), no reload needed. */
export function useBreakpoint(): Breakpoint {
  const isMd = useMediaQuery("(min-width: 640px)");
  const isLg = useMediaQuery("(min-width: 900px)");
  const isXl = useMediaQuery("(min-width: 1200px)");
  if (isXl) return "xl";
  if (isLg) return "lg";
  if (isMd) return "md";
  return "sm";
}

export function bpAtLeast(bp: Breakpoint, min: Breakpoint): boolean {
  return ORDER.indexOf(bp) >= ORDER.indexOf(min);
}
