export type SfxKind =
  | "nudge"
  | "cheer"
  | "unlock"
  | "cardFlip"
  | "lampClick"
  | "wrong"
  | "alarm"
  | "focusResume";

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

/** Resume after a user gesture so later audio effects are allowed to play. */
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

/** Tactile clicks and lamp chimes — synthesized entirely on-device via Web Audio. */
export function playSfx(kind: SfxKind, enabled = true): void {
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
    case "cardFlip":
      tone(320, 0, 0.05, "triangle", 0.04);
      tone(480, 0.03, 0.06, "sine", 0.035);
      break;
    case "lampClick":
      tone(800, 0, 0.025, "triangle", 0.06);
      tone(1400, 0.015, 0.03, "sine", 0.045);
      break;
    case "wrong":
      tone(220, 0, 0.18, "sawtooth", 0.04);
      tone(164, 0.08, 0.24, "triangle", 0.05);
      break;
    case "alarm":
      tone(880, 0, 0.09, "sawtooth", 0.08);
      tone(440, 0.09, 0.11, "square", 0.07);
      tone(880, 0.2, 0.09, "sawtooth", 0.08);
      tone(440, 0.29, 0.12, "square", 0.07);
      break;
    case "focusResume":
      tone(523, 0, 0.1, "triangle", 0.06);
      tone(659, 0.08, 0.12, "triangle", 0.07);
      tone(784, 0.16, 0.14, "sine", 0.08);
      tone(1046, 0.24, 0.35, "sine", 0.09);
      break;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

/** Procedural UI SFX generator */
export function playProceduralSfx(action: "click" | "ignite" | "milestone" | "flip" | "correct" | "wrong" | "pop"): void {
  unlockSfx();
  if (!ctx || ctx.state === "closed") return;

  switch (action) {
    case "click":
      tone(900, 0, 0.02, "triangle", 0.04);
      break;
    case "ignite":
      tone(440, 0, 0.08, "triangle", 0.05);
      tone(880, 0.04, 0.15, "sine", 0.06);
      break;
    case "milestone":
      playSfx("unlock", true);
      break;
    case "flip":
      playSfx("cardFlip", true);
      break;
    case "correct":
      playSfx("cheer", true);
      break;
    case "wrong":
      playSfx("wrong", true);
      break;
    case "pop":
      tone(620, 0, 0.04, "sine", 0.05);
      break;
  }
}

/** Test seam — forget the shared context between cases. */
export function resetSfxForTests(): void {
  if (ctx && ctx.state !== "closed") void ctx.close();
  ctx = null;
}
