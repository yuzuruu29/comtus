import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { DESK_ACTIVITY } from "../../lib/activity";
import {
  evolveRecord,
  gatherDeskSnapshot,
  loadMilestoneRecord,
  saveMilestoneRecord,
  tickActivity,
  type MilestoneDef,
  type MilestoneRecord,
} from "../../lib/milestones";
import { useSettings } from "../../lib/settings";
import { Toast } from "../Toast";
import MilestonesPanel from "./MilestonesPanel";
import BatteryCopilotMenu, { copilotStatus } from "./BatteryCopilotMenu";
import { PixelBatteryCompanion } from "../../components/pixel/PixelBatteryCompanion";
import { playSfx, unlockSfx } from "./sfx";
import { DEFAULT_IDLE_MS, useIdleWatch } from "./useIdleWatch";
import { studioNotebookIdFromPath } from "../studioPath";
import "./companion.css";

const MOTE_LAYOUT = [
  { x: "12%", y: "78%", d: "0s", dur: "18s" },
  { x: "28%", y: "86%", d: "3s", dur: "22s" },
  { x: "61%", y: "72%", d: "7s", dur: "16s" },
  { x: "74%", y: "88%", d: "1.5s", dur: "20s" },
  { x: "88%", y: "80%", d: "5s", dur: "24s" },
] as const;

export type DeskMood = "idle" | "sleepy" | "celebrate" | "cheer" | "poke";

export default function DeskLife({
  panelOpen,
  onPanelOpenChange,
  onCount,
}: {
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onCount: (count: number) => void;
}) {
  const { pathname } = useLocation();
  const companion = useSettings((s) => s.companion !== false) && Boolean(studioNotebookIdFromPath(pathname));
  const sfxOn = useSettings((s) => s.companionSfx !== false);
  const [ignite, setIgnite] = useState(false);
  const [record, setRecord] = useState<MilestoneRecord>(() => loadMilestoneRecord());
  const [mood, setMood] = useState<DeskMood>("idle");
  const [toast, setToast] = useState<MilestoneDef | null>(null);
  const [batteryThink, setBatteryThink] = useState(false);
  const [batteryFace, setBatteryFace] = useState<"left" | "right" | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const moodTimer = useRef<number | undefined>(undefined);
  const recordRef = useRef(record);
  recordRef.current = record;

  const holdMood = useCallback((next: DeskMood, ms: number) => {
    if (moodTimer.current !== undefined) window.clearTimeout(moodTimer.current);
    setMood(next);
    if (next === "sleepy") return;
    moodTimer.current = window.setTimeout(() => setMood("idle"), ms);
  }, []);

  const refresh = useCallback(async () => {
    const ticked = tickActivity(recordRef.current, new Date());
    let snapshot;
    try {
      snapshot = await gatherDeskSnapshot(ticked);
    } catch {
      setRecord(ticked);
      saveMilestoneRecord(ticked);
      onCount(Object.keys(ticked.unlockedAt).length);
      return;
    }
    const { record: next, unlocked } = evolveRecord(ticked, snapshot, Date.now());
    setRecord(next);
    saveMilestoneRecord(next);
    onCount(Object.keys(next.unlockedAt).length);
    if (unlocked[0]) {
      const latest = unlocked[unlocked.length - 1];
      setToast(latest);
      holdMood("celebrate", 2200);
      playSfx("unlock", sfxOn);
    }
  }, [holdMood, onCount, sfxOn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onTick = () => void refresh();
    window.addEventListener(DESK_ACTIVITY, onTick);
    return () => window.removeEventListener(DESK_ACTIVITY, onTick);
  }, [refresh]);

  useEffect(() => {
    const onUnlock = () => unlockSfx();
    window.addEventListener("pointerdown", onUnlock, { once: true });
    window.addEventListener("keydown", onUnlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onUnlock);
      window.removeEventListener("keydown", onUnlock);
    };
  }, []);

  useEffect(() => {
    const onIgnite = () => {
      setIgnite(true);
      window.setTimeout(() => setIgnite(false), 900);
    };
    window.addEventListener("comtus:ignite", onIgnite);
    return () => window.removeEventListener("comtus:ignite", onIgnite);
  }, []);

  useIdleWatch({
    enabled: true,
    idleMs:
      import.meta.env.DEV &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("idle") === "1"
        ? 8_000
        : DEFAULT_IDLE_MS,
    onIdle: () => {
      setMood("sleepy");
      playSfx("nudge", sfxOn);
    },
    onActive: (wasIdle) => {
      if (!wasIdle) return;
      holdMood("cheer", 1400);
    },
  });

  // Battery "think": hold while an existing streaming/busy marker is in the DOM
  useEffect(() => {
    if (!companion) return;
    if (typeof MutationObserver === "undefined") return;
    const update = () => {
      setBatteryThink(Boolean(document.querySelector(".stream-typing-beacon, [data-lamp-think], [data-battery-think]")));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [companion]);

  // Battery glance: face the side of the desk the user last touched
  useEffect(() => {
    if (!companion) return;
    const onDown = (e: PointerEvent) => {
      const el = document.querySelector<HTMLElement>(".cozy-pixel-battery-companion");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      if (Math.abs(e.clientX - cx) < 80) {
        setBatteryFace(null);
        return;
      }
      setBatteryFace(e.clientX < cx ? "left" : "right");
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, [companion]);

  return (
    <div className="desk-life">
      {ignite && <div className="desk-ignite" aria-hidden />}
      {mood === "celebrate" && <div className="desk-celebrate-flash" aria-hidden />}
      <div className="studio-motes" aria-hidden>
        {MOTE_LAYOUT.map((mote, i) => (
          <span
            key={i}
            style={
              {
                ["--x"]: mote.x,
                ["--y"]: mote.y,
                ["--d"]: mote.d,
                ["--dur"]: mote.dur,
              } as CSSProperties
            }
          />
        ))}
      </div>
      {companion && (
        <PixelBatteryCompanion
          mood={mood === "celebrate" ? "celebrate" : mood === "sleepy" ? "sleep" : mood === "cheer" ? "cheer" : undefined}
          showControls={false}
          freePlacement
          resizable
          think={batteryThink}
          face={batteryFace}
          avoidSelector="#study-focus-dock, .composer-shell, #mobile-bottom-nav, #workspace-sources-pane, #workspace-studio-pane, .workspace-header"
          onMenu={() => setCopilotOpen((v) => !v)}
          menuOpen={copilotOpen}
          menu={(controls) => (
            <BatteryCopilotMenu
              controls={controls}
              onClose={() => setCopilotOpen(false)}
              status={copilotStatus({
                think: batteryThink,
                milestones: Object.keys(record.unlockedAt).length,
              })}
            />
          )}
        />
      )}
      <div className="pointer-events-auto fixed bottom-[calc(5.5rem+var(--sab))] left-4 z-[57] lg:bottom-6">
        <Toast
          open={Boolean(toast)}
          onClose={() => setToast(null)}
          durationMs={5200}
          className="relative overflow-hidden"
        >
          <div className="pr-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-brasspale">
              Milestone
            </div>
            <div className="mt-0.5 font-display text-[15px] font-[450] text-ink">
              {toast?.title}
            </div>
            <p className="mt-0.5 text-[12px] text-muted">{toast?.line}</p>
          </div>
        </Toast>
      </div>
      <MilestonesPanel
        open={panelOpen}
        onClose={() => onPanelOpenChange(false)}
        record={record}
      />
    </div>
  );
}
