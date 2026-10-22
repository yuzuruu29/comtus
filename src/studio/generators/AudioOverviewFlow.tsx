import { useEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  Broadcast,
  Pause,
  Play,
  SpeakerHigh,
} from "@phosphor-icons/react";
import { buildSourceBlock, GENERATOR_SYSTEM } from "./common";
import { generateJSON, friendlyError } from "../../lib/llm";
import { useCallSettings } from "../../lib/settings";
import { saveGeneration, uid } from "../../lib/db";
import type { AudioOverviewPayload, Generation } from "../../lib/types";
import { btnGhost, btnLamp, ErrorNote } from "../ui";
import { BorderBeam } from "../fx";
import { ICON } from "../../ui/iconScale";

export async function generateAudioOverviewScript(
  notebookId: string,
  settings: ReturnType<typeof useCallSettings>,
): Promise<Generation> {
  const { block, titles } = await buildSourceBlock(
    notebookId,
    "overview key concepts insights debate comparison key takeaways",
  );

  if (!block.trim()) {
    throw new Error("Add at least one source before generating an Audio Overview.");
  }

  const prompt = `You are a world-class educational podcast producer creating a deep-dive conversation between two knowledgeable, engaging hosts:
- **Alex** (Host 1): Thoughtful, inquisitive, frames big questions, makes insightful analogies.
- **Sam** (Host 2): Sharp, detail-oriented, cites concrete evidence from the sources, breaks down nuances.

Sources:
${block}

Write a natural, insightful 8 to 14 turn conversational audio script discussing the key ideas, findings, tensions, and implications in these sources.
Tone: Lively, intellectual, clear, and engaging (like NPR's Hidden Brain or NotebookLM Deep Dive).

Output JSON schema:
{
  "title": "Audio Overview: [Compelling title]",
  "summary": "1-2 sentence overview of what is explored in this conversation.",
  "script": [
    { "speaker": "Alex", "text": "..." },
    { "speaker": "Sam", "text": "..." }
  ]
}`;

  const raw = await generateJSON<AudioOverviewPayload>({
    ...settings,
    system: GENERATOR_SYSTEM,
    user: prompt,
  });

  const payload: AudioOverviewPayload = {
    title: raw.title || `Audio Overview (${titles.slice(0, 2).join(", ")})`,
    summary: raw.summary || "Deep dive exploration across the notebook's sources.",
    script: Array.isArray(raw.script) ? raw.script : [],
    duration: (raw.script?.length ?? 10) * 18,
  };

  const gen: Generation = {
    id: uid(),
    notebookId,
    kind: "audio-overview",
    title: payload.title,
    payload,
    createdAt: Date.now(),
  };

  await saveGeneration(gen);
  return gen;
}

