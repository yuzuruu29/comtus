import { afterEach, describe, expect, it, vi } from "vitest";
import { playSfx, resetSfxForTests, unlockSfx } from "./sfx";

afterEach(() => {
  resetSfxForTests();
  vi.unstubAllGlobals();
});

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
    unlockSfx();
    playSfx("nudge", true);
    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
});
