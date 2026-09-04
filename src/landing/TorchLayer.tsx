import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";

import { torchManager } from "../lib/torchState";
import { Pulse } from "@phosphor-icons/react";

const STORE_KEY = "comtus-torch";
const HINT_KEY = "comtus-torch-hint";
const LIGHT_RADIUS = 400;
const REKINDLE_PROXIMITY = 90;

/**
 * Precision Raycast Layer — an interactive cognitive focus beam that follows
 * the pointer. Provides subtle ambient illumination across sections.
 */

function torchEligible(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function storedMode(): boolean {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export default function TorchLayer({ ready }: { ready: boolean }) {
  const [eligible] = useState(torchEligible);
  const [on, setOn] = useState(storedMode);
  const [hint, setHint] = useState(false);
  const [showOffHint, setShowOffHint] = useState(false);
  const washRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: -1000, y: -1000 });
  const sectionsRef = useRef<HTMLElement[]>([]);
  const sconcesRef = useRef<HTMLElement[]>([]);
  const litRef = useRef(new Map<HTMLElement, number>());
  const onRef = useRef(on);
  const prevOnRef = useRef(on);
  onRef.current = on;

  const setMode = useCallback((next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(STORE_KEY, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, []);

  const toggle = useCallback(() => setMode(!onRef.current), [setMode]);

  // Keyboard shortcut — T
  useEffect(() => {
    if (!eligible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "t" && e.key !== "T") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eligible, toggle]);

  useEffect(() => {
    if (!eligible || !ready) return;
    const wash = washRef.current;
    const core = coreRef.current;
    if (!wash || !core) return;

    if (on) document.body.classList.add("torch-on");
    const sections = [...document.querySelectorAll<HTMLElement>("[data-torch]")];
    sectionsRef.current = sections;
    sconcesRef.current = [...document.querySelectorAll<HTMLElement>("[data-torch-sconce]")];

    gsap.set([wash, core], { x: -1000, y: -1000 });
    const washX = gsap.quickTo(wash, "x", { duration: 0.55, ease: "power2.out" });
    const washY = gsap.quickTo(wash, "y", { duration: 0.55, ease: "power2.out" });
    const coreX = gsap.quickTo(core, "x", { duration: 0.22, ease: "power2.out" });
    const coreY = gsap.quickTo(core, "y", { duration: 0.22, ease: "power2.out" });

    const move = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
      washX(e.clientX);
      washY(e.clientY);
      coreX(e.clientX);
      coreY(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });

    const tick = () => {
      if (!onRef.current) return;
      const { x, y } = pointerRef.current;
      if (x < -500) return;

      const sconces = sconcesRef.current;
      sconces.forEach((sc) => {
        const id = sc.getAttribute("data-torch-sconce");
        if (id && !torchManager.isLit(id)) {
          const r = sc.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dist = Math.hypot(cx - x, cy - y);
          if (dist < REKINDLE_PROXIMITY) {
            torchManager.ignite(id);
          }
        }
      });

      const sections = sectionsRef.current;
      sections.forEach((sec) => {
        const r = sec.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const cx = Math.max(r.left, Math.min(x, r.right));
        const cy = Math.max(r.top, Math.min(y, r.bottom));
        const dist = Math.hypot(cx - x, cy - y);
        const litVal = Math.max(0, Math.min(1, 1 - dist / LIGHT_RADIUS));
        const prev = litRef.current.get(sec) ?? 0;
        if (Math.abs(prev - litVal) > 0.02) {
          litRef.current.set(sec, litVal);
          sec.style.setProperty("--lit", litVal.toFixed(2));
        }
      });
    };

    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener("pointermove", move);
      gsap.ticker.remove(tick);
      document.body.classList.remove("torch-on");
    };
  }, [eligible, ready, on]);

  useEffect(() => {
    if (!eligible || !ready) return;
    try {
      if (sessionStorage.getItem(HINT_KEY)) return;
      sessionStorage.setItem(HINT_KEY, "1");
    } catch {
      /* private */
    }
    setHint(true);
    const id = window.setTimeout(() => setHint(false), 7000);
    return () => window.clearTimeout(id);
  }, [eligible, ready, on]);

  useEffect(() => {
    if (!eligible || !ready) return;
    if (prevOnRef.current && !on) {
      setShowOffHint(true);
      const id = window.setTimeout(() => setShowOffHint(false), 4200);
      return () => window.clearTimeout(id);
    }
    prevOnRef.current = on;
  }, [eligible, ready, on]);

  if (!eligible) return null;

  return (
    <>
      {on && (
        <>
          <div ref={washRef} className="torch-halo" aria-hidden />
          <div ref={coreRef} className="torch-halo-core" aria-hidden />
        </>
      )}

      <div className="torch-pill flex items-center gap-2">
        <button
          onClick={toggle}
          aria-pressed={on}
          title={
            on
              ? "Precision Beam focus active. Press T for static view."
              : "Precision Beam off — press T or click to activate."
          }
          className="flex items-center gap-1.5 text-inherit transition-colors cursor-pointer"
        >
          <Pulse size={13} className={on ? "text-brass animate-pulse" : "text-muted"} />
          <span className="torch-pill-label">
            <span className="torch-pill-mode">
              {on ? "BEAM: ON" : "STATIC"}
            </span>
          </span>
        </button>
      </div>

      <div className="torch-hint-zone" aria-live="polite">
        {hint && (
          <div className="torch-hint">
            <p className="torch-hint-title">
              <Pulse size={11} className="text-brass inline-block mr-1.5 -mt-px" />
              Precision Beam Focus
            </p>
            <p className="torch-hint-body">
              Sections dynamically track your cursor raycast for active reading focus.
            </p>
            <p className="torch-hint-keys">
              <span className="font-mono torch-hint-key">T</span> toggle raycast
            </p>
          </div>
        )}
        {showOffHint && (
          <div className="torch-hint torch-hint-off">
            <p className="torch-hint-body">
              Raycast focus off — sections are statically rendered.
            </p>
            <p className="torch-hint-keys">
              Press <span className="font-mono torch-hint-key">T</span> to re-enable
            </p>
          </div>
        )}
      </div>
    </>
  );
}
