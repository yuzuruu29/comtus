import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { COMPAD_CUE, DESK_ACTIVITY, type CompadCue } from "../../lib/activity";
import {
  evolveRecord,
  gatherDeskSnapshot,
  loadMilestoneRecord,
  saveMilestoneRecord,
  tickActivity,
  type MilestoneDef,
  type MilestoneRecord,
} from "../../lib/milestones";
import { loadPomodoro } from "../../lib/pomodoro";
import { useSettings } from "../../lib/settings";
import { Toast } from "../Toast";
import { InkMark } from "../../ui/InkMark";
import MilestonesPanel from "./MilestonesPanel";
import BatteryCopilotMenu, { copilotStatus } from "./BatteryCopilotMenu";
import { PixelBatteryCompanion, type BatteryAnimationMood } from "../../components/pixel/PixelBatteryCompanion";
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

const SPEECH_MS = 3400;

/** How Compad answers each study moment. Lines are calm and second person,
 *  and a miss is met kindly: it is where the learning happens. */
const CUE_REACTIONS: Record<
  CompadCue,
  { mood: BatteryAnimationMood | null; ms: number; rest?: "read" | "idle"; lines?: readonly string[] }
> = {
  correct: { mood: "cheer", ms: 1400, lines: ["That's it.", "Right, and you know why.", "Well read."] },
  miss: { mood: "nod", ms: 1800, lines: ["Close. The why is worth a read.", "A miss is where it sticks.", "Look again at the source."] },
  recalled: { mood: "cheer", ms: 900 },
  relearn: { mood: "nod", ms: 1500 },
  flip: { mood: "think", ms: 700 },
  passed: { mood: "celebrate", ms: 2600, lines: ["A strong pass. The lamp stays lit."] },
  finished: { mood: "cheer", ms: 1800, lines: ["Done. Your misses are the next round.", "Finished. Every answer counted."] },
  "deck-done": { mood: "celebrate", ms: 2200, lines: ["That's the deck for today."] },
  focus: { mood: null, ms: 0, rest: "read", lines: ["I'll keep the time.", "Heads down. I'll watch the clock."] },
  pause: { mood: null, ms: 0, rest: "idle" },
  break: { mood: "cheer", ms: 1600, rest: "idle", lines: ["Break. Stand up, look far away.", "Rest your eyes. Water helps."] },
  "long-break": { mood: "celebrate", ms: 2600, rest: "idle", lines: ["Four sessions kept. Rest a while."] },
};

