import { useEffect, useState } from "react";
import { Warning, Lightning, Crown, ArrowRight, Clock } from "@phosphor-icons/react";
import { useSettings } from "../lib/settings";
import { Modal } from "./ui";

interface FreeLimitDetail {
  message?: string;
  model?: string;
}

export default function FreeLimitWarningModal({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [, setDetail] = useState<FreeLimitDetail>({});
  const activeModel = useSettings((s) => s.compatModel);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<FreeLimitDetail>;
      setDetail(customEvent.detail || {});
      setOpen(true);
    };

    window.addEventListener("comtus:free-limit-hit", handler);
    return () => window.removeEventListener("comtus:free-limit-hit", handler);
  }, []);

  const handleSwitchModel = (newModelId: string) => {
    useSettings.getState().update({
      compatModel: newModelId,
    });
    setOpen(false);
  };

  const handleUseGroq = () => {
    useSettings.getState().update({
      compatBaseUrl: "https://api.groq.com/openai/v1",
      compatModel: "llama-3.3-70b-versatile",
    });
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={
        <div className="flex items-center gap-2 text-amber-300">
          <Warning size={20} weight="fill" className="text-amber-400" />
          <span>Estimated Free Daily Limit Reached</span>
        </div>
      }
      wide
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-[13px] leading-relaxed text-ink/90">
          <p className="font-medium text-amber-200">
            OpenRouter's free tier has an estimated daily request limit per model during peak hours.
          </p>
          <p className="mt-1.5 text-muted text-[12px]">
            Your notes, uploaded documents, and study history are <strong>100% safe</strong> on your device. Choose an option below to continue studying without delay:
          </p>
        </div>

        {/* Quick Solution 1: Switch to another working free model */}
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-brasspale font-medium mb-2.5 flex items-center justify-between">
            <span>Option 1: Switch to Another Working Free Model (1-Click)</span>
            <span className="text-sage text-[10px]">100% Free</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[
              {
                id: "dots-studio/dots-3-note-preview:free",
                name: "Dots3-Note Preview",
                badge: "Top Note Synthesizer",
                desc: "512k Ctx · Visual lecture notes & textbook synthesis.",
              },
              {
                id: "nvidia/nemotron-3.5-lightning:free",
                name: "Nemotron 3.5 Lightning",
                badge: "500+ tok/s · 1M Ctx",
                desc: "Fastest 1M context engine for instant drills & flashcards.",
              },
              {
                id: "google/gemma-4-31b-it:free",
                name: "Google Gemma 4 31B",
                badge: "Vision Thinking Mode",
                desc: "DeepMind multimodal model for handwritten notes & math.",
              },
              {
                id: "z-ai/glm-5.2:free",
                name: "Z.ai GLM 5.2",
                badge: "100-Item Exam Logic",
                desc: "Long-horizon clinical & complex exam problem solving.",
              },
            ].map((m) => {
              const isCurrent = activeModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSwitchModel(m.id)}
                  disabled={isCurrent}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                    isCurrent
                      ? "opacity-50 border-hairline bg-ink/[0.02] cursor-not-allowed"
                      : "border-hairline bg-ground/70 hover:border-brass/50 hover:bg-brass/[0.06]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-[12.5px] text-ink truncate">{m.name}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-brass/10 border border-brass/20 text-brasspale shrink-0">
                      {m.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted line-clamp-2">{m.desc}</p>
                  <div className="mt-2 text-right font-mono text-[10px] text-moon">
                    {isCurrent ? "Currently active" : "Switch & Continue →"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Solution 2: Switch to Groq Fast Free Endpoint */}
        <div className="rounded-xl border border-hairline bg-ink/[0.02] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Lightning size={16} className="text-sage shrink-0" />
              <span className="font-medium text-[13px] text-ink">
                Switch to Groq Free Endpoint (Llama 3.3 70B)
              </span>
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              Groq's dedicated LPUs deliver 500+ tok/s with virtually zero queue latency.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUseGroq}
            className="shrink-0 rounded-lg border border-sage/40 bg-sage/10 px-3 py-1.5 font-mono text-[11px] text-sage font-medium hover:bg-sage/20 transition-colors"
          >
            Switch to Groq →
          </button>
        </div>

        {/* Quick Solution 3: Upgrade to Smarter Models Pass */}
        <div className="overflow-hidden rounded-xl border border-brass/40 bg-gradient-to-r from-brass/[0.12] via-ground/80 to-ground p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <Crown size={18} className="text-brass shrink-0" />
              <span className="font-display text-[14px] font-[450] text-ink">
                Option 2: Upgrade to Anthropic Smarter Models (No Daily Caps)
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              Activate Claude Opus 5 & Sonnet 5 with dedicated hosted compute starting at <strong>$2.99</strong> (Sprint Pass).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenSettings?.();
            }}
            className="shrink-0 rounded-lg bg-brass px-4 py-2 font-mono text-[11.5px] font-semibold text-night hover:bg-brasspale transition-colors shadow-md flex items-center gap-1.5"
          >
            <span>View Passes</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Bottom reset timer info */}
        <div className="flex items-center justify-between pt-2 text-[11px] font-mono text-muted border-t border-hairline">
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-brass" />
            <span>OpenRouter daily free quotas typically reset at 00:00 UTC.</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="hover:underline text-ink"
          >
            Dismiss
          </button>
        </div>
      </div>
    </Modal>
  );
}
