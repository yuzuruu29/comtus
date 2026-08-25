import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendTranscript,
  recordClip,
  startDictation,
  transcribeClip,
  whisperModelFor,
} from "./voice";

describe("appendTranscript", () => {
  it("inserts into empty composer text as-is", () => {
    expect(appendTranscript("", "hello world")).toBe("hello world");
  });

  it("adds a single space after a word", () => {
    expect(appendTranscript("What is", "photosynthesis")).toBe("What is photosynthesis");
  });

  it("keeps existing trailing whitespace instead of doubling it", () => {
    expect(appendTranscript("What is ", "photosynthesis")).toBe("What is photosynthesis");
    expect(appendTranscript("What is\n", "photosynthesis")).toBe("What is\nphotosynthesis");
  });

  it("ignores blank transcripts", () => {
    expect(appendTranscript("Untouched", "   ")).toBe("Untouched");
    expect(appendTranscript("", "   ")).toBe("");
  });

  it("trims stray whitespace around the transcript", () => {
    expect(appendTranscript("Say", "  something  ")).toBe("Say something");
  });
});

describe("whisperModelFor", () => {
  it("picks Groq's turbo model on Groq", () => {
    expect(whisperModelFor("https://api.groq.com/openai/v1")).toBe("whisper-large-v3-turbo");
  });

  it("picks OpenAI's whisper-1 on OpenAI and unknown hosts", () => {
    expect(whisperModelFor("https://api.openai.com/v1")).toBe("whisper-1");
    expect(whisperModelFor("https://openrouter.ai/api/v1")).toBe("whisper-1");
    expect(whisperModelFor("not a url")).toBe("whisper-1");
  });
});

describe("transcribeClip", () => {
  afterEach(() => vi.unstubAllGlobals());

  const clip = () => new Blob(["fake-audio"], { type: "audio/webm" });
  const groq = { apiKey: "gsk_test", baseUrl: "https://api.groq.com/openai/v1" };

  it("posts multipart to /audio/transcriptions with the routed base and right model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "  What is osmosis?  " }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const text = await transcribeClip(clip(), groq);

    expect(text).toBe("What is osmosis?");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer gsk_test");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("response_format")).toBe("json");
    const file = form.get("file") as File;
    expect(file.name).toBe("voice.webm");
  });

  it("maps a rejected key to friendly copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 401 })),
    );
    await expect(transcribeClip(clip(), groq)).rejects.toThrow("API key was rejected");
  });

  it("maps model-less endpoints to the Groq/OpenAI hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bad model", { status: 400 })),
    );
    await expect(transcribeClip(clip(), groq)).rejects.toThrow(
      "doesn't host a transcription model",
    );
  });

  it("maps network failure to a connection message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("boom")));
    await expect(transcribeClip(clip(), groq)).rejects.toThrow("check your connection");
  });
});

/* ── Live dictation: endpointing + stop flow ──────────────────── */

interface FakeResult {
  transcript: string;
  isFinal: boolean;
}

class FakeRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  started = 0;
  stopped = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    this.started++;
  }
  stop() {
    this.stopped++;
  }
}

