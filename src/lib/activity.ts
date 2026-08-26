/** Tiny event bus for desk life — no React, no Dexie. db.ts can notify
 *  without importing the companion UI. */

export const DESK_ACTIVITY = "comtus:desk-activity";

export function notifyDeskActivity(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DESK_ACTIVITY));
}
