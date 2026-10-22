import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";

import { useDesk } from "../DeskContext";
import { ENTER, EXIT, RISE_1, SOFT } from "../fx";
import { useFocusVision } from "./useFocusVision";
import { playProceduralSfx, playSfx } from "./sfx";
import {
  clampLampPos,
  LAMP_DRAG_PX,
  loadLampPos,
  saveLampPos,
  viewportSize,
  type LampPos,
} from "./lampPos";
import "./companion.css";
import { ArrowCounterClockwise, BookOpen, Brain, Camera, CameraSlash, Command, EyeSlash, Flame, Lightning, Moon, Pause, Play, Sparkle, SpeakerHigh, SpeakerX, Sun, Timer, Trophy, X } from "@phosphor-icons/react";
import { ICON } from "../../ui/iconScale";

export type FocusBeaconColor = "brass" | "sage" | "moon" | "rust";

/** Spec 4 rule 1: brass is the only accent for action, sage/rust/moon carry
 *  state, and none of the four is a stock palette colour. Four beacons, one
 *  per accent. This replaces a seven-swatch picker built from Tailwind's
 *  amber/emerald/cyan/orange/rose/blue, three of which were unreachable. */
const BEACON_THEMES: Record<
  FocusBeaconColor,
  { label: string; ring: string; glow: string; text: string; bg: string; border: string }
> = {
  brass: {
    label: "Study",
    ring: "var(--brass)",
    glow: "color-mix(in srgb, var(--brass) 45%, transparent)",
    text: "text-brass",
    bg: "bg-brass/15",
    border: "border-brass/40",
  },
  sage: {
    label: "Lock-in",
    ring: "var(--sage)",
    glow: "color-mix(in srgb, var(--sage) 45%, transparent)",
    text: "text-sage",
    bg: "bg-sage/15",
    border: "border-sage/40",
  },
  moon: {
    label: "Review",
    ring: "var(--moon)",
    glow: "color-mix(in srgb, var(--moon) 45%, transparent)",
    text: "text-moon",
    bg: "bg-moon/15",
    border: "border-moon/40",
  },
  rust: {
    label: "Alert",
    ring: "var(--rust)",
    glow: "color-mix(in srgb, var(--rust) 45%, transparent)",
    text: "text-rust",
    bg: "bg-rust/15",
    border: "border-rust/40",
  },
};

const POMO_PRESETS = [
  { label: "15m Sprint", mins: 15 },
  { label: "25m Standard", mins: 25 },
  { label: "50m Deep Work", mins: 50 },
] as const;

