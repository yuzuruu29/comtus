import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Flame } from "lucide-react";
import { torchManager } from "../lib/torchState";

const STORE_KEY = "comtus-torch";
const HINT_KEY = "comtus-torch-hint";
const LIGHT_RADIUS = 400;
const REKINDLE_PROXIMITY = 90;

/**
 * Torch layer — the page reads under a warm halo that follows the cursor.
 * Sections lift from dim to lit as the light reaches them; sconces stay lit
 * once rekindled. A reading light, not a weapon: nothing burns.
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
  const [counts, setCounts] = useState(() => torchManager.getCounts());
  const washRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: -1000, y: -1000 });
  const sectionsRef = useRef<HTMLElement[]>([]);
  const sconcesRef = useRef<HTMLElement[]>([]);
  const litRef = useRef(new Map<HTMLElement, number>());
  const onRef = useRef(on);
  const prevOnRef = useRef(on);
  onRef.current = on;

  useEffect(() => {
    return torchManager.subscribe(() => {
      setCounts(torchManager.getCounts());
    });
  }, []);

  const setMode = useCallback((next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(STORE_KEY, next ? "1" : "0");
    } catch {
      /* private mode — the toggle still works this session */
    }
  }, []);

  const toggle = useCallback(() => setMode(!onRef.current), [setMode]);

  // Keyboard shortcut — T, outside of any field.
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

  // The lighting engine — halo lag, per-section veil lift, and sconce ignition.
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

      // Check sconce proximity for rekindling
      const sconces = sconcesRef.current;
      sconces.forEach((sc) => {
        const id = sc.getAttribute("data-torch-sconce");
        if (id && !torchManager.isLit(id)) {
          const r = sc.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dist = Math.hypot(cx - x, cy - y);
          if (dist <= REKINDLE_PROXIMITY) {
            torchManager.ignite(id);
          }
        }
      });

      const sections = sectionsRef.current;
      const targets = sections.map((el) => {
        // If the section's sconce is already lit, maintain illumination
        const sconce = el.querySelector<HTMLElement>("[data-torch-sconce]");
        const sconceId = sconce?.getAttribute("data-torch-sconce");
        if (sconceId && torchManager.isLit(sconceId)) {
          return 1.0;
        }

        const r = el.getBoundingClientRect();
        const dx = Math.max(r.left - x, 0, x - r.right);
        const dy = Math.max(r.top - y, 0, y - r.bottom);
        const d = Math.hypot(dx, dy);
        return Math.max(0, Math.min(1, 1 - d / LIGHT_RADIUS));
      });

      sections.forEach((el, i) => {
        const prev = litRef.current.get(el) ?? 1;
        const next = prev + (targets[i] - prev) * 0.14;
        litRef.current.set(el, next);
        el.style.setProperty("--lit", next.toFixed(3));
      });
    };
    gsap.ticker.add(tick);

    const litMap = litRef.current;
    return () => {
      window.removeEventListener("pointermove", move);
      gsap.ticker.remove(tick);
      document.body.classList.remove("torch-on");
      sections.forEach((el) => el.style.removeProperty("--lit"));
      litMap.clear();
    };
  }, [eligible, ready, on]);

  // One-time whisper, after the preloader hands over the page.
  useEffect(() => {
    if (!eligible || !ready || !on) return;
    let seen = false;
    try {
      seen = localStorage.getItem(HINT_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    setHint(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* shown again next visit — harmless */
    }
    const id = window.setTimeout(() => setHint(false), 7000);
    return () => window.clearTimeout(id);
  }, [eligible, ready, on]);

  // Brief "off" notice when the user toggles torch off.
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

  const allLit = counts.lit > 0 && counts.lit >= counts.total;

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
              ? `Reading light on (${counts.lit}/${counts.total} lamps rekindled). Press T for the static view.`
              : "Reading light off — press T or click to light the page."
          }
          className="flex items-center gap-1.5 text-inherit transition-colors hover:text-parchment"
        >
          <Flame size={13} className={on ? "text-brass" : "text-faded"} strokeWidth={1.8} />
          <span className="torch-pill-label">
            <span className="torch-pill-mode">
              {on ? (allLit ? "All Lit" : `${counts.lit}/${counts.total}`) : "Static"}
            </span>
          </span>
        </button>
      </div>

      <div className="torch-hint-zone" aria-live="polite">
        {hint && (
          <div className="torch-hint">
            <p className="torch-hint-title">
              <Flame size={11} className="text-brass inline-block mr-1.5 -mt-px" strokeWidth={2} />
              Reading Light
            </p>
            <p className="torch-hint-body">
              The page reads under a warm halo — sections brighten as your light reaches them.
              Little sconces stay lit once you have passed them.
            </p>
            <p className="torch-hint-keys">
              <span className="font-mono torch-hint-key">T</span> toggle light
            </p>
          </div>
        )}
        {showOffHint && (
          <div className="torch-hint torch-hint-off">
            <p className="torch-hint-body">
              Interactive mode off — sections are fully visible.
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
