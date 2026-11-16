import { AnimatePresence, motion } from "motion/react";
import { ArrowCircleDown, CheckCircle, Warning } from "@phosphor-icons/react";
import { ENTER, EXIT, SOFT } from "./fx";
import { useUpdater } from "./useUpdater";
import { ICON } from "../ui/iconScale";

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
          role={state.phase === "error" ? "alert" : "status"}
          aria-live={state.phase === "error" ? "assertive" : "polite"}
          initial={ENTER.initial}
          animate={ENTER.animate}
          exit={{ ...ENTER.exit, transition: EXIT }}
          transition={SOFT}
          className="fixed bottom-5 right-5 z-[90] w-[min(21rem,calc(100vw-2.5rem))]"
        >
          <div className="overflow-hidden rounded-[var(--radius-field)] border border-hairline bg-surface/95 shadow-[0_18px_60px_-18px_rgba(0,0,0,0.75)]">
            {state.phase === "available" && (
              <div className="p-4">
                <div className="flex items-center gap-2 text-body font-medium text-ink">
                  <ArrowCircleDown size={ICON.lg} weight="light" className="text-brass" />
                  Comtus {pendingVersion ?? "a new version"} is ready
                </div>
                <p className="mt-1.5 text-small leading-relaxed text-muted">
                  Download and restart to update the Desk App. Your notebooks stay put.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => void install()}
                    className="rounded-[var(--radius-control)] bg-brass px-3 py-1.5 text-small font-medium text-ground transition hover:bg-brass-deep"
                  >
                    Update &amp; restart
                  </button>
                  <button
                    onClick={reset}
                    className="rounded-[var(--radius-control)] px-3 py-1.5 text-small text-muted transition hover:text-ink"
                  >
                    Later
                  </button>
                </div>
              </div>
            )}
            {state.phase === "downloading" && (
              <div className="p-4">
                <div className="text-small font-medium text-ink">Downloading update…</div>
                <div className="mt-2.5 h-1 overflow-hidden rounded-[var(--radius-pill)] bg-ink/[0.08]">
                  <div
                    role="progressbar"
                    aria-label="Update download"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={state.progress >= 0 ? Math.round(state.progress * 100) : undefined}
                    className="h-full rounded-[var(--radius-pill)] bg-brass transition-[width] duration-slow"
                    style={{ width: state.progress >= 0 ? `${Math.round(state.progress * 100)}%` : "40%" }}
                  />
                </div>
              </div>
            )}
            {state.phase === "installing" && (
              <div className="p-4 text-small text-ink">Restarting to finish the update…</div>
            )}
            {state.phase === "up-to-date" && (
              <button onClick={reset} className="flex w-full items-center gap-2 p-4 text-left">
                <CheckCircle size={ICON.md} weight="light" className="shrink-0 text-sage" />
                <span className="text-small text-ink">Comtus is up to date.</span>
              </button>
            )}
            {state.phase === "error" && (
              <button onClick={reset} className="flex w-full items-start gap-2 p-4 text-left">
                <Warning size={ICON.md} weight="light" className="mt-0.5 shrink-0 text-rust" />
                <span>
                  <span className="block text-small text-ink">Update check failed.</span>
                  <span className="mt-0.5 block break-words text-label leading-relaxed text-muted">
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
