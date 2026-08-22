/** Session naming — pure string logic, shared by the Dexie v2 migration
 *  and the live auto-title in ChatPane. Kept free of db imports so the
 *  upgrade hook can use it without a module cycle. */

export const DEFAULT_SESSION_TITLE = "Main chat";
const MAX_TITLE = 48;

/** First user question of a session, collapsed to a short label.
 *  Empty input yields "" (caller decides the placeholder). */
export function deriveSessionTitle(raw: string): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= MAX_TITLE) return clean;
  const cut = clean.slice(0, MAX_TITLE);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace > MAX_TITLE * 0.55 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}…`;
}
