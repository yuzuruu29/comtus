import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
import LampMascot, { type LampMood } from "./LampMascot";
import MilestonesPanel from "./MilestonesPanel";
import { playSfx, unlockSfx } from "./sfx";
import { DEFAULT_IDLE_MS, useIdleWatch } from "./useIdleWatch";
import "./companion.css";

const MOTE_LAYOUT = [
  { x: "12%", y: "78%", d: "0s", dur: "18s" },
  { x: "28%", y: "86%", d: "3s", dur: "22s" },
  { x: "61%", y: "72%", d: "7s", dur: "16s" },
  { x: "74%", y: "88%", d: "1.5s", dur: "20s" },
  { x: "88%", y: "80%", d: "5s", dur: "24s" },
] as const;

export default function DeskLife({
  panelOpen,
  onPanelOpenChange,
  onCount,
}: {
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onCount: (count: number) => void;
}) {
  const companion = useSettings((s) => s.companion !== false);
  const sfxOn = useSettings((s) => s.companionSfx !== false);
  const pixelOn = useSettings((s) => s.pixelDesk !== false);
  const [ignite, setIgnite] = useState(false);
  const [record, setRecord] = useState<MilestoneRecord>(() => loadMilestoneRecord());
  const [mood, setMood] = useState<LampMood>("idle");
  const [speech, setSpeech] = useState<string | null>(null);
  const [toast, setToast] = useState<MilestoneDef | null>(null);
  const [lineTick, setLineTick] = useState(0);
  const moodTimer = useRef<number | undefined>(undefined);
  const recordRef = useRef(record);
  recordRef.current = record;

  const holdMood = useCallback((next: LampMood, ms: number) => {
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
      setSpeech(latest.title);
      holdMood("celebrate", 2200);
      playSfx("unlock", sfxOn);
    }
  }, [holdMood, onCount, sfxOn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pixelOn) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const key = "comtus-desk-ignite";
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    setIgnite(true);
    const id = window.setTimeout(() => setIgnite(false), 720);
    return () => window.clearTimeout(id);
  }, [pixelOn]);

  useEffect(() => {
    const onActivity = () => void refresh();
    window.addEventListener(DESK_ACTIVITY, onActivity);
    return () => window.removeEventListener(DESK_ACTIVITY, onActivity);
  }, [refresh]);

  useEffect(() => {
    const unlock = () => unlockSfx();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useIdleWatch({
    enabled: companion,
    idleMs:
      import.meta.env.DEV &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("idle") === "1"
        ? 8_000
        : DEFAULT_IDLE_MS,
    onIdle: () => {
      setMood("sleepy");
      setSpeech(null);
      setLineTick((n) => n + 1);
      playSfx("nudge", sfxOn);
    },
    onActive: (wasIdle) => {
      if (!wasIdle) return;
      holdMood("cheer", 1400);
    },
  });

  const poke = () => {
    unlockSfx();
    setLineTick((n) => n + 1);
    if (mood === "sleepy") {
      holdMood("cheer", 1400);
      playSfx("cheer", sfxOn);
      setSpeech(null);
      return;
    }
    holdMood("poke", 700);
    playSfx("cheer", sfxOn);
    setSpeech(null);
  };

  return (
    <div className="desk-life">
      {pixelOn && <div className="pixel-crt" aria-hidden />}
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
        <LampMascot
          mood={mood}
          speech={panelOpen ? null : speech}
          onPoke={poke}
          lineTick={lineTick}
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
