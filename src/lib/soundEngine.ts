/**
 * Procedural Web Audio Ambient Soundscape & Tactile SFX Engine for Comtus.
 * Zero external audio files — 100% on-device procedural Web Audio synthesis.
 */

export type AmbientSoundType = "rain" | "fireplace" | "lofi" | "all";

export type SfxType =
  | "inkPress"
  | "pageTurn"
  | "quillScratch"
  | "lampChime"
  | "sparkPop"
  | "celebration";

export interface AudioEngineState {
  muted: boolean;
  ambientVolume: number;
  sfxVolume: number;
  activeAmbient: AmbientSoundType | null;
  audioContextState: AudioContextState | "uninitialized";
}

export const STORAGE_KEY_MUTED = "comtus:audio_muted";
export const STORAGE_KEY_AMBIENT_VOL = "comtus:ambient_vol";
export const STORAGE_KEY_SFX_VOL = "comtus:sfx_vol";
export const STORAGE_KEY_AMBIENT_TYPE = "comtus:ambient_type";

type AudioCtor = typeof AudioContext;

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientMasterGain: GainNode | null = null;
let sfxMasterGain: GainNode | null = null;

// Ambient active sound generator state
let activeAmbientType: AmbientSoundType | null = null;
let ambientNodes: {
  sources: (AudioNode | number)[];
  cleanup: () => void;
} | null = null;

// Noise buffer cache
let pinkNoiseBuffer: AudioBuffer | null = null;
let whiteNoiseBuffer: AudioBuffer | null = null;

// Global state variables
let isMutedState = true;
let ambientVolState = 0.5;
let sfxVolState = 0.7;

const stateListeners = new Set<(state: AudioEngineState) => void>();

function safeGetStorage(key: string, defaultVal: string): string {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return defaultVal;
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : defaultVal;
  } catch {
    return defaultVal;
  }
}

function safeSetStorage(key: string, val: string): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, val);
  } catch {
    /* ignore storage quota / access errors */
  }
}

function loadInitialSettings(): void {
  const mutedVal = safeGetStorage(STORAGE_KEY_MUTED, "true");
  isMutedState = mutedVal === "true";

  const ambVal = parseFloat(safeGetStorage(STORAGE_KEY_AMBIENT_VOL, "0.5"));
  ambientVolState = Number.isFinite(ambVal) ? Math.max(0, Math.min(1, ambVal)) : 0.5;

  const sfxVal = parseFloat(safeGetStorage(STORAGE_KEY_SFX_VOL, "0.7"));
  sfxVolState = Number.isFinite(sfxVal) ? Math.max(0, Math.min(1, sfxVal)) : 0.7;
}

loadInitialSettings();

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function emitStateChange(): void {
  const current = getAudioEngineState();
  for (const listener of stateListeners) {
    try {
      listener(current);
    } catch {
      /* ignore subscriber error */
    }
  }
}

function ensureAudioGraph(): AudioContext | null {
  const Ctor = getAudioCtor();
  if (!Ctor) return null;

  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }

  if (!masterGain && audioCtx) {
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(isMutedState ? 0 : 1, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    ambientMasterGain = audioCtx.createGain();
    ambientMasterGain.gain.setValueAtTime(ambientVolState, audioCtx.currentTime);
    ambientMasterGain.connect(masterGain);

    sfxMasterGain = audioCtx.createGain();
    sfxMasterGain.gain.setValueAtTime(sfxVolState, audioCtx.currentTime);
    sfxMasterGain.connect(masterGain);
  }

  return audioCtx;
}

export function unlockAudio(): boolean {
  const ctx = ensureAudioGraph();
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    void ctx.resume().then(() => emitStateChange());
  }
  return true;
}

// Auto unlock on first user gesture if in browser
if (typeof window !== "undefined") {
  const autoUnlock = () => {
    if (audioCtx && audioCtx.state === "running") {
      window.removeEventListener("pointerdown", autoUnlock);
      window.removeEventListener("keydown", autoUnlock);
      return;
    }
    unlockAudio();
    if (audioCtx && audioCtx.state === "running") {
      window.removeEventListener("pointerdown", autoUnlock);
      window.removeEventListener("keydown", autoUnlock);
    }
  };
  window.addEventListener("pointerdown", autoUnlock, { passive: true });
  window.addEventListener("keydown", autoUnlock, { passive: true });
}

export function subscribeAudioEngine(listener: (state: AudioEngineState) => void): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

export function getAudioEngineState(): AudioEngineState {
  return {
    muted: isMutedState,
    ambientVolume: ambientVolState,
    sfxVolume: sfxVolState,
    activeAmbient: activeAmbientType,
    audioContextState: audioCtx ? audioCtx.state : "uninitialized",
  };
}

export function isMuted(): boolean {
  return isMutedState;
}

