import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "../lib/desktop";

export type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "up-to-date" }
  | { phase: "available" }
  | { phase: "downloading"; progress: number }
  | { phase: "installing" }
  | { phase: "error"; message: string };

type UpdaterEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished"; data: Record<string, never> };

type UpdateAsset = {
  version: string;
  body?: string;
  downloadAndInstall?: (onEvent?: (e: UpdaterEvent) => void) => Promise<void>;
};

const CHECK_EVENT = "comtus-check-updates";

/** Ask the app-wide updater to run a visible check (File menu, Settings). */
export function requestUpdateCheck() {
  window.dispatchEvent(new Event(CHECK_EVENT));
}

/**
 * Desktop auto-update flow (Tauri only). Checks /desktop/latest.json
 * (endpoint declared in tauri.conf.json); install() downloads with
 * progress and relaunches to apply. Mount once — UpdateToast owns it.
 */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const pending = useRef<UpdateAsset | null>(null);

  const check = useCallback(async (manual: boolean) => {
    if (!isTauri()) return;
    setState({ phase: "checking" });
    try {
      const { check: checkForUpdate } = await import("@tauri-apps/plugin-updater");
      const update = await checkForUpdate();
      if (!update) {
        pending.current = null;
        // A silent launch-time check stays quiet when already current.
        setState(manual ? { phase: "up-to-date" } : { phase: "idle" });
        return;
      }
      pending.current = update as unknown as UpdateAsset;
      setState({ phase: "available" });
    } catch (err) {
      if (!manual) {
        setState({ phase: "idle" });
        return;
      }
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const install = useCallback(async () => {
    const update = pending.current;
    if (!update?.downloadAndInstall) return;
    try {
      let downloaded = 0;
      let contentLength: number | undefined;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setState({
            phase: "downloading",
            progress: contentLength ? Math.min(1, downloaded / contentLength) : -1,
          });
        } else if (event.event === "Finished") {
          setState({ phase: "installing" });
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  useEffect(() => {
    if (!isTauri()) return;

    // Silent check shortly after launch.
    const t = window.setTimeout(() => void check(false), 4000);

    // Manual requests from the File menu / Settings.
    const onManual = () => void check(true);
    window.addEventListener(CHECK_EVENT, onManual);

    // Native menu item emits a Tauri event of the same id.
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen("check-updates", onManual).then((fn) => {
        unlisten = fn;
      }),
    );

    return () => {
      window.clearTimeout(t);
      window.removeEventListener(CHECK_EVENT, onManual);
      unlisten?.();
    };
  }, [check]);

  return { state, pendingVersion: pending.current?.version, install, reset };
}
