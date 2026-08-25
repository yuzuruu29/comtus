import { useCallback, useEffect, useRef, useState } from "react";

/** Chars/second floor so slow token trickles still read as live typing. */
const MIN_CPS = 26;
/**
 * Fraction of the remaining backlog revealed per frame. 0.09 drains ~90% of
 * any backlog within ~35 frames (~0.6s), so a burst from a fast model never
 * lags visibly behind while still animating.
 */
const CATCH_UP = 0.09;

export interface SmoothText {
  /** The text to render — trails `target` while typing. */
  text: string;
  /** True once `text` has caught up with `target` (or smoothing is off). */
  caughtUp: boolean;
  /** Jump straight to `target` (e.g. Stop pressed mid-drain). */
  flush: () => void;
}

/**
 * Reveals `target` progressively while `enabled`, like a typewriter, so fast
 * model streams render at a readable pace instead of dumping all at once.
 *
 * Speed adapts to the backlog: it types at least MIN_CPS chars/second and
 * scales up with however far behind it has fallen. Pass enabled=false to
 * snap to `target` unchanged (also resets between sends).
 */
export function useSmoothText(target: string, enabled: boolean): SmoothText {
  const [text, setText] = useState(() => (enabled ? "" : target));
  const [caughtUp, setCaughtUp] = useState(!enabled);
  const shownRef = useRef(enabled ? "" : target);
  const targetRef = useRef(target);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const tick = useCallback((now: number) => {
    const full = targetRef.current;
    let len = shownRef.current.length;
    if (len >= full.length) {
      rafRef.current = 0;
      return;
    }
    const dt = lastRef.current ? Math.min((now - lastRef.current) / 1000, 0.12) : 1 / 60;
    lastRef.current = now;
    const backlog = full.length - len;
    let step = Math.max(Math.round(MIN_CPS * dt), Math.ceil(backlog * CATCH_UP));
    if (len + step < full.length) {
      // Don't split a surrogate pair (emoji etc.) across frames.
      const tail = full.charCodeAt(len + step - 1);
      if (tail >= 0xd800 && tail <= 0xdbff) step += 1;
    } else {
      step = backlog;
    }
    len += step;
    const shown = full.slice(0, len);
    shownRef.current = shown;
    setText(shown);
    if (len >= full.length) {
      rafRef.current = 0;
      setCaughtUp(true);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    targetRef.current = target;
    if (!enabled) {
      stop();
      if (shownRef.current !== target) {
        shownRef.current = target;
        setText(target);
      }
      setCaughtUp(true);
      return;
    }
    // A shorter target means a fresh stream — restart the reveal.
    if (target.length < shownRef.current.length) {
      shownRef.current = "";
      setText("");
    }
    setCaughtUp(shownRef.current.length >= target.length);
    if (!rafRef.current && shownRef.current.length < target.length) {
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
    return stop;
  }, [target, enabled, stop, tick]);

  const flush = useCallback(() => {
    stop();
    shownRef.current = targetRef.current;
    setText(targetRef.current);
    setCaughtUp(true);
  }, [stop]);

  return { text, caughtUp, flush };
}
