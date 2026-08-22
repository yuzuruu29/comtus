import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, useParams } from "react-router-dom";
import { Flame, GearSix, MagnifyingGlass } from "@phosphor-icons/react";
import { createNotebook, db } from "../lib/db";
import type { Notebook as NotebookRow } from "../lib/types";
import { useCallSettings, useSettings } from "../lib/settings";
import { MODELS } from "../lib/llm";
import { detectPlatform, isTauri } from "../lib/desktop";
import DeskShell from "../studio/DeskShell";
import SettingsModal from "../studio/SettingsModal";
import CaptionButtons from "../studio/Titlebar";
import { LampPulse } from "../studio/ui";
import { HOUSE } from "../studio/fx";
import { useDesk } from "../studio/DeskContext";
import { useNotebookDesk } from "../studio/useNotebookDesk";
import { modLabel } from "../studio/shortcuts";
import LibraryRail from "./LibraryRail";
import DeskHome from "./DeskHome";
import NotebookDesk from "./NotebookDesk";

/** Comtus for desktop — a standalone product surface. The library is a
    persistent rail, never a page; the desk at rest is a working home;
    one app-wide chrome strip carries the window. Shares product logic
    with the web studio underneath (db, llm, panes, generators). */
export default function DeskApp() {
  const { notebookId } = useParams();
  const navigate = useNavigate();
  const tauri = isTauri();

  const desk = useNotebookDesk(notebookId);
  const cs = useCallSettings();
  const hasKey = useSettings((s) => s.hasKey());

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [importSignal, setImportSignal] = useState(0);
  const [resume, setResume] = useState<NotebookRow | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Resume pointer: remember the last notebook opened on this device.
  useEffect(() => {
    if (!notebookId) return;
    try {
      localStorage.setItem("comtus:lastNotebook", notebookId);
    } catch {
      /* private mode */
    }
  }, [notebookId]);

  useEffect(() => {
    if (notebookId) {
      setResume(null);
      return;
    }
    const last = (() => {
      try {
        return localStorage.getItem("comtus:lastNotebook");
      } catch {
        return null;
      }
    })();
    if (!last) {
      setResume(null);
      return;
    }
    void db.notebooks.get(last).then((nb) => setResume(nb ?? null));
  }, [notebookId]);

  // Freshly created notebooks land ready to rename.
  useEffect(() => {
    if (freshId && freshId === notebookId) {
      const t = window.setTimeout(() => nameRef.current?.select(), 60);
      return () => window.clearTimeout(t);
    }
  }, [freshId, notebookId]);

  const newNotebook = useCallback(async () => {
    const nb = await createNotebook("Untitled");
    setFreshId(nb.id);
    navigate(`/studio/${nb.id}`, { flushSync: true });
  }, [navigate]);

  // File ▸ Import / palette "Add sources": always lands somewhere useful.
  const requestImport = useCallback(async () => {
    if (!notebookId) await newNotebook();
    setImportSignal((n) => n + 1);
  }, [notebookId, newNotebook]);

  const openNotebook = useCallback(
    (id: string) => navigate(`/studio/${id}`, { flushSync: true }),
    [navigate],
  );

  const modelLabel =
    cs.provider === "anthropic"
      ? (MODELS.find((m) => m.id === cs.model)?.label ?? cs.model)
      : (cs.model.split("/").pop() ?? cs.model).slice(0, 16);
  const effortLabel =
    cs.effort === "medium" ? "Steady" : cs.effort === "high" ? "Deep" : "Exhaustive";

  return (
    <DeskShell
      layout={desk.layout}
      onLayout={desk.setLayout}
      onSettings={() => setSettingsOpen(true)}
      onNewNotebook={() => void newNotebook()}
      onImport={() => void requestImport()}
    >
      <div
        className="relative flex h-[100svh] flex-col overflow-hidden bg-ground text-ink"
        onDragEnter={(e) => {
          e.preventDefault();
          desk.setDropping((n) => n + 1);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => desk.setDropping((n) => Math.max(0, n - 1))}
        onDrop={(e) => {
          e.preventDefault();
          desk.setDropping(0);
          if (e.dataTransfer.files.length) desk.setDropFiles(e.dataTransfer.files);
        }}
      >
        {desk.dropping > 0 && (
          <div className="pointer-events-none absolute inset-0 z-[50] flex items-center justify-center bg-ground/70 text-[15px] text-ink">
            Drop onto this notebook
          </div>
        )}

        {/* App chrome — the single window strip */}
        <AppHeader
          tauriDrag={tauri}
          notebook={desk.notebook}
          nameRef={nameRef}
          onRename={(name) => void desk.rename(name)}
          modelLabel={modelLabel}
          effortLabel={effortLabel}
          onSettings={() => setSettingsOpen(true)}
        />

        {/* Rail + surface */}
        <div className="relative z-10 flex min-h-0 flex-1">
          <LibraryRail
            activeId={notebookId ?? null}
            onSelect={openNotebook}
            onNew={() => void newNotebook()}
            onDeleted={(id) => {
              if (id === notebookId) navigate("/studio");
            }}
          />
          <AnimatePresence mode="wait">
            {notebookId ? (
              <motion.div
                key={notebookId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: HOUSE }}
                className="flex min-h-0 flex-1"
              >
                {desk.notebook ? (
                  <NotebookDesk
                    notebookId={notebookId}
                    notebook={desk.notebook}
                    sourcesVersion={desk.sourcesVersion}
                    bumpSources={desk.bumpSources}
                    layout={desk.layout}
                    setLayout={desk.setLayout}
                    importSignal={importSignal}
                    dropFiles={desk.dropFiles}
                    clearDropFiles={() => desk.setDropFiles(null)}
                    pendingView={desk.pendingView}
                    openSource={desk.openSource}
                    clearPendingView={desk.clearPendingView}
                  />
                ) : (
                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    <LampPulse />
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: HOUSE }}
                className="flex min-h-0 flex-1"
              >
                <DeskHome
                  hasKey={hasKey}
                  resume={resume}
                  onOpenResume={openNotebook}
                  onNew={() => void newNotebook()}
                  onImport={() => void requestImport()}
                  onSettings={() => setSettingsOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </DeskShell>
  );
}

/** The window strip. Rendered inside DeskShell so it can reach the desk
    actions (palette) through context. */
function AppHeader({
  tauriDrag,
  notebook,
  nameRef,
  onRename,
  modelLabel,
  effortLabel,
  onSettings,
}: {
  tauriDrag: boolean;
  notebook: NotebookRow | null;
  nameRef: RefObject<HTMLInputElement | null>;
  onRename: (name: string) => void;
  modelLabel: string;
  effortLabel: string;
  onSettings: () => void;
}) {
  const desk = useDesk();
  const platform = detectPlatform();

  return (
    <header
      data-tauri-drag-region={tauriDrag ? true : undefined}
      className="desk-header relative z-[40] flex h-[calc(var(--desk-header)+var(--sat))] shrink-0 items-center gap-3 border-b border-hairline bg-ground px-3 pt-[var(--sat)]"
    >
      <div className="flex shrink-0 select-none items-center gap-2">
        <Flame size={14} weight="light" className="text-brass" />
        <span className="font-display text-[12px] font-[480] tracking-[0.24em] text-ink">
          COMTUS
        </span>
      </div>
      {notebook && (
        <>
          <span className="h-4 w-px shrink-0 bg-white/[0.09]" />
          <input
            ref={nameRef}
            key={notebook.name}
            defaultValue={notebook.name}
            onBlur={(e) => onRename(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="no-drag w-[min(34ch,34vw)] truncate rounded-[var(--radius-control)] border border-transparent bg-transparent px-1.5 py-0.5 font-display text-[14px] font-[450] outline-none hover:border-hairline focus:border-brass/40"
            aria-label="Notebook name"
          />
        </>
      )}
      <div className="no-drag ml-auto flex shrink-0 items-center gap-1 pr-1">
        <button
          onClick={onSettings}
          className="hidden items-center rounded-[var(--radius-control)] px-2.5 py-1.5 text-[11.5px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
        >
          {modelLabel} · {effortLabel}
        </button>
        <button
          onClick={desk.openPalette}
          className="hidden items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1.5 font-mono text-[10.5px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
          aria-label="Command palette"
        >
          <MagnifyingGlass size={13} weight="light" />
          {modLabel(platform)}K
        </button>
        <button
          onClick={onSettings}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink"
          aria-label="Settings"
        >
          <GearSix size={16} weight="light" />
        </button>
      </div>
      <CaptionButtons />
    </header>
  );
}
