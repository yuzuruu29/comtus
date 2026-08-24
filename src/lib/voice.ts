import { compatFetchBase } from "./compatRoute";

/**
 * Voice input plumbing — two engines behind one mic button.
 *
 * Primary: the browser's Speech API dictation (Chrome, Edge, Safari,
 * Android) — live interim words, no key, no cost. Fallback: a recorded
 * clip sent to the user's own OpenAI-compatible endpoint for Whisper
 * transcription (Groq's whisper-large-v3-turbo, OpenAI's whisper-1),
 * routed through the same CORS relay logic as chat.
 */

/* ── Detection ────────────────────────────────────────────── */

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

/* ── Composer insertion ───────────────────────────────────── */

/** Append a transcript to existing composer text with sane spacing —
 *  never two spaces, never a glued word, never a trailing no-op. */
export function appendTranscript(existing: string, text: string): string {
  const t = text.trim();
  if (!t) return existing;
  if (!existing) return t;
  if (/\s$/.test(existing)) return existing + t;
  return `${existing} ${t}`;
}

/* ── Whisper model heuristic ──────────────────────────────── */

/** Pick the transcription model from the endpoint's host. Groq hosts
 *  whisper-large-v3-turbo (fast, near-free); OpenAI-compatible
 *  defaults follow OpenAI's naming. */
export function whisperModelFor(baseUrl: string): string {
  let host = "";
  try {
    host = new URL(baseUrl.trim()).hostname;
  } catch {
    /* custom junk — fall through to the OpenAI default */
  }
  if (host === "api.groq.com") return "whisper-large-v3-turbo";
  return "whisper-1";
}

/* ── Live dictation (Web Speech API) ──────────────────────── */

export interface DictationHandlers {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  /** The engine ended on its own and could not be kept alive. */
  onEnd?: () => void;
}

/* Minimal structural view of SpeechRecognition — the DOM lib may or
   may not ship types for it depending on the TS release. */
interface MinimalRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => MinimalRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as new () => MinimalRecognition) : null;
}

/** Start live dictation; returns a stop function. The session stays
 *  alive across engine-side ends (iOS Safari stops after every
 *  phrase) until the user stops it or a real error lands. */
export function startDictation(handlers: DictationHandlers): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    handlers.onError?.("This browser has no built-in speech engine.");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang =
    typeof navigator !== "undefined" && navigator.language
      ? navigator.language
      : "en-US";
  rec.continuous = true;
  rec.interimResults = true;

  let active = true;
  let started = false;

  rec.onresult = (e: unknown) => {
    const ev = e as {
      resultIndex: number;
      results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
    };
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      const text = res[0]?.transcript ?? "";
      if (res.isFinal) handlers.onFinal?.(text);
      else interim += text;
    }
    handlers.onInterim?.(interim);
  };

  rec.onerror = (e: unknown) => {
    const code = (e as { error?: string }).error ?? "";
    if (code === "no-speech" || code === "aborted") return;
    active = false;
    if (code === "not-allowed" || code === "service-not-allowed")
      handlers.onError?.(
        "Microphone access is blocked — allow it in your browser's site settings and try again.",
      );
    else if (code === "network")
      handlers.onError?.("The speech service couldn't be reached — check your connection.");
    else if (code === "language-not-supported")
      handlers.onError?.("This browser's speech engine doesn't support your language.");
    else handlers.onError?.("Voice input failed. Try again, or type your question.");
  };

  rec.onend = () => {
    if (!active) return;
    if (!started) {
      handlers.onEnd?.();
      return;
    }
    try {
      rec.start(); // keep the session alive through silence and phrase breaks
    } catch {
      handlers.onEnd?.();
    }
  };

  try {
    rec.start();
    started = true;
  } catch {
    active = false;
    handlers.onError?.("Voice input couldn't start — try again.");
  }

  return () => {
    active = false;
    try {
      rec.stop();
    } catch {
      /* never started */
    }
  };
}

/* ── Clip recording (fallback engine) ─────────────────────── */

export interface VoiceClip {
  stop: () => Promise<Blob>;
}

/** Record from the microphone until stop() — resolves the clip blob
 *  (webm where supported, mp4 for Safari). */
export async function recordClip(): Promise<VoiceClip> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  )
    throw new DOMException("Recording is unavailable in this browser.", "NotSupportedError");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = ["audio/webm", "audio/mp4", ""].find(
    (m) => !m || MediaRecorder.isTypeSupported(m),
  );
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  rec.start();
  const stopped = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }));
  });
  return {
    stop: () => {
      if (rec.state !== "inactive") rec.stop();
      stream.getTracks().forEach((t) => t.stop());
      return stopped;
    },
  };
}

/* ── Whisper transcription ────────────────────────────────── */

export interface TranscribeTarget {
  apiKey: string;
  baseUrl: string;
}

const TRANSCRIBE_HINT =
  "This endpoint doesn't host a transcription model — add a Groq or OpenAI key in Settings for clip transcription.";

/** Send a recorded clip to the user's own OpenAI-compatible endpoint
 *  and return the transcript. Routed through the same CORS relay as
 *  chat (compatFetchBase), key stays between browser and provider. */
export async function transcribeClip(
  blob: Blob,
  target: TranscribeTarget,
  signal?: AbortSignal,
): Promise<string> {
  const base = compatFetchBase(target.baseUrl).replace(/\/+$/, "");
  if (!base) throw new Error("No transcription endpoint configured — add a Groq or OpenAI key in Settings.");
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const form = new FormData();
  form.append("file", blob, `voice.${ext}`);
  form.append("model", whisperModelFor(target.baseUrl));
  form.append("response_format", "json");

  let res: Response;
  try {
    res = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${target.apiKey.trim() || "comtus-local"}` },
      body: form,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("Couldn't reach the transcription endpoint — check your connection.");
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error("The API key was rejected — check it in Settings.");
    if (res.status === 429) throw new Error("Rate limited by the endpoint — wait a moment and try again.");
    if (res.status === 400 || res.status === 404) throw new Error(TRANSCRIBE_HINT);
    throw new Error(`Transcription failed (${res.status}).`);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
