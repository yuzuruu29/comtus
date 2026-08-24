import { useCallback, useEffect, useRef, useState } from "react";
import { recordClip, speechSupported, startDictation, transcribeClip, type VoiceClip } from "../lib/voice";
import { useCallSettings } from "../lib/settings";

/**
 * One mic button, two engines. Dictation (Web Speech API) when the
 * browser has it; otherwise a recorded clip transcribed through the
 * user's own OpenAI-compatible key. Final text is handed to the
 * composer for review — never auto-sent.
 */

export type VoiceState = "idle" | "listening" | "recording" | "transcribing";

const NO_ENGINE_HINT =
  "Voice input here needs Chrome, Edge, or Safari — or a Groq/OpenAI key in Settings for clip transcription.";

export function useVoiceInput(onCommit: (text: string) => void) {
  const cs = useCallSettings();
  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const finalsRef = useRef("");
  const stopDictationRef = useRef<(() => void) | null>(null);
  const clipRef = useRef<VoiceClip | null>(null);
  const csRef = useRef(cs);
  csRef.current = cs;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const stateRef = useRef<VoiceState>("idle");
  stateRef.current = state;

  const commitFinals = useCallback(() => {
    const text = finalsRef.current.trim();
    finalsRef.current = "";
    setInterim("");
    if (text) onCommitRef.current(text);
  }, []);

  const finishRecording = useCallback(async () => {
    const clip = clipRef.current;
    if (!clip) {
      setState("idle");
      return;
    }
    clipRef.current = null;
    setState("transcribing");
    try {
      const blob = await clip.stop();
      const text = await transcribeClip(blob, {
        apiKey: csRef.current.apiKey,
        baseUrl: csRef.current.baseUrl,
      });
      if (text) onCommitRef.current(text);
      setState("idle");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Transcription failed.");
    }
  }, []);

  const toggle = useCallback(() => {
    setError("");
    const current = stateRef.current;

    if (current === "listening") {
      stopDictationRef.current?.();
      stopDictationRef.current = null;
      commitFinals();
      setState("idle");
      return;
    }
    if (current === "recording") {
      void finishRecording();
      return;
    }
    if (current !== "idle") return;

    if (speechSupported()) {
      finalsRef.current = "";
      setState("listening");
      stopDictationRef.current = startDictation({
        onInterim: setInterim,
        onFinal: (text) => {
          finalsRef.current += text;
          setInterim("");
        },
        onError: (message) => {
          stopDictationRef.current = null;
          commitFinals(); // keep whatever was recognized before the failure
          setState("idle");
          setError(message);
        },
        onEnd: () => {
          stopDictationRef.current = null;
          commitFinals();
          setState("idle");
        },
      });
      return;
    }

    // Clip fallback — needs an OpenAI-compatible key with a Whisper model.
    const { provider, apiKey, baseUrl } = csRef.current;
    if (provider !== "openai-compatible" || !apiKey.trim() || !baseUrl.trim()) {
      setError(NO_ENGINE_HINT);
      return;
    }
    setState("recording");
    setElapsed(0);
    void (async () => {
      try {
        clipRef.current = await recordClip();
      } catch (err) {
        setState("idle");
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Microphone access is blocked — allow it in your browser's site settings."
            : "Recording couldn't start on this device.",
        );
      }
    })();
  }, [commitFinals, finishRecording]);

  // Recording timer.
  useEffect(() => {
    if (state !== "recording") return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  // Mic tracks and recognition must not outlive the composer.
  useEffect(
    () => () => {
      stopDictationRef.current?.();
      void clipRef.current?.stop().catch(() => {});
    },
    [],
  );

  const active = state !== "idle";
  return { state, active, interim, error, elapsed, toggle };
}
