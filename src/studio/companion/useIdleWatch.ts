import { useEffect, useRef } from "react";

/** Default: four quiet minutes at an open desk. */
export const DEFAULT_IDLE_MS = 4 * 60 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Fires `onIdle` once the desk has been visible and untouched for `idleMs`.
 * Pointer-move is sampled so a resting cursor does not keep the lamp awake,
 * but a real gesture resets the watch. Hidden tabs freeze the timer.
 */
export function useIdleWatch({
  enabled,
  idleMs = DEFAULT_IDLE_MS,
  onIdle,
  onActive,
}: {
  enabled: boolean;
  idleMs?: number;
  onIdle: () => void;
  onActive: (wasIdle: boolean) => void;
}): void {
  const idleRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  const onActiveRef = useRef(onActive);
  onIdleRef.current = onIdle;
  onActiveRef.current = onActive;

  useEffect(() => {
    if (!enabled) {
      idleRef.current = false;
      return;
    }

    let timer: number | undefined;
    const arm = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        idleRef.current = true;
        onIdleRef.current();
      }, idleMs);
    };

    const bump = () => {
      const wasIdle = idleRef.current;
      idleRef.current = false;
      if (wasIdle) onActiveRef.current(true);
      arm();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") arm();
      else if (timer !== undefined) window.clearTimeout(timer);
    };

    arm();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, bump, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, bump);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, idleMs]);
}