export function AudioOverviewViewer({
  payload,
  onRegenerate,
}: {
  payload: AudioOverviewPayload;
  onRegenerate?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const turns = payload.script || [];
  const transcriptRef = useRef<HTMLDivElement>(null);
  const turnTimerRef = useRef<number | null>(null);

  // Web Speech API synthesis
  const speakCurrent = (turnIndex: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const turn = turns[turnIndex];
    if (!turn) {
      setPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(turn.text);
    utterance.rate = playbackSpeed;
    utterance.pitch = turn.speaker === "Alex" ? 1.05 : 0.95;

    utterance.onend = () => {
      if (turnIndex + 1 < turns.length) {
        setCurrentTurn(turnIndex + 1);
        speakCurrent(turnIndex + 1);
      } else {
        setPlaying(false);
        setCurrentTurn(0);
      }
    };

    utterance.onerror = () => {
      setPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const togglePlay = () => {
    if (playing) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
      setPlaying(false);
    } else {
      setPlaying(true);
      speakCurrent(currentTurn);
    }
  };

  const restart = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setCurrentTurn(0);
    setPlaying(true);
    speakCurrent(0);
  };

  useEffect(() => {
    const timer = turnTimerRef.current;
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Auto scroll transcript to active turn
  useEffect(() => {
    const el = transcriptRef.current?.querySelector(`[data-turn="${currentTurn}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentTurn]);

  const totalTurns = turns.length;
  const progressPercent = totalTurns > 0 ? ((currentTurn + 1) / totalTurns) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Player Header Card */}
      <div className="rounded-[var(--radius-dialog)] border border-brass/30 bg-surface/80 p-5 shadow-sm relative overflow-hidden">
        <BorderBeam size={100} duration={playing ? 4 : 10} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-dialog)] bg-brass/15 text-brass">
              <Broadcast size={ICON.xxl} weight={playing ? "fill" : "light"} className={playing ? "animate-pulse" : ""} />
            </div>
            <div>
              <h3 className="font-display text-[17px] font-[500] text-ink">{payload.title}</h3>
              <p className="mt-0.5 text-[12.5px] text-muted line-clamp-1">{payload.summary}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaybackSpeed((s) => (s === 1 ? 1.25 : s === 1.25 ? 1.5 : 1))}
              className="rounded-[var(--radius-pill)] border border-hairline bg-surface px-3 py-1 font-mono text-[11px] text-muted hover:text-ink transition-colors"
              title="Playback speed"
            >
              {playbackSpeed}x
            </button>
            <button
              onClick={restart}
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] border border-hairline bg-surface text-muted hover:text-ink transition-colors"
              title="Restart"
            >
              <ArrowCounterClockwise size={ICON.md} />
            </button>
            <button
              onClick={togglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] grad-lamp text-ground shadow-sm hover:brightness-105 active:scale-95 transition-all"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={ICON.lg} weight="bold" /> : <Play size={ICON.lg} weight="bold" className="ml-0.5" />}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative z-10 mt-5">
          <div className="h-1.5 w-full rounded-[var(--radius-pill)] bg-ink/[0.08] overflow-hidden">
            <div
              className="h-full grad-lamp transition-all duration-slow rounded-[var(--radius-pill)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
            <span>Segment {currentTurn + 1} of {totalTurns}</span>
            <span>{playing ? "Playing conversation…" : "Paused"}</span>
          </div>
        </div>
      </div>

      {/* Interactive Transcript */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-display text-[14px] font-[450] text-ink">Conversation Transcript</h4>
          <span className="font-mono text-[10.5px] text-muted">Alex & Sam</span>
        </div>

        <div
          ref={transcriptRef}
          className="max-h-[50vh] space-y-3 overflow-y-auto rounded-[var(--radius-dialog)] border border-hairline bg-surface/40 p-4"
        >
          {turns.map((turn, i) => {
            const isAlex = turn.speaker === "Alex";
            const isActive = i === currentTurn;

            return (
              <button
                type="button"
                key={i}
                data-turn={i}
                onClick={() => {
                  setCurrentTurn(i);
                  if (playing) speakCurrent(i);
                }}
                className={`block w-full text-left cursor-pointer rounded-[var(--radius-dialog)] p-3.5 transition-all ${
                  isActive
                    ? "bg-brass/[0.09] border border-brass/35 shadow-sm"
                    : "hover:bg-ink/[0.03] border border-transparent opacity-75 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-[var(--radius-pill)] text-[10px] font-mono ${
                    isAlex ? "bg-moon/20 text-moon font-medium" : "bg-brass/20 text-brass font-medium"
                  }`}>
                    {isAlex ? "A" : "S"}
                  </span>
                  <span className="font-display text-[13px] font-[500] text-ink">{turn.speaker}</span>
                  {isActive && playing && (
                    <span className="ml-auto flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-[var(--radius-pill)] bg-brass opacity-75" />
                      <span className="relative inline-flex rounded-[var(--radius-pill)] h-2 w-2 bg-brass" />
                    </span>
                  )}
                </div>
                <p className="text-[13.5px] leading-relaxed text-ink/90">{turn.text}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex justify-between items-center pt-2">
        {onRegenerate && (
          <button onClick={onRegenerate} className={btnGhost}>
            <ArrowCounterClockwise size={ICON.sm} className="mr-1.5" />
            Regenerate Overview
          </button>
        )}
      </div>
    </div>
  );
}

export function AudioOverviewModal({
  notebookId,
  onClose,
  onDone,
}: {
  notebookId: string;
  open?: boolean;
  onClose: () => void;
  onDone: (gen: Generation) => void;
}) {
  const settings = useCallSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const gen = await generateAudioOverviewScript(notebookId, settings);
      onDone(gen);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-dialog)] bg-brass/10 text-brass">
          <SpeakerHigh size={ICON.xl} weight="light" />
        </div>
        <div>
          <h3 className="font-display text-[15px] font-[500] text-ink">Generate Audio Overview</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Create an interactive, 2-host audio deep dive ("Alex" & "Sam") analyzing the main findings, connections, and debates across your sources.
          </p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onClose} className={btnGhost} disabled={loading}>
          Cancel
        </button>
        <button onClick={handleGenerate} className={btnLamp} disabled={loading}>
          {loading ? "Generating conversation…" : "Generate Overview"}
        </button>
      </div>
    </div>
  );
}