export function setMuted(muted: boolean): void {
  isMutedState = Boolean(muted);
  safeSetStorage(STORAGE_KEY_MUTED, isMutedState ? "true" : "false");

  if (masterGain && audioCtx) {
    const t = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.linearRampToValueAtTime(isMutedState ? 0 : 1, t + 0.05);
  }

  emitStateChange();
}

export function toggleMuted(): boolean {
  setMuted(!isMutedState);
  return isMutedState;
}

export function getAmbientVolume(): number {
  return ambientVolState;
}

export function setAmbientVolume(vol: number): void {
  const clamped = Math.max(0, Math.min(1, vol));
  ambientVolState = clamped;
  safeSetStorage(STORAGE_KEY_AMBIENT_VOL, clamped.toString());

  if (ambientMasterGain && audioCtx) {
    const t = audioCtx.currentTime;
    ambientMasterGain.gain.cancelScheduledValues(t);
    ambientMasterGain.gain.setValueAtTime(ambientMasterGain.gain.value, t);
    ambientMasterGain.gain.linearRampToValueAtTime(clamped, t + 0.05);
  }

  emitStateChange();
}

export function getSfxVolume(): number {
  return sfxVolState;
}

export function setSfxVolume(vol: number): void {
  const clamped = Math.max(0, Math.min(1, vol));
  sfxVolState = clamped;
  safeSetStorage(STORAGE_KEY_SFX_VOL, clamped.toString());

  if (sfxMasterGain && audioCtx) {
    const t = audioCtx.currentTime;
    sfxMasterGain.gain.cancelScheduledValues(t);
    sfxMasterGain.gain.setValueAtTime(sfxMasterGain.gain.value, t);
    sfxMasterGain.gain.linearRampToValueAtTime(clamped, t + 0.05);
  }

  emitStateChange();
}

export function getActiveAmbient(): AmbientSoundType | null {
  return activeAmbientType;
}

// ---------------------------------------------------------------------------
// Noise Synthesis Helpers
// ---------------------------------------------------------------------------
function getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (pinkNoiseBuffer && pinkNoiseBuffer.sampleRate === ctx.sampleRate) {
    return pinkNoiseBuffer;
  }
  const bufferSize = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Paul Kellet's filtered pink noise generator
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  pinkNoiseBuffer = buffer;
  return buffer;
}

function getWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (whiteNoiseBuffer && whiteNoiseBuffer.sampleRate === ctx.sampleRate) {
    return whiteNoiseBuffer;
  }
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  whiteNoiseBuffer = buffer;
  return buffer;
}

// ---------------------------------------------------------------------------
// Ambient Procedural Generators
// ---------------------------------------------------------------------------

function createRainGenerator(ctx: AudioContext, destination: GainNode) {
  const rainGain = ctx.createGain();
  rainGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  rainGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.2);
  rainGain.connect(destination);

  // Pink noise looped source
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getPinkNoiseBuffer(ctx);
  noiseSource.loop = true;

  // Highpass to eliminate heavy mud
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(220, ctx.currentTime);

  // Lowpass for gentle rainfall dampening
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(950, ctx.currentTime);

  // Slow LFO for gentle rain breeze modulation
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
  lfoGain.gain.setValueAtTime(150, ctx.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(lowpass.frequency);

  noiseSource.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(rainGain);

  noiseSource.start();
  lfo.start();

  return {
    nodes: [noiseSource, lfo, rainGain],
    stop: () => {
      try {
        const t = ctx.currentTime;
        rainGain.gain.cancelScheduledValues(t);
        rainGain.gain.setValueAtTime(rainGain.gain.value, t);
        rainGain.gain.linearRampToValueAtTime(0.0001, t + 0.8);
        setTimeout(() => {
          try {
            noiseSource.stop();
            lfo.stop();
            noiseSource.disconnect();
            lfo.disconnect();
            rainGain.disconnect();
          } catch {
            /* ignore cleanup error */
          }
        }, 850);
      } catch {
        /* ignore */
      }
    },
  };
}

