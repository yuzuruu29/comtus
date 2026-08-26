export type SfxKind = "nudge" | "cheer" | "unlock";

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function audioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Resume after a user gesture so later AFK chimes are allowed to play. */
export function unlockSfx(): void {
  const Ctor = audioCtor();
  if (!Ctor) return;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  peak: number,
): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Soft brass pentatonic — a lamp chime, not a game ding. */
export function playSfx(kind: SfxKind, enabled: boolean): void {
  if (!enabled) return;
  unlockSfx();
  if (!ctx || ctx.state === "closed") return;

  switch (kind) {
    case "nudge":
      tone(392, 0, 0.28, "triangle", 0.07);
      tone(494, 0.16, 0.42, "triangle", 0.08);
      break;
    case "cheer":
      tone(392, 0, 0.18, "triangle", 0.055);
      tone(523, 0.12, 0.22, "triangle", 0.07);
      tone(659, 0.26, 0.34, "triangle", 0.06);
      break;
    case "unlock":
      tone(330, 0, 0.22, "triangle", 0.06);
      tone(415, 0.14, 0.28, "triangle", 0.075);
      tone(523, 0.32, 0.36, "triangle", 0.08);
      tone(659, 0.5, 0.5, "sine", 0.05);
      break;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

/** Test seam — forget the shared context between cases. */
export function resetSfxForTests(): void {
  if (ctx && ctx.state !== "closed") void ctx.close();
  ctx = null;
}
