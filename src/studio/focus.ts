const key = (notebookId: string) => `comtus-focus:${notebookId}`;

/** null = every source. */
export function loadFocus(notebookId: string): string[] | null {
  try {
    const raw = localStorage.getItem(key(notebookId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

export function saveFocus(notebookId: string, ids: string[] | null): void {
  if (!ids) localStorage.removeItem(key(notebookId));
  else localStorage.setItem(key(notebookId), JSON.stringify(ids));
}
