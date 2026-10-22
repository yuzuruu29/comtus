import { useEffect } from "react";
import Lenis from "lenis";

type LenisWindow = Window & { __lenis?: Lenis };

/** Weighted wheel scrolling for the public pages, at the Full motion budget only.
 *
 *  Lenis eases the real document scroll position, so the native scroll
 *  timelines in landing-motion.css keep scrubbing against it. Touch keeps the
 *  platform's own momentum (syncTouch is off), keyboard and anchor jumps stay
 *  native, and nested scrollers (a dialog, the sample page) scroll themselves.
 *  scrollToSection in lib/scroll.ts finds the instance on window.__lenis. */
export function useSmoothScroll(enabled: boolean) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    // A wheel is what this smooths. Touch screens already glide on their own.
    if (!enabled || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.11,
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
    });
    const host = window as LenisWindow;
    host.__lenis = lenis;
    return () => {
      lenis.destroy();
      if (host.__lenis === lenis) delete host.__lenis;
    };
  }, [enabled]);
}
