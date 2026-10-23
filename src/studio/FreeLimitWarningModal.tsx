import { useEffect, useState } from "react";
import { Warning, Lightning, Crown, ArrowRight, Clock } from "@phosphor-icons/react";
import { useSettings } from "../lib/settings";
import { Modal } from "./ui";
import { ICON } from "../ui/iconScale";

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

  const handleSwitchModel = () => {
    useSettings.getState().update({
      provider: "openai-compatible",
      compatBaseUrl: "https://openrouter.ai/api/v1",
      compatModel: "openrouter/free",
    });
    setOpen(false);
  };

  const handleOpenModels = () => {
    setOpen(false);
    onOpenSettings?.();
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={
        <div className="flex items-center gap-2 text-brass">
          <Warning size={ICON.xl} weight="fill" className="text-brass" />
          <span>Estimated Free Daily Limit Reached</span>
        </div>
      }
      wide
    >
      <div className="space-y-5">
        <div className="rounded-[var(--radius-dialog)] border border-brass/25 bg-brass/[0.06] p-4 text-[13px] leading-relaxed text-ink/90">
          <p className="font-medium text-brass">
            OpenRouter's free tier has an estimated daily request limit per model during peak hours.
          </p>
          <p className="mt-1.5 text-muted text-[12px]">
            Your notes, uploaded documents, and study history are <strong>100% safe</strong> on your device. Choose an option below to continue studying without delay:
          </p>
        </div>

        {/* Quick Solution 1: Switch to another working free model */}
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-brass font-medium mb-2.5 flex items-center justify-between">
            <span>Option 1: Switch to Another Working Free Model (1-Click)</span>
            <span className="text-sage text-[10px]">100% Free</span>
          </div>

          <button
            type="button"
            onClick={handleSwitchModel}
            disabled={activeModel === "openrouter/free"}
            className="w-full rounded-[var(--radius-dialog)] border border-hairline bg-ground/70 p-3 text-left hover:border-brass/50 hover:bg-brass/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="font-medium text-[12.5px] text-ink">OpenRouter free router</span>
            <p className="mt-1 text-[11px] text-muted">Let OpenRouter pick an available free model.</p>
          </button>
        </div>

        <div className="rounded-[var(--radius-dialog)] border border-hairline bg-ink/[0.02] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Lightning size={ICON.md} className="text-sage shrink-0" />
              <span className="font-medium text-[13px] text-ink">Add your own key</span>
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              Groq, OpenRouter, and other OpenAI-compatible endpoints live in AI Models. A key is required before those models answer.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenModels}
            className="shrink-0 rounded-[var(--radius-field)] border border-sage/40 bg-sage/10 px-3 py-1.5 font-mono text-[11px] text-sage font-medium hover:bg-sage/20 transition-colors"
          >
            Open AI Models
          </button>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-dialog)] border border-brass/40 bg-gradient-to-r from-brass/[0.12] via-ground/80 to-ground p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <Crown size={ICON.lg} className="text-brass shrink-0" />
              <span className="font-display text-[14px] font-[450] text-ink">
                Hosted Claude passes
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              Instant access to Claude Opus 5.5 & Sonnet 5.5 with no daily free-tier queues. Study passes start at <strong>$2.99</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenSettings?.();
            }}
            className="shrink-0 rounded-[var(--radius-field)] bg-brass px-4 py-2 font-mono text-[11.5px] font-semibold text-ground hover:bg-brass-deep transition-colors shadow-md flex items-center gap-1.5"
          >
            <span>View Passes</span>
            <ArrowRight size={ICON.sm} />
          </button>
        </div>

        {/* Bottom reset timer info */}
        <div className="flex items-center justify-between pt-2 text-[11px] font-mono text-muted border-t border-hairline">
          <span className="flex items-center gap-1.5">
            <Clock size={ICON.sm} className="text-brass" />
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
