import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAudioEngineForTests, setMuted, setSfxVolume } from "../../lib/soundEngine";
import { playSfx, resetSfxForTests, unlockSfx } from "./sfx";

afterEach(() => {
  resetSfxForTests();
  localStorage.clear();
  resetAudioEngineForTests();
  vi.unstubAllGlobals();
});

/** A stand-in AudioContext that records each oscillator start and gain peak. */
function stubAudio() {
  const start = vi.fn();
  const peaks: number[] = [];
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      currentTime = 0;
      destination = {};
      createOscillator() {
        return { type: "sine", frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start, stop: vi.fn() };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: (value: number) => peaks.push(value),
          },
          connect: vi.fn(),
        };
      }
      resume = vi.fn();
      close = vi.fn();
    },
  );
  return { start, peaks };
}

describe("playSfx", () => {
  it("does nothing when the companion is muted", () => {
    const createOscillator = vi.fn();
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        currentTime = 0;
        destination = {};
        createOscillator = createOscillator;
        createGain = () => ({
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        });
        resume = vi.fn();
        close = vi.fn();
      },
    );
    playSfx("nudge", false);
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it("opens a context and voices a nudge when enabled", () => {
    const start = vi.fn();
    const stop = vi.fn();
    const connect = vi.fn();
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        currentTime = 0;
        destination = {};
        createOscillator() {
          return {
            type: "sine",
            frequency: { setValueAtTime: vi.fn() },
            connect,
            start,
            stop,
          };
        }
        createGain() {
          return {
            gain: {
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
          };
        }
        resume = vi.fn();
        close = vi.fn();
      },
    );
    setMuted(false);
    unlockSfx();
    playSfx("nudge", true);
    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it("stays silent while the desk's Sound switch is off", () => {
    const { start } = stubAudio();
    setMuted(true);
    playSfx("cheer", true);
    expect(start).not.toHaveBeenCalled();
  });

  it("follows the effects volume", () => {
    const { peaks } = stubAudio();
    setMuted(false);
    setSfxVolume(1);
    playSfx("lampClick", true);
    const loud = Math.max(...peaks);
    peaks.length = 0;
    setSfxVolume(0.5);
    playSfx("lampClick", true);
    expect(Math.max(...peaks)).toBeCloseTo(loud / 2, 5);
  });
});
