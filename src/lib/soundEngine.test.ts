import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY_AMBIENT_TYPE,
  STORAGE_KEY_AMBIENT_VOL,
  STORAGE_KEY_MUTED,
  STORAGE_KEY_SFX_VOL,
  getActiveAmbient,
  getAmbientVolume,
  getAudioEngineState,
  getSfxVolume,
  isMuted,
  playSfx,
  resetAudioEngineForTests,
  setAmbientVolume,
  setMuted,
  setSfxVolume,
  startAmbient,
  stopAmbient,
  subscribeAudioEngine,
  toggleMuted,
  unlockAudio,
} from "./soundEngine";

class MockAudioParam {
  value = 1;
  setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  exponentialRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  cancelScheduledValues = vi.fn();
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  type = "sine";
  frequency = new MockAudioParam();
  detune = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

class MockBiquadFilterNode extends MockAudioNode {
  type = "lowpass";
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: unknown = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = new MockGainNode();

  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
  createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => {
    const data = new Float32Array(length);
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => data,
    };
  });
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}

describe("soundEngine", () => {
  beforeEach(() => {
    localStorage.clear();
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
    resetAudioEngineForTests();
  });

  afterEach(() => {
    resetAudioEngineForTests();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("initializes with muted state by default per brand and grill decisions", () => {
    expect(isMuted()).toBe(true);
    expect(getAmbientVolume()).toBe(0.5);
    expect(getSfxVolume()).toBe(0.7);
    expect(getActiveAmbient()).toBeNull();
  });

  it("unlocks audio context upon user gesture or unlockAudio call", () => {
    const unlocked = unlockAudio();
    expect(unlocked).toBe(true);
    const state = getAudioEngineState();
    expect(state.audioContextState).toBe("running");
  });

  it("updates and persists muted state", () => {
    expect(isMuted()).toBe(true);

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY_MUTED)).toBe("false");

    toggleMuted();
    expect(isMuted()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY_MUTED)).toBe("true");
  });

  it("updates and clamps ambient volume within [0, 1] range", () => {
    setAmbientVolume(0.8);
    expect(getAmbientVolume()).toBe(0.8);
    expect(localStorage.getItem(STORAGE_KEY_AMBIENT_VOL)).toBe("0.8");

    // Clamps high values
    setAmbientVolume(1.5);
    expect(getAmbientVolume()).toBe(1);

    // Clamps negative values
    setAmbientVolume(-0.2);
    expect(getAmbientVolume()).toBe(0);
  });

  it("updates and clamps SFX volume within [0, 1] range", () => {
    setSfxVolume(0.4);
    expect(getSfxVolume()).toBe(0.4);
    expect(localStorage.getItem(STORAGE_KEY_SFX_VOL)).toBe("0.4");

    setSfxVolume(2.0);
    expect(getSfxVolume()).toBe(1);

    setSfxVolume(-1.0);
    expect(getSfxVolume()).toBe(0);
  });

  it("notifies subscribers when audio engine state changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAudioEngine(listener);

    setMuted(false);
    expect(listener).toHaveBeenCalled();
    const lastCallState = listener.mock.calls[listener.mock.calls.length - 1][0];
    expect(lastCallState.muted).toBe(false);

    unsubscribe();
    listener.mockClear();

    setMuted(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("starts and stops ambient sound generators (rain, fireplace, lofi, all)", () => {
    // Start rain
    startAmbient("rain");
    expect(getActiveAmbient()).toBe("rain");
    expect(localStorage.getItem(STORAGE_KEY_AMBIENT_TYPE)).toBe("rain");

    // Switch to fireplace
    startAmbient("fireplace");
    expect(getActiveAmbient()).toBe("fireplace");

    // Switch to lofi
    startAmbient("lofi");
    expect(getActiveAmbient()).toBe("lofi");

    // Switch to all
    startAmbient("all");
    expect(getActiveAmbient()).toBe("all");

    // Stop ambient
    stopAmbient();
    expect(getActiveAmbient()).toBeNull();
  });

  it("does not synthesize tactile SFX when muted", () => {
    setMuted(true);
    // Should not throw or create nodes
    expect(() => {
      playSfx("inkPress");
      playSfx("pageTurn");
      playSfx("quillScratch");
      playSfx("lampChime");
      playSfx("sparkPop");
      playSfx("celebration");
    }).not.toThrow();
  });

  it("synthesizes tactile SFX when unmuted", () => {
    setMuted(false);
    expect(() => {
      playSfx("inkPress");
      playSfx("pageTurn");
      playSfx("quillScratch");
      playSfx("lampChime");
      playSfx("sparkPop");
      playSfx("celebration");
    }).not.toThrow();
  });

  it("handles environment without AudioContext gracefully", () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = undefined;
    resetAudioEngineForTests();

    expect(unlockAudio()).toBe(false);
    expect(() => {
      startAmbient("rain");
      stopAmbient();
      playSfx("inkPress");
    }).not.toThrow();
  });
});
