import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/db";
import type { Notebook as NotebookRow } from "../lib/types";
import { applyCitationOpen, loadLayout, saveLayout, type LayoutMode } from "./layout";

/** Shared workspace glue for both shells: notebook load + rename, layout
    modes, citation plumbing, and import/drop signals. The web studio
    (Workspace) and the desktop desk surface (NotebookDesk) present this
    differently but run the exact same logic underneath. */
export function useNotebookDesk(notebookId?: string) {
  const navigate = useNavigate();
  const [notebook, setNotebook] = useState<NotebookRow | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    notebookId ? "loading" : "idle",
  );
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [sourcesVersion, setSourcesVersion] = useState(0);
  const [layout, setLayoutState] = useState<LayoutMode>(loadLayout);
  const [importTick, setImportTick] = useState(0);
  const [dropping, setDropping] = useState(0);
  const [dropFiles, setDropFiles] = useState<FileList | null>(null);
  const [pendingView, setPendingView] = useState<{
    sourceId: string;
    startChar?: number;
  } | null>(null);

  const setLayout = useCallback((mode: LayoutMode) => {
    setLayoutState(mode);
    saveLayout(mode);
  }, []);

  /** Citation jumps always need the sources spine visible. */
  const openSource = useCallback((sourceId: string, startChar?: number) => {
    if (!notebookId) return;
    setPendingView({ sourceId, startChar });
    setLayout(applyCitationOpen(layout));
  }, [layout, notebookId, setLayout]);

  const rename = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !notebook || !notebookId || notebook.id !== notebookId) return;
    const renamedId = notebookId;
    await db.notebooks.update(renamedId, { name: trimmed });
    setNotebook((current) =>
      current?.id === renamedId ? { ...current, name: trimmed } : current,
    );
  };

  useEffect(() => {
    let current = true;
    setNotebook(null);
    setLoadError("");
    setSourcesVersion(0);
    setDropping(0);
    setDropFiles(null);
    setPendingView(null);
    if (!notebookId) {
      setLoadState("idle");
      return () => {
        current = false;
      };
    }
    setLoadState("loading");
    void db.notebooks
      .get(notebookId)
      .then((nb) => {
        if (!current) return;
        if (nb) {
          setNotebook(nb);
          setLoadState("ready");
        } else {
          navigate("/studio", { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (!current) return;
        setLoadError(error instanceof Error ? error.message : "The notebook could not be opened.");
        setLoadState("error");
      });
    return () => {
      current = false;
    };
  }, [loadAttempt, navigate, notebookId]);

  const bumpSources = useCallback(() => setSourcesVersion((value) => value + 1), []);
  const requestImport = useCallback(() => setImportTick((value) => value + 1), []);
  const consumeImport = useCallback(() => setImportTick(0), []);
  const clearPendingView = useCallback(() => setPendingView(null), []);
  const retryLoad = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);

  return {
    notebook,
    loadState,
    loadError,
    retryLoad,
    sourcesVersion,
    bumpSources,
    layout,
    setLayout,
    importTick,
    requestImport,
    consumeImport,
    dropping,
    setDropping,
    dropFiles,
    setDropFiles,
    pendingView,
    openSource,
    clearPendingView,
    rename,
  };
}
