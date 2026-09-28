/** Tiny event bus for desk life — no React, no Dexie. db.ts can notify
 *  without importing the companion UI. */

export const DESK_ACTIVITY = "comtus:desk-activity";

export function notifyDeskActivity(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DESK_ACTIVITY));
}

export const WORK_SAVED = "comtus:work-saved";

/** Saved work in a notebook changed somewhere other than the studio pane
 *  (a note from chat or the reader, a deck from quiz misses), so the
 *  studio's list re-reads. */
export function notifyWorkSaved(notebookId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(WORK_SAVED, { detail: notebookId }));
}
