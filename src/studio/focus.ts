const key = (notebookId: string) => `comtus-focus:${notebookId}`;

export const FOCUS_CHANGED_EVENT = "comtus:focus-changed";

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
  try {
    if (!ids) localStorage.removeItem(key(notebookId));
    else localStorage.setItem(key(notebookId), JSON.stringify(ids));
  } catch {
    /* storage quota / private mode */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(FOCUS_CHANGED_EVENT, { detail: { notebookId, ids } }),
    );
  }
}

/** Prunes any deleted source IDs from stored focus. */
export function pruneFocus(notebookId: string, validIds: Iterable<string>): string[] | null {
  const current = loadFocus(notebookId);
  if (current === null) return null;

  const validSet = new Set(validIds);
  const pruned = current.filter((id) => validSet.has(id));

  if (pruned.length !== current.length) {
    saveFocus(notebookId, pruned);
    return pruned;
  }
  return current;
}

/** Listens for focus changes within and across tabs for a notebook. */
export function subscribeFocus(
  notebookId: string,
  onChange: (ids: string[] | null) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleCustom = (e: Event) => {
    const custom = e as CustomEvent<{ notebookId: string; ids: string[] | null }>;
    if (custom.detail?.notebookId === notebookId) {
      onChange(custom.detail.ids);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === key(notebookId)) {
      onChange(loadFocus(notebookId));
    }
  };

  window.addEventListener(FOCUS_CHANGED_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(FOCUS_CHANGED_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}
