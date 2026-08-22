import { AnimatePresence, motion } from "motion/react";
import { ArrowCircleDown, CheckCircle, Warning } from "@phosphor-icons/react";
import { SPRING } from "./fx";
import { useUpdater } from "./useUpdater";

/** Update prompts for the Desk App — silent checks surface here. */
export default function UpdateToast() {
  const { state, pendingVersion, install, reset } = useUpdater();

  const visible =
    state.phase === "available" ||
    state.phase === "downloading" ||
    state.phase === "installing" ||
    (state.phase === "up-to-date") ||
    state.phase === "error";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12, transition: { duration: 0.15 } }}
          transition={SPRING}
          className="fixed bottom-5 right-5 z-[90] w-[min(21rem,calc(100vw-2.5rem))]"
        >
          <div className="overflow-hidden rounded-[var(--radius-field)] border border-hairline bg-surface/95 shadow-[0_18px_60px_-18px_rgba(0,0,0,0.75)]">
            {state.phase === "available" && (
              <div className="p-4">
                <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                  <ArrowCircleDown size={17} weight="light" className="text-brass" />
                  Comtus {pendingVersion ?? "a new version"} is ready
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                  Download and restart to update the Desk App. Your notebooks stay put.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => void install()}
                    className="rounded-[var(--radius-control)] bg-brass px-3 py-1.5 text-[12.5px] font-medium text-night transition hover:bg-brasspale"
                  >
                    Update &amp; restart
                  </button>
                  <button
                    onClick={reset}
                    className="rounded-[var(--radius-control)] px-3 py-1.5 text-[12.5px] text-muted transition hover:text-ink"
                  >
                    Later
                  </button>
                </div>
              </div>
            )}
            {state.phase === "downloading" && (
              <div className="p-4">
                <div className="text-[13px] font-medium text-ink">Downloading update…</div>
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-brass transition-[width] duration-300"
                    style={{ width: state.progress >= 0 ? `${Math.round(state.progress * 100)}%` : "40%" }}
                  />
                </div>
              </div>
            )}
            {state.phase === "installing" && (
              <div className="p-4 text-[13px] text-ink">Restarting to finish the update…</div>
            )}
            {state.phase === "up-to-date" && (
              <button onClick={reset} className="flex w-full items-center gap-2 p-4 text-left">
                <CheckCircle size={16} weight="light" className="shrink-0 text-sage" />
                <span className="text-[13px] text-ink">Comtus is up to date.</span>
              </button>
            )}
            {state.phase === "error" && (
              <button onClick={reset} className="flex w-full items-start gap-2 p-4 text-left">
                <Warning size={16} weight="light" className="mt-0.5 shrink-0 text-rust" />
                <span>
                  <span className="block text-[13px] text-ink">Update check failed.</span>
                  <span className="mt-0.5 block break-words text-[11.5px] leading-relaxed text-muted">
                    {state.message}
                  </span>
                </span>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