function createFireplaceGenerator(ctx: AudioContext, destination: GainNode) {
  const fireGain = ctx.createGain();
  fireGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  fireGain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 1.0);
  fireGain.connect(destination);

  // Low gentle rumble base
  const rumbleSource = ctx.createBufferSource();
  rumbleSource.buffer = getPinkNoiseBuffer(ctx);
  rumbleSource.loop = true;

  const lowFilter = ctx.createBiquadFilter();
  lowFilter.type = "lowpass";
  lowFilter.frequency.setValueAtTime(180, ctx.currentTime);
  rumbleSource.connect(lowFilter);
  lowFilter.connect(fireGain);
  rumbleSource.start();

  // Intermittent micro-bursts for crackles
  let crackleTimer: number | null = null;
  let active = true;

  const playCracklePop = () => {
    if (!active || !audioCtx || audioCtx.state === "closed") return;
    try {
      const t = ctx.currentTime;
      const crackleSource = ctx.createBufferSource();
      crackleSource.buffer = getWhiteNoiseBuffer(ctx);

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(1400 + Math.random() * 2200, t);
      bandpass.Q.setValueAtTime(3 + Math.random() * 4, t);

      const popGain = ctx.createGain();
      const popDur = 0.008 + Math.random() * 0.025;
      const popPeak = 0.08 + Math.random() * 0.18;

      popGain.gain.setValueAtTime(popPeak, t);
      popGain.gain.exponentialRampToValueAtTime(0.0001, t + popDur);

      crackleSource.connect(bandpass);
      bandpass.connect(popGain);
      popGain.connect(fireGain);

      crackleSource.start(t);
      crackleSource.stop(t + popDur + 0.01);
    } catch {
      /* ignore */
    }

    if (active) {
      const nextDelay = 35 + Math.random() * 260;
      crackleTimer = window.setTimeout(playCracklePop, nextDelay);
    }
  };

  crackleTimer = window.setTimeout(playCracklePop, 80);

  return {
    nodes: [rumbleSource, fireGain],
    stop: () => {
      active = false;
      if (crackleTimer !== null) clearTimeout(crackleTimer);
      try {
        const t = ctx.currentTime;
        fireGain.gain.cancelScheduledValues(t);
        fireGain.gain.setValueAtTime(fireGain.gain.value, t);
        fireGain.gain.linearRampToValueAtTime(0.0001, t + 0.8);
        setTimeout(() => {
          try {
            rumbleSource.stop();
            rumbleSource.disconnect();
            fireGain.disconnect();
          } catch {
            /* ignore cleanup error */
          }
        }, 850);
      } catch {
        /* ignore */
      }
    },
  };
}

function createLofiGenerator(ctx: AudioContext, destination: GainNode) {
  const padGain = ctx.createGain();
  padGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  padGain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.5);
  padGain.connect(destination);

  // Warm study chords: Fmaj7 (F3, A3, C4, E4), Em7 (E3, G3, B3, D4), Dm7 (D3, F3, A3, C4), Cmaj7 (C3, E3, G3, B3)
  const progressions = [
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [164.81, 196.00, 246.94, 293.66], // Em7
    [146.83, 174.61, 220.00, 261.63], // Dm7
    [130.81, 164.81, 196.00, 246.94], // Cmaj7
  ];

  let chordIndex = 0;
  let active = true;
  let chordTimer: number | null = null;

  const playNextChord = () => {
    if (!active || !audioCtx || audioCtx.state === "closed") return;

    const chord = progressions[chordIndex % progressions.length];
    chordIndex++;

    const t = ctx.currentTime;
    const chordDuration = 3.6;

    // Filter for lo-fi warmth
    const chordFilter = ctx.createBiquadFilter();
    chordFilter.type = "lowpass";
    chordFilter.frequency.setValueAtTime(480, t);
    chordFilter.Q.setValueAtTime(1.2, t);

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, t);
    voiceGain.gain.linearRampToValueAtTime(0.06, t + 1.2);
    voiceGain.gain.setValueAtTime(0.06, t + chordDuration - 1.0);
    voiceGain.gain.linearRampToValueAtTime(0.0001, t + chordDuration);

    const localOscs: OscillatorNode[] = [];

    chord.forEach((freq) => {
      // Detuned oscillator pair for lush analog chorusing
      [-4, 4].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t);
        osc.detune.setValueAtTime(cents, t);
        osc.connect(chordFilter);
        osc.start(t);
        osc.stop(t + chordDuration + 0.1);
        localOscs.push(osc);
      });
    });

    chordFilter.connect(voiceGain);
    voiceGain.connect(padGain);

    if (active) {
      chordTimer = window.setTimeout(playNextChord, (chordDuration - 0.6) * 1000);
    }
  };

  playNextChord();

  return {
    nodes: [padGain],
    stop: () => {
      active = false;
      if (chordTimer !== null) clearTimeout(chordTimer);
      try {
        const t = ctx.currentTime;
        padGain.gain.cancelScheduledValues(t);
        padGain.gain.setValueAtTime(padGain.gain.value, t);
        padGain.gain.linearRampToValueAtTime(0.0001, t + 0.8);
        setTimeout(() => {
          try {
            padGain.disconnect();
          } catch {
            /* ignore cleanup error */
          }
        }, 850);
      } catch {
        /* ignore */
      }
    },
  };
}