describe("startDictation", () => {
  let instances: FakeRecognition[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    instances = [];
    vi.stubGlobal(
      "SpeechRecognition",
      class {
        constructor() {
          const rec = new FakeRecognition();
          instances.push(rec);
          return rec;
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const emit = (rec: FakeRecognition, results: FakeResult[]) => {
    rec.onresult?.({
      resultIndex: 0,
      results: results.map((r) => Object.assign([r], { isFinal: r.isFinal })),
    });
  };

  const start = (overrides: Partial<Parameters<typeof startDictation>[0]> = {}) => {
    const seen = { finals: [] as string[], pauses: 0, ended: false };
    const stop = startDictation({
      onFinal: (t) => seen.finals.push(t),
      onPause: () => seen.pauses++,
      onEnd: () => {
        seen.ended = true;
      },
      ...overrides,
    });
    return { stop, seen, rec: instances[0] };
  };

  it("commits each phrase after a trailing-silence pause and keeps listening", () => {
    const { seen, rec } = start();

    emit(rec, [{ transcript: "hello", isFinal: false }]);
    vi.advanceTimersByTime(300);
    emit(rec, [{ transcript: "hello world", isFinal: true }]);

    // Silence crosses the endpointing window → the phrase lands now.
    vi.advanceTimersByTime(1400);
    expect(seen.finals).toEqual(["hello world"]);
    expect(seen.pauses).toBe(1);
    expect(seen.ended).toBe(false);

    // Re-armed: silence alone never fires twice.
    vi.advanceTimersByTime(5000);
    expect(seen.pauses).toBe(1);
    expect(rec.started).toBe(1); // no engine restart either
  });

  it("stays quiet before the first word", () => {
    const { seen } = start();
    vi.advanceTimersByTime(10000);
    expect(seen.pauses).toBe(0);
    expect(seen.finals).toEqual([]);
    expect(seen.ended).toBe(false);
  });

  it("manual stop lets the engine finalize the tail, then reports end", () => {
    const { stop, seen, rec } = start();

    emit(rec, [{ transcript: "wor", isFinal: false }]);
    vi.advanceTimersByTime(100); // still inside the utterance
    stop();

    // Engine confirms the pending tail only after stop().
    emit(rec, [{ transcript: "world", isFinal: true }]);
    rec.onend?.();

    expect(seen.finals).toEqual(["world"]);
    expect(seen.ended).toBe(true);
    expect(rec.stopped).toBe(1);

    // Poll is torn down — no phantom pauses afterwards.
    vi.advanceTimersByTime(5000);
    expect(seen.pauses).toBe(0);
  });

  it("keeps the session alive across engine-side ends", () => {
    const { seen, rec } = start();
    rec.onend?.(); // e.g. iOS Safari ends after every phrase
    expect(seen.ended).toBe(false);
    expect(rec.started).toBe(2); // restarted once
  });

  it("stops cleanly on a real error without restarting", () => {
    const errors: string[] = [];
    const { seen, rec } = start({ onError: (m) => errors.push(m) });
    rec.onerror?.({ error: "network" });
    expect(errors).toEqual(["The speech service couldn't be reached — check your connection."]);
    rec.onend?.();
    // The session is dead — no restart, no further callbacks; the
    // caller's onError already committed and went idle.
    expect(seen.ended).toBe(false);
    expect(rec.started).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(seen.pauses).toBe(0);
  });
});

/* ── Clip recording: VAD auto-stop ────────────────────────────── */

describe("recordClip", () => {
  let recorders: FakeRecorder[];
  let voiced: boolean;

  class FakeRecorder {
    static isTypeSupported() {
      return true;
    }
    mimeType = "audio/webm";
    state = "inactive";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() {
      this.state = "recording";
    }
    stop() {
      if (this.state !== "inactive") {
        this.state = "inactive";
        this.onstop?.();
      }
    }
    constructor() {
      recorders.push(this);
    }
  }

  class FakeAnalyser {
    fftSize = 512;
    connect() {}
    getByteTimeDomainData(buf: Uint8Array) {
      buf.fill(128);
      if (voiced) buf[0] = 255; // one loud sample ⇒ RMS ≈ 0.044 ≥ threshold
    }
  }

  class FakeAudioContext {
    resume() {
      return Promise.resolve();
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    createAnalyser() {
      return new FakeAnalyser();
    }
    close() {
      return Promise.resolve();
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    recorders = [];
    voiced = false;
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("ends itself after speech goes quiet and hands over for transcription", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const onAutoStop = vi.fn();
    const clip = await recordClip({ onAutoStop, silenceMs: 300 });
    expect(recorders[0].state).toBe("recording");

    voiced = true;
    vi.advanceTimersByTime(240);
    voiced = false; // the last word was just spoken
    vi.advanceTimersByTime(600);

    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(recorders[0].state).toBe("inactive");

    // Idempotent stop still resolves the same finished blob.
    const blob = await clip.stop();
    expect(blob).toBeInstanceOf(Blob);
    expect(onAutoStop).toHaveBeenCalledTimes(1);
  });

  it("keeps recording through silence that precedes any speech", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const onAutoStop = vi.fn();
    await recordClip({ onAutoStop, silenceMs: 300 });

    vi.advanceTimersByTime(5000); // room noise only — RMS below threshold
    expect(onAutoStop).not.toHaveBeenCalled();
    expect(recorders[0].state).toBe("recording");
  });

  it("manual stop still works without WebAudio", async () => {
    const onAutoStop = vi.fn();
    const clip = await recordClip({ onAutoStop });

    voiced = true;
    vi.advanceTimersByTime(5000);
    expect(onAutoStop).not.toHaveBeenCalled();

    const blob = await clip.stop();
    expect(blob).toBeInstanceOf(Blob);
    expect(recorders[0].state).toBe("inactive");
  });
});