export default function StudyFocusDock({
  onMilestonesOpen,
}: {
  onMilestonesOpen?: () => void;
}) {
  const desk = useDesk();
  const [placed, setPlaced] = useState<LampPos | null>(() => loadLampPos());
  const [dockOpen, setDockOpen] = useState(false);
  const [beacon, setBeacon] = useState<FocusBeaconColor>("brass");
  const [sfxEnabled, setSfxEnabled] = useState(true);

  // Optional Pomodoro Timer State (disabled/hidden by default to avoid distraction)
  const [pomoActive, setPomoActive] = useState(false);
  const [selectedMins, setSelectedMins] = useState(25);
  const [pomoSecs, setPomoSecs] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);
  const pomoTimer = useRef<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const focusVision = useFocusVision(true);

  // Pomodoro countdown loop
  useEffect(() => {
    if (pomoRunning) {
      pomoTimer.current = window.setInterval(() => {
        setPomoSecs((s) => {
          if (s <= 1) {
            setPomoRunning(false);
            // Quiet brass chime — the session is done, no fanfare needed.
            playSfx("unlock", sfxEnabled);
            return selectedMins * 60;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (pomoTimer.current) window.clearInterval(pomoTimer.current);
    }
    return () => {
      if (pomoTimer.current) window.clearInterval(pomoTimer.current);
    };
  }, [pomoRunning, sfxEnabled, selectedMins]);

  const setPreset = (mins: number) => {
    setSelectedMins(mins);
    setPomoSecs(mins * 60);
    setPomoRunning(false);
    setPomoActive(true);
    if (sfxEnabled) playProceduralSfx("click");
  };

  const activeTheme = BEACON_THEMES[beacon];

  // Drag positioning handlers
  const drag = useRef<{
    pointerId: number;
    grabX: number;
    grabY: number;
    originX: number;
    originY: number;
    moved: boolean;
    last: LampPos | null;
  } | null>(null);

  const applyClamp = useCallback((pos: LampPos): LampPos => {
    const el = rootRef.current;
    const box = el ? { w: el.offsetWidth || 180, h: el.offsetHeight || 44 } : { w: 180, h: 44 };
    return clampLampPos(pos.left, pos.top, box, viewportSize());
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = {
      pointerId: e.pointerId,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      originX: e.clientX,
      originY: e.clientY,
      moved: false,
      last: null,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const sess = drag.current;
    if (!sess || sess.pointerId !== e.pointerId) return;
    const el = rootRef.current;
    if (!el) return;
    const dist = Math.hypot(e.clientX - sess.originX, e.clientY - sess.originY);
    if (!sess.moved && dist < LAMP_DRAG_PX) return;
    sess.moved = true;
    const next = applyClamp({
      left: e.clientX - sess.grabX,
      top: e.clientY - sess.grabY,
    });
    sess.last = next;

    el.style.left = `${next.left}px`;
    el.style.top = `${next.top}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.dataset.placed = "true";
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const sess = drag.current;
    if (!sess || sess.pointerId !== e.pointerId) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
    if (sess.moved) {
      const saved = sess.last ?? applyClamp({ left: e.clientX - sess.grabX, top: e.clientY - sess.grabY });
      saveLampPos(saved);
      setPlaced(saved);
    }
  };

  // Format time mm:ss
  const mins = Math.floor(pomoSecs / 60);
  const secs = pomoSecs % 60;
  const timeStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

  return (
    <div
      ref={rootRef}
      id="study-focus-dock"
      className="study-focus-dock-root fixed z-[58] select-none"
      style={
        placed
          ? { left: placed.left, top: placed.top, right: "auto", bottom: "auto" }
          : { right: "1.5rem", bottom: "1.5rem" }
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Hidden Video Feed for Local Analysis */}
      <video
        ref={focusVision.videoRef}
        playsInline
        muted
        className="hidden"
        aria-hidden="true"
      />

      {/* AFK Alarm Toast Banner */}
      {focusVision.status === "alarm" && (
        <motion.div
          initial={ENTER.initial}
          animate={ENTER.animate}
          transition={SOFT}
          className="mb-2 px-3 py-2 bg-rust/10 border border-rust/40 rounded-[var(--radius-dialog)] shadow-2xl backdrop-blur-md flex items-center gap-2 text-rust text-[12px] font-mono"
        >
          <span className="animate-ping w-2 h-2 rounded-[var(--radius-pill)] bg-rust" />
          <span className="font-semibold">FOCUS ALERT:</span>
          <span>Away from study desk!</span>
        </motion.div>
      )}

      {/* Expanded Control Menu Drawer */}
      <AnimatePresence>
        {dockOpen && (
          <motion.div
            initial={ENTER.initial}
            animate={ENTER.animate}
            exit={{ opacity: 0, y: RISE_1, transition: EXIT }}
            transition={SOFT}
            className="mb-2 w-72 bg-night/95 border border-hairline/80 rounded-[var(--radius-dialog)] shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl p-3 text-parchment font-sans overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-hairline/60">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-[var(--radius-pill)]"
                  style={{ backgroundColor: activeTheme.ring, boxShadow: `0 0 8px ${activeTheme.glow}` }}
                />
                <span className="font-mono text-[11px] uppercase tracking-wider text-brass font-semibold">
                  Study Sanctuary
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title={sfxEnabled ? "Mute sound effects" : "Enable sound effects"}
                  onClick={() => setSfxEnabled(!sfxEnabled)}
                  className="p-1 text-faded hover:text-parchment rounded cursor-pointer transition-colors"
                >
                  {sfxEnabled ? <SpeakerHigh size={ICON.sm} className="text-brass" /> : <SpeakerX size={ICON.sm} />}
                </button>
                <button
                  type="button"
                  onClick={() => setDockOpen(false)}
                  className="p-1 text-faded hover:text-parchment rounded cursor-pointer transition-colors"
                >
                  <X size={ICON.sm} />
                </button>
              </div>
            </div>

            {/* Focus Light Themes */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] font-mono text-faded uppercase tracking-wider mb-1.5">
                <span>Light Beacon Theme</span>
                <span className={activeTheme.text}>{activeTheme.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { key: "brass", label: "Study", icon: Flame },
                    { key: "sage", label: "Lock-in", icon: Sun },
                    { key: "moon", label: "Review", icon: Lightning },
                    { key: "rust", label: "Alert", icon: Moon },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setBeacon(key);
                      if (sfxEnabled) playProceduralSfx("click");
                    }}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-[var(--radius-field)] border text-[9.5px] font-mono transition-all cursor-pointer ${
                      beacon === key
                        ? `${BEACON_THEMES[key].border} ${BEACON_THEMES[key].bg} text-parchment`
                        : "border-white/10 bg-white/[0.02] text-faded hover:text-parchment"
                    }`}
                  >
                    <Icon size={ICON.xs} style={{ color: BEACON_THEMES[key].ring }} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Pomodoro Timer Section */}
            <div className="p-2.5 rounded-[var(--radius-dialog)] bg-white/[0.03] border border-hairline/60 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Timer size={ICON.sm} className="text-brass" />
                  <span className="font-mono text-[10.5px] text-faded uppercase tracking-wider font-semibold">
                    Pomodoro Timer
                  </span>
                </div>
                {pomoActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setPomoRunning(false);
                      setPomoActive(false);
                      if (sfxEnabled) playProceduralSfx("click");
                    }}
                    className="text-[10px] font-mono text-faded hover:text-rust flex items-center gap-1 transition-colors"
                  >
                    <EyeSlash size={ICON.xs} />
                    <span>Hide</span>
                  </button>
                )}
              </div>

              {/* Preset Selector */}
              <div className="grid grid-cols-3 gap-1">
                {POMO_PRESETS.map((preset) => (
                  <button
                    key={preset.mins}
                    type="button"
                    onClick={() => setPreset(preset.mins)}
                    className={`py-1 px-1.5 rounded-[var(--radius-field)] border text-[10px] font-mono transition-all cursor-pointer text-center ${
                      pomoActive && selectedMins === preset.mins
                        ? "border-brass/50 bg-brass/20 text-brass font-semibold"
                        : "border-white/10 bg-white/[0.02] text-faded hover:text-parchment"
                    }`}
                  >
                    {preset.mins}m
                  </button>
                ))}
              </div>

              {/* Countdown & Action Row */}
              <div className="flex items-center justify-between pt-1">
                <div className="font-mono text-base font-bold text-parchment tracking-wider">
                  {pomoActive ? timeStr : `${selectedMins}:00`}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPomoActive(true);
                      setPomoRunning(!pomoRunning);
                      if (sfxEnabled) playProceduralSfx("click");
                    }}
                    className={`px-3 py-1.5 rounded-[var(--radius-field)] border font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      pomoRunning
                        ? "border-brass/50 bg-brass/20 text-brass"
                        : "border-brass/40 bg-brass/15 text-brass hover:bg-brass/25"
                    }`}
                  >
                    {pomoRunning ? <Pause size={ICON.xs} /> : <Play size={ICON.xs} />}
                    <span>{pomoRunning ? "Pause" : pomoActive ? "Resume" : "Start"}</span>
                  </button>
                  {pomoActive && (
                    <button
                      type="button"
                      title="Reset Timer"
                      onClick={() => {
                        setPomoRunning(false);
                        setPomoSecs(selectedMins * 60);
                        if (sfxEnabled) playProceduralSfx("click");
                      }}
                      className="p-1.5 rounded-[var(--radius-field)] border border-white/10 bg-white/[0.02] text-faded hover:text-parchment cursor-pointer"
                    >
                      <ArrowCounterClockwise size={ICON.xs} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* AFK Focus Camera Toggle */}
            <button
              type="button"
              onClick={() => {
                focusVision.toggleFocusCam();
                if (sfxEnabled) playProceduralSfx("ignite");
              }}
              className={`w-full mb-3 p-2 rounded-[var(--radius-dialog)] border flex items-center justify-between text-[11px] font-mono font-medium transition-all cursor-pointer ${
                focusVision.isActive
                  ? "border-sage/50 bg-sage/15 text-sage"
                  : "border-white/10 bg-white/[0.02] text-faded hover:text-parchment hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-2">
                {focusVision.isActive ? <Camera size={ICON.sm} className="text-sage" /> : <CameraSlash size={ICON.sm} />}
                <span>{focusVision.isActive ? "Focus Cam: Active" : "Enable Focus Cam"}</span>
              </div>
              <span className="text-[10px] opacity-75 font-mono">100% On-Device</span>
            </button>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                className="p-2 rounded-[var(--radius-field)] border border-white/10 bg-white/[0.02] hover:border-brass/40 hover:bg-brass/10 text-[11px] font-mono text-parchment flex items-center gap-2 cursor-pointer transition-all"
                onClick={() => {
                  setDockOpen(false);
                  desk.openPalette();
                  if (sfxEnabled) playProceduralSfx("click");
                }}
              >
                <Brain size={ICON.sm} className="text-brass" />
                <span>Quiz & Aid</span>
              </button>
              <button
                type="button"
                className="p-2 rounded-[var(--radius-field)] border border-white/10 bg-white/[0.02] hover:border-brass/40 hover:bg-brass/10 text-[11px] font-mono text-parchment flex items-center gap-2 cursor-pointer transition-all"
                onClick={() => {
                  setDockOpen(false);
                  desk.focusChat();
                  if (sfxEnabled) playProceduralSfx("click");
                }}
              >
                <BookOpen size={ICON.sm} className="text-moon" />
                <span>Ask Note</span>
              </button>
              <button
                type="button"
                className="p-2 rounded-[var(--radius-field)] border border-white/10 bg-white/[0.02] hover:border-brass/40 hover:bg-brass/10 text-[11px] font-mono text-parchment flex items-center gap-2 cursor-pointer transition-all"
                onClick={() => {
                  setDockOpen(false);
                  if (onMilestonesOpen) onMilestonesOpen();
                  else desk.openMilestones();
                  if (sfxEnabled) playProceduralSfx("milestone");
                }}
              >
                <Trophy size={ICON.sm} className="text-brass" />
                <span>Milestones</span>
              </button>
              <button
                type="button"
                className="p-2 rounded-[var(--radius-field)] border border-white/10 bg-white/[0.02] hover:border-brass/40 hover:bg-brass/10 text-[11px] font-mono text-parchment flex items-center gap-2 cursor-pointer transition-all"
                onClick={() => {
                  setDockOpen(false);
                  desk.openPalette();
                  if (sfxEnabled) playProceduralSfx("click");
                }}
              >
                <Command size={ICON.sm} className="text-faded" />
                <span>Palette (⌘K)</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Minimalist Study Status Pill / Dock */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setDockOpen(!dockOpen);
          if (sfxEnabled) playProceduralSfx("click");
        }}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-[var(--radius-pill)] border shadow-lg backdrop-blur-xl cursor-pointer transition-all ${
          activeTheme.border
        } ${activeTheme.bg} bg-night/90`}
        style={{
          boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${activeTheme.glow}`,
        }}
      >
        {/* Glowing Lamp Ambient Beacon Core */}
        <div className="relative flex items-center justify-center">
          <span
            className="w-2 h-2 rounded-[var(--radius-pill)] transition-all"
            style={{
              backgroundColor: activeTheme.ring,
              boxShadow: `0 0 8px ${activeTheme.glow}`,
            }}
          />
          {pomoRunning && (
            <span
              className="absolute w-4 h-4 rounded-[var(--radius-pill)] animate-ping opacity-60 pointer-events-none"
              style={{ backgroundColor: activeTheme.ring }}
            />
          )}
        </div>

        {/* Status Text: Non-distracting focus state by default; shows countdown only if Pomodoro is active */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {pomoActive ? (
            <>
              <span className="font-semibold text-parchment tracking-wide">{timeStr}</span>
              <span className="text-faded text-[10px]">·</span>
              <span className={`${activeTheme.text} font-medium text-[10.5px]`}>{activeTheme.label}</span>
            </>
          ) : (
            <span className={`${activeTheme.text} font-medium text-[11px] tracking-wide`}>
              {activeTheme.label}
            </span>
          )}
        </div>

        {/* Sparkle Quick Action Icon */}
        <Sparkle size={ICON.xs} className={`${activeTheme.text} opacity-80`} />
      </motion.div>
    </div>
  );
}