export function startAmbient(type: AmbientSoundType): void {
  unlockAudio();
  const ctx = ensureAudioGraph();
  if (!ctx || !ambientMasterGain) return;

  if (activeAmbientType === type && ambientNodes) {
    return;
  }

  stopAmbient();

  activeAmbientType = type;
  safeSetStorage(STORAGE_KEY_AMBIENT_TYPE, type);

  const cleanups: (() => void)[] = [];

  if (type === "rain" || type === "all") {
    const rain = createRainGenerator(ctx, ambientMasterGain);
    cleanups.push(rain.stop);
  }
  if (type === "fireplace" || type === "all") {
    const fire = createFireplaceGenerator(ctx, ambientMasterGain);
    cleanups.push(fire.stop);
  }
  if (type === "lofi" || type === "all") {
    const lofi = createLofiGenerator(ctx, ambientMasterGain);
    cleanups.push(lofi.stop);
  }

  ambientNodes = {
    sources: [],
    cleanup: () => {
      cleanups.forEach((fn) => fn());
    },
  };

  emitStateChange();
}

export function stopAmbient(): void {
  if (ambientNodes) {
    ambientNodes.cleanup();
    ambientNodes = null;
  }
  activeAmbientType = null;
  emitStateChange();
}

// ---------------------------------------------------------------------------
// Tactile Micro-interaction SFX Synthesis
// ---------------------------------------------------------------------------

export function playSfx(type: SfxType): void {
  if (isMutedState) return;

  unlockAudio();
  const ctx = ensureAudioGraph();
  if (!ctx || !sfxMasterGain || ctx.state === "closed") return;

  const t0 = ctx.currentTime;

  switch (type) {
    case "inkPress": {
      // Crisp 12ms mechanical/paper tap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, t0);
      osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.012);

      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);

      osc.connect(gain);
      gain.connect(sfxMasterGain);

      osc.start(t0);
      osc.stop(t0 + 0.014);
      break;
    }

    case "pageTurn": {
      // Gentle 80ms bandpass paper rustle
      const noise = ctx.createBufferSource();
      noise.buffer = getWhiteNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1600, t0);
      filter.frequency.linearRampToValueAtTime(2200, t0 + 0.04);
      filter.frequency.linearRampToValueAtTime(1400, t0 + 0.08);
      filter.Q.setValueAtTime(1.8, t0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.14, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(sfxMasterGain);

      noise.start(t0);
      noise.stop(t0 + 0.085);
      break;
    }

    case "quillScratch": {
      // Subtle 45ms dual-tone parchment scratch
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(1900, t0);
      osc1.frequency.linearRampToValueAtTime(2400, t0 + 0.045);

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1450, t0);
      osc2.frequency.linearRampToValueAtTime(1750, t0 + 0.045);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2100, t0);
      filter.Q.setValueAtTime(3.5, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.09, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(sfxMasterGain);

      osc1.start(t0);
      osc2.start(t0);
      osc1.stop(t0 + 0.05);
      osc2.stop(t0 + 0.05);
      break;
    }

    case "lampChime": {
      // Warm 440Hz/880Hz harmonic brass bell ring
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, t0);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, t0);

      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(1320, t0);

      gain.gain.setValueAtTime(0.16, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);

      osc1.connect(gain);
      osc2.connect(gain);
      osc3.connect(gain);
      gain.connect(sfxMasterGain);

      osc1.start(t0);
      osc2.start(t0);
      osc3.start(t0);
      osc1.stop(t0 + 0.68);
      osc2.stop(t0 + 0.68);
      osc3.stop(t0 + 0.68);
      break;
    }

    case "sparkPop": {
      // Pleasant 8-bit rising spark blip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, t0);
      osc.frequency.exponentialRampToValueAtTime(1380, t0 + 0.05);

      gain.gain.setValueAtTime(0.15, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);

      osc.connect(gain);
      gain.connect(sfxMasterGain);

      osc.start(t0);
      osc.stop(t0 + 0.06);
      break;
    }

    case "celebration": {
      // 4-note ascending chord arpeggio (D5, F#5, A5, D6)
      const freqs = [587.33, 739.99, 880.0, 1174.66];
      freqs.forEach((freq, idx) => {
        const noteStart = t0 + idx * 0.075;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.35);

        osc.connect(gain);
        gain.connect(sfxMasterGain!);

        osc.start(noteStart);
        osc.stop(noteStart + 0.37);
      });
      break;
    }
  }
}

/** Test Seam: resets internal AudioContext and state */
export function resetAudioEngineForTests(): void {
  stopAmbient();
  if (audioCtx && audioCtx.state !== "closed") {
    try {
      void audioCtx.close();
    } catch {
      /* ignore */
    }
  }
  audioCtx = null;
  masterGain = null;
  ambientMasterGain = null;
  sfxMasterGain = null;
  pinkNoiseBuffer = null;
  whiteNoiseBuffer = null;
  stateListeners.clear();
  loadInitialSettings();
}
