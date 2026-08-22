import { useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Notebook as NotebookRow } from "../lib/types";
import { applyCitationOpen, loadLayout, saveLayout, type LayoutMode } from "./layout";

/** Shared workspace glue for both shells: notebook load + rename, layout
    modes, citation plumbing, and import/drop signals. The web studio
    (Workspace) and the desktop desk surface (NotebookDesk) present this
    differently but run the exact same logic underneath. */
export function useNotebookDesk(notebookId?: string) {
  const [notebook, setNotebook] = useState<NotebookRow | null>(null);
  const [sourcesVersion, setSourcesVersion] = useState(0);
  const [layout, setLayoutState] = useState<LayoutMode>(loadLayout);
  const [importTick, setImportTick] = useState(0);
  const [dropping, setDropping] = useState(0);
  const [dropFiles, setDropFiles] = useState<FileList | null>(null);
  const [pendingView, setPendingView] = useState<{
    sourceId: string;
    startChar?: number;
  } | null>(null);

  const setLayout = (mode: LayoutMode) => {
    setLayoutState(mode);
    saveLayout(mode);
  };

  /** Citation jumps always need the sources spine visible. */
  const openSource = (sourceId: string, startChar?: number) => {
    if (!notebookId) return;
    setPendingView({ sourceId, startChar });
    setLayout(applyCitationOpen(layout));
  };

  const rename = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !notebook || !notebookId || notebook.id !== notebookId) return;
    await db.notebooks.update(notebookId, { name: trimmed });
    setNotebook({ ...notebook, name: trimmed });
  };

  useEffect(() => {
    if (!notebookId) {
      setNotebook(null);
      return;
    }
    db.notebooks.get(notebookId).then((nb) => {
      if (nb) setNotebook(nb);
      else window.location.href = "/studio";
    });
  }, [notebookId]);

  return {
    notebook,
    sourcesVersion,
    bumpSources: () => setSourcesVersion((v) => v + 1),
    layout,
    setLayout,
    importTick,
    requestImport: () => setImportTick((n) => n + 1),
    dropping,
    setDropping,
    dropFiles,
    setDropFiles,
    pendingView,
    openSource,
    clearPendingView: () => setPendingView(null),
    rename,
  };
}
