import { useRef } from "react";
import { Lamp } from "@phosphor-icons/react";
import { applyResolvedTheme, type ResolvedTheme } from "../lib/theme";
import { useSettings } from "../lib/settings";
import { ICON } from "./iconScale";

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/** Where the light starts and how far it has to travel to cover the page. */
export function lampReach(rect: Pick<DOMRect, "left" | "top" | "width" | "height">, width: number, height: number) {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  return { x, y, r: Math.ceil(Math.hypot(Math.max(x, width - x), Math.max(y, height - y))) };
}

/** The desk lamp: Daylight with it off, Lamplight with it on.
 *
 *  Light is what moves. Going to Daylight, the new page spreads out of the
 *  lamp; going to Lamplight, the old page gathers back into it (BRAND.md 5).
 *  Minimal cross-fades, None and browsers without view transitions switch in
 *  one frame. */
export function LampSwitch({ className = "" }: { className?: string }) {
  const theme = useSettings((s) => s.theme ?? "light");
  const update = useSettings((s) => s.update);
  const ref = useRef<HTMLButtonElement>(null);
  const lit = theme === "dark";

  const flip = () => {
    const root = document.documentElement;
    const next: ResolvedTheme = root.dataset.theme === "dark" ? "light" : "dark";
    const apply = () => {
      applyResolvedTheme(next);
      update({ theme: next });
    };
    const start = (document as TransitionDocument).startViewTransition?.bind(document);
    if (!start || !ref.current || root.dataset.motion === "none") {
      apply();
      return;
    }
    const { x, y, r } = lampReach(ref.current.getBoundingClientRect(), window.innerWidth, window.innerHeight);
    root.style.setProperty("--lamp-x", `${x}px`);
    root.style.setProperty("--lamp-y", `${y}px`);
    root.style.setProperty("--lamp-r", `${r}px`);
    root.dataset.lamp = next === "light" ? "spread" : "gather";
    void start(apply)
      .finished.catch(() => undefined)
      .then(() => {
        delete root.dataset.lamp;
      });
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={flip}
      aria-pressed={lit}
      aria-label="Lamplight"
      title={lit ? "Switch to Daylight" : "Switch to Lamplight"}
      className={`icon-btn icon-btn-ghost icon-btn-md lamp-switch ${className}`.trim()}
    >
      <span className="lamp-switch-glow" aria-hidden="true" />
      <Lamp size={ICON.xl} weight={lit ? "fill" : "regular"} aria-hidden="true" />
    </button>
  );
}