function focusRunning(): boolean {
  const s = loadPomodoro();
  return s.phase === "focus" && s.endsAt !== null;
}

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
  const [record, setRecord] = useState<MilestoneRecord>(() => loadMilestoneRecord());
  // A passing reaction over Compad's own life; null hands the face back.
  const [mood, setMood] = useState<BatteryAnimationMood | null>(null);
  const [rest, setRest] = useState<"read" | "idle">(() => (focusRunning() ? "read" : "idle"));
  const [speech, setSpeech] = useState<string | null>(null);
  const [toast, setToast] = useState<MilestoneDef | null>(null);
  const [batteryThink, setBatteryThink] = useState(false);
  const [watching, setWatching] = useState(false);
  const [batteryFace, setBatteryFace] = useState<"left" | "right" | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const moodTimer = useRef<number | undefined>(undefined);
  const speechTimer = useRef<number | undefined>(undefined);
  const lineTurn = useRef(0);
  const wasThinking = useRef(false);
  const recordRef = useRef(record);
  recordRef.current = record;

  const holdMood = useCallback((next: BatteryAnimationMood, ms: number) => {
    window.clearTimeout(moodTimer.current);
    setMood(next);
    if (next !== "sleep") moodTimer.current = window.setTimeout(() => setMood(null), ms);
  }, []);

  const say = useCallback((line: string) => {
    window.clearTimeout(speechTimer.current);
    setSpeech(line);
    speechTimer.current = window.setTimeout(() => setSpeech(null), SPEECH_MS);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(moodTimer.current);
    window.clearTimeout(speechTimer.current);
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
    const onCue = (event: Event) => {
      const reaction = CUE_REACTIONS[(event as CustomEvent<CompadCue>).detail];
      if (!reaction) return;
      if (reaction.rest) setRest(reaction.rest);
      if (reaction.mood) holdMood(reaction.mood, reaction.ms);
      if (reaction.lines) say(reaction.lines[lineTurn.current++ % reaction.lines.length]);
    };
    window.addEventListener(COMPAD_CUE, onCue);
    return () => window.removeEventListener(COMPAD_CUE, onCue);
  }, [holdMood, say]);

  useEffect(() => {
    const onUnlock = () => unlockSfx();
    window.addEventListener("pointerdown", onUnlock, { once: true });
    window.addEventListener("keydown", onUnlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onUnlock);
      window.removeEventListener("keydown", onUnlock);
    };
  }, []);

  useIdleWatch({
    // Reading through a focus session is not idleness.
    enabled: rest !== "read",
    idleMs:
      import.meta.env.DEV &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("idle") === "1"
        ? 8_000
        : DEFAULT_IDLE_MS,
    onIdle: () => {
      holdMood("sleep", 0);
      playSfx("nudge", sfxOn);
    },
    onActive: (wasIdle) => {
      if (!wasIdle) return;
      holdMood("cheer", 1400);
    },
  });

  // Battery "think": hold while an existing streaming/busy marker is in the DOM.
  // Watching: a quiz or deck opens in a modal; when it leaves Compad's corner
  // clear, Compad looks on from above the dim so a checked answer still gets a
  // face. A phone's bottom sheet covers the corner, so there it stays below.
  useEffect(() => {
    if (!companion) return;
    if (typeof MutationObserver === "undefined") return;
    const update = () => {
      setBatteryThink(Boolean(document.querySelector(".stream-typing-beacon, [data-lamp-think], [data-battery-think]")));
      // Layout is read only while a dialog is open, never per streamed token.
      const dialogEl = document.querySelector('[aria-modal="true"]');
      const padEl = dialogEl && document.querySelector(".cozy-pixel-battery-companion");
      if (!dialogEl || !padEl) return setWatching(false);
      const dialog = dialogEl.getBoundingClientRect();
      const pad = padEl.getBoundingClientRect();
      setWatching(pad.left >= dialog.right || pad.right <= dialog.left || pad.top >= dialog.bottom || pad.bottom <= dialog.top);
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

  // An answer finished writing: a small brighten, once.
  useEffect(() => {
    if (wasThinking.current && !batteryThink) holdMood("cheer", 1000);
    wasThinking.current = batteryThink;
  }, [batteryThink, holdMood]);

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

  // Resting offset. On mobile the pane tabs own the bottom of the screen, so
  // the companion clears them instead of sitting on the tab bar.
  const [restingOffset, setRestingOffset] = useState({ right: 20, bottom: 20 });
  useEffect(() => {
    if (!companion) return;
    const measure = () => {
      const nav = document.querySelector<HTMLElement>("#mobile-bottom-nav");
      const navHeight = nav && nav.offsetHeight > 0 ? nav.offsetHeight : 0;
      setRestingOffset({ right: 20, bottom: navHeight > 0 ? navHeight + 14 : 20 });
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, [companion]);

  return (
    <div className="desk-life" data-watching={watching || undefined}>
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
          mood={mood ?? undefined}
          restMood={rest === "read" ? "read" : undefined}
          speech={copilotOpen ? null : speech}
          showControls={false}
          freePlacement
          resizable
          think={batteryThink}
          face={batteryFace}
          // Keep-outs are content, not panes: the chat's reading column leaves a
          // gutter beside the studio pane where Compad can rest over nothing.
          avoidSelector=".composer-shell, #mobile-bottom-nav, #workspace-sources-pane, .chat-reading-column > *, [role='separator'], #workspace-studio-pane section, .exam-plan, .workspace-header"
          restingOffset={restingOffset}
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
      {/* Clear of the sources footer on a desk and of the pane tabs on a phone. */}
      <div className="pointer-events-auto fixed top-[calc(3.75rem+var(--sat))] left-4 z-[57] lg:top-auto lg:bottom-[4.5rem]">
        <Toast
          open={Boolean(toast)}
          onClose={() => setToast(null)}
          durationMs={5200}
          className="milestone-toast glass"
        >
          <span className="milestone-seal" data-accent={toast?.accent} aria-hidden>
            <InkMark kind="check" />
          </span>
          <div role="status">
            <p className="milestone-toast-kicker">Milestone held</p>
            <p className="milestone-toast-title">{toast?.title}</p>
            <p className="milestone-toast-line">{toast?.line}</p>
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
