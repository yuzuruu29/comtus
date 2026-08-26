const RELOAD_KEY = "comtus:chunk-reload-at";
const RELOAD_TTL_MS = 30_000;

/** Chunk-load failures caused by a deploy landing mid-session: the open tab
 *  still holds old hashed filenames the server no longer has. Matches the
 *  phrasing used by Chromium, Firefox, and WebKit respectively. */
export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("dynamically imported module") ||
    msg.includes("Importing a module script failed")
  );
}

/** Runs a lazy import; if the chunk vanished under an open tab (a deploy
 *  happened while the app was open), reloads once so the session picks up
 *  the new build instead of surfacing a raw import error. A TTL guard keeps
 *  a genuinely broken deploy from reload-looping — the second failure within
 *  the window rethrows to the caller's error handling. */
export async function loadChunk<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (!isStaleChunkError(err) || typeof window === "undefined") throw err;
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    } catch {
      // Storage unavailable (private mode, hardened browsers) — still reload.
    }
    if (Date.now() - last > RELOAD_TTL_MS) {
      try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {
        // Ignore — the reload itself matters more than the guard.
      }
      window.location.reload();
      // Hold the caller (and React) until the navigation lands.
      return new Promise<T>(() => {});
    }
    throw err;
  }
}
