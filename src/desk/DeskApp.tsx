import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { GearSix } from "@phosphor-icons/react";
import { createNotebook, db } from "../lib/db";
import type { Notebook as NotebookRow } from "../lib/types";
import { useCallSettings, useSettings } from "../lib/settings";
import { effortLabelFor, modelLabelFor } from "../lib/llm";
import { isTauri } from "../lib/desktop";
import ComtusLogo from "../components/brand/ComtusLogo";
import { ByokBadge, ProBadge } from "../components/brand/BrandControls";
import DeskShell from "../studio/DeskShell";
import SettingsModal from "../studio/SettingsModal";
import CaptionButtons from "../studio/Titlebar";
import { LampPulse, Modal, btnGhost } from "../studio/ui";
import { HOUSE } from "../studio/fx";
import { useNotebookDesk } from "../studio/useNotebookDesk";
import MilestonesButton from "../studio/companion/MilestonesButton";
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
  const location = useLocation();
  const tauri = isTauri();

  const desk = useNotebookDesk(notebookId);
  const cs = useCallSettings();
  const hasKey = useSettings((s) => s.hasKey());

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [importRequest, setImportRequest] = useState<{
    notebookId: string;
    id: number;
  } | null>(null);
  const [dropRequest, setDropRequest] = useState<{
    notebookId: string;
    id: number;
    files: FileList;
  } | null>(null);
  const [resume, setResume] = useState<NotebookRow | null>(null);
  const nextRequestId = useRef(0);
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
    let current = true;
    if (notebookId) {
      setResume(null);
      return () => {
        current = false;
      };
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
      return () => {
        current = false;
      };
    }
    void db.notebooks
      .get(last)
      .then((notebook) => {
        if (current) setResume(notebook ?? null);
      })
      .catch(() => {
        if (current) setResume(null);
      });
    return () => {
      current = false;
    };
  }, [notebookId]);

  // Freshly created notebooks land ready to rename.
  useEffect(() => {
    if (freshId && freshId === notebookId) {
      const t = window.setTimeout(() => nameRef.current?.select(), 60);
      return () => window.clearTimeout(t);
    }
  }, [freshId, notebookId]);

  const newNotebook = useCallback(async (): Promise<string> => {
    const nb = await createNotebook("Untitled");
    setFreshId(nb.id);
    navigate(`/studio/${nb.id}`, { flushSync: true });
    return nb.id;
  }, [navigate]);

  const goHome = useCallback(() => navigate("/studio", { flushSync: true }), [navigate]);

  // File ▸ Import / palette "Add sources": always lands somewhere useful.
  const requestImport = useCallback(async () => {
    const targetId = notebookId ?? (await newNotebook());
    desk.setLayout("reading");
    setImportRequest({ notebookId: targetId, id: ++nextRequestId.current });
  }, [desk, notebookId, newNotebook]);

  const importDrop = useCallback(
    async (files: FileList) => {
      const targetId = notebookId ?? (await newNotebook());
      desk.setLayout("reading");
      setDropRequest({ notebookId: targetId, id: ++nextRequestId.current, files });
    },
    [desk, notebookId, newNotebook],
  );

  const openNotebook = useCallback(
    (id: string) => navigate(`/studio/${id}`, { flushSync: true }),
    [navigate],
  );
  const pendingWorkId = new URLSearchParams(location.search).get("work");
  const openWork = useCallback(
    (targetNotebookId: string, generationId: string) => {
      desk.setLayout("writing");
      navigate(`/studio/${targetNotebookId}?work=${encodeURIComponent(generationId)}`, {
        flushSync: true,
      });
    },
    [desk, navigate],
  );
  const clearPendingWork = useCallback(() => {
    if (notebookId) navigate(`/studio/${notebookId}`, { replace: true });
  }, [navigate, notebookId]);

  const modelLabel = modelLabelFor(cs.provider, cs.model);
  const effortLabel = effortLabelFor(cs.effort);

  return (
    <DeskShell
      layout={desk.layout}
      onLayout={desk.setLayout}
      onSettings={() => setSettingsOpen(true)}
      onNewNotebook={() => void newNotebook()}
      onImport={() => void requestImport()}
      onHome={goHome}
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
          if (e.dataTransfer.files.length) void importDrop(e.dataTransfer.files);
        }}
      >
        {desk.dropping > 0 && (
          <div className="pointer-events-none absolute inset-0 z-[50] flex items-center justify-center bg-ground/70 text-[15px] text-ink">
            {notebookId ? "Add files to this notebook" : "Create a notebook with these files"}
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
          onHome={goHome}
          onSettings={() => setSettingsOpen(true)}
        />

        {/* Rail + surface */}
        <div className="relative z-10 flex min-h-0 flex-1">
          <LibraryRail
            activeId={notebookId ?? null}
            onHome={goHome}
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
                {desk.notebook?.id === notebookId ? (
                  <NotebookDesk
                    notebookId={notebookId}
                    notebook={desk.notebook}
                    sourcesVersion={desk.sourcesVersion}
                    bumpSources={desk.bumpSources}
                    layout={desk.layout}
                    setLayout={desk.setLayout}
                    importRequestId={
                      importRequest?.notebookId === notebookId ? importRequest.id : null
                    }
                    onImportConsumed={(requestId) =>
                      setImportRequest((request) =>
                        request?.id === requestId ? null : request,
                      )
                    }
                    dropRequest={
                      dropRequest?.notebookId === notebookId
                        ? { id: dropRequest.id, files: dropRequest.files }
                        : null
                    }
                    onDropConsumed={(requestId) =>
                      setDropRequest((request) =>
                        request?.id === requestId ? null : request,
                      )
                    }
                    pendingView={desk.pendingView}
                    openSource={desk.openSource}
                    clearPendingView={desk.clearPendingView}
                    pendingGenerationId={pendingWorkId}
                    onGenerationConsumed={clearPendingWork}
                  />
                ) : desk.loadState === "error" ? (
                  <div
                    role="alert"
                    className="flex min-h-0 flex-1 items-center justify-center px-8 text-center"
                  >
                    <div className="max-w-sm rounded-[var(--radius-dialog)] border border-rust/30 bg-surface p-6 shadow-modal">
                      <h2 className="font-display text-heading text-ink">This notebook did not open.</h2>
                      <p className="mt-2 text-body text-muted">
                        {desk.loadError || "Local storage could not be read. Your notebook remains on this device."}
                      </p>
                      <div className="mt-5 flex justify-center gap-2">
                        <button
                          onClick={desk.retryLoad}
                          className="rounded-[var(--radius-control)] border border-brass/40 px-4 py-2 text-[12px] font-medium text-brasspale hover:bg-brass/10"
                        >
                          Retry
                        </button>
                        <button
                          onClick={goHome}
                          className="rounded-[var(--radius-control)] border border-hairline px-4 py-2 text-[12px] text-muted hover:text-ink"
                        >
                          Desk home
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    <LampPulse label="Opening notebook…" />
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
                  modelLabel={modelLabel}
                  effortLabel={effortLabel}
                  onOpenResume={openNotebook}
                  onOpenWork={openWork}
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

/** The window strip matching Screenshot 2. Rendered inside DeskShell so it can reach the desk
    actions (palette) through context. */
function AppHeader({
  tauriDrag,
  notebook,
  nameRef,
  onRename,
  modelLabel,
  effortLabel,
  onHome,
  onSettings,
}: {
  tauriDrag: boolean;
  notebook: NotebookRow | null;
  nameRef: RefObject<HTMLInputElement | null>;
  onRename: (name: string) => void;
  modelLabel: string;
  effortLabel: string;
  onHome: () => void;
  onSettings: () => void;
}) {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [stats, setStats] = useState<{ sources: number; tokens: number; gens: number } | null>(null);

  const isPro = useSettings((s) => Boolean(s.isPro && s.planTier !== "free"));
  const tokenBalance = useSettings((s) => s.tokenBalance || 0);
  const tokensUsed = useSettings((s) => s.tokensUsed || 0);
  const remainingTokens = Math.max(0, tokenBalance - tokensUsed);

  const openAnalytics = async () => {
    if (!notebook) return;
    const sources = await db.sources.where("notebookId").equals(notebook.id).toArray();
    const gens = await db.generations.where("notebookId").equals(notebook.id).count();
    const tokens = sources.reduce((sum, s) => sum + s.tokens, 0);
    setStats({ sources: sources.length, tokens, gens });
    setAnalyticsOpen(true);
  };

  const handleShare = async () => {
    if (!notebook) return;
    const sources = await db.sources.where("notebookId").equals(notebook.id).toArray();
    const generations = await db.generations.where("notebookId").equals(notebook.id).toArray();
    const payload = {
      notebook,
      exportedAt: new Date().toISOString(),
      sources: sources.map((s) => ({ title: s.title, kind: s.kind, content: s.content })),
      generations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${notebook.name.replace(/[^a-z0-9_-]/gi, "_")}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header
        data-tauri-drag-region={tauriDrag ? true : undefined}
        className="desk-header relative z-[40] flex h-[calc(var(--desk-header)+var(--sat))] shrink-0 items-center gap-3 border-b border-hairline bg-ground px-3 pt-[var(--sat)]"
      >
        <button
          type="button"
          onClick={onHome}
          className="no-drag flex shrink-0 select-none items-center rounded-[var(--radius-control)] px-1.5 py-1 hover:bg-ink/5"
          aria-label="Comtus home"
        >
          <ComtusLogo variant="full" size="xs" />
        </button>
        {notebook && (
          <>
            <span className="h-4 w-px shrink-0 bg-white/[0.09]" />
            <input
              ref={nameRef}
              key={notebook.name}
              defaultValue={notebook.name}
              onBlur={(e) => onRename(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="no-drag w-[min(34ch,34vw)] truncate rounded-[var(--radius-control)] border border-transparent bg-transparent px-1.5 py-0.5 font-display text-[14.5px] font-[450] text-ink outline-none hover:border-hairline focus:border-brass/40"
              aria-label="Notebook name"
            />
          </>
        )}
        <div className="no-drag ml-auto flex shrink-0 items-center gap-1.5 pr-1">
          <MilestonesButton className="hidden sm:inline-flex" />
          {notebook && (
            <>
              <button
                onClick={() => void openAnalytics()}
                className="hidden items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-[12px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
              >
                Analytics
              </button>
              <button
                onClick={() => void handleShare()}
                className="hidden items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-[12px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
              >
                Share
              </button>
            </>
          )}

          <button
            onClick={onSettings}
            className="hidden items-center rounded-[var(--radius-control)] px-2.5 py-1.5 text-[11.5px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
          >
            {modelLabel} · {effortLabel}
          </button>
          <button
            onClick={onSettings}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink"
            aria-label="Settings"
          >
            <GearSix size={16} weight="light" />
          </button>

          {/* Plan Tier Status Badge (PRO only if Anthropic plan availed, else BYOK) */}
          {isPro ? (
            <ProBadge
              planTier="PRO"
              remainingTokens={remainingTokens}
              onClick={onSettings}
              className="hidden sm:flex"
            />
          ) : (
            <ByokBadge
              onClick={onSettings}
              className="hidden sm:flex"
            />
          )}

          {/* User Avatar Badge */}
          <button
            onClick={onSettings}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-brass/20 text-brass text-[11px] font-bold font-mono hover:brightness-110 transition-all select-none"
            title="User Profile & Model Settings"
          >
            N
          </button>
        </div>
        <CaptionButtons />
      </header>

      {/* Analytics Modal */}
      {notebook && (
        <Modal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} title="Notebook Analytics">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-hairline bg-surface/70 p-3">
                <div className="font-mono text-[18px] font-semibold text-brasspale">{stats?.sources ?? 0}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mt-1">Sources</div>
              </div>
              <div className="rounded-xl border border-hairline bg-surface/70 p-3">
                <div className="font-mono text-[18px] font-semibold text-brasspale">{((stats?.tokens ?? 0) / 1000).toFixed(1)}k</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mt-1">Tokens Grounded</div>
              </div>
              <div className="rounded-xl border border-hairline bg-surface/70 p-3">
                <div className="font-mono text-[18px] font-semibold text-brasspale">{stats?.gens ?? 0}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mt-1">Saved Artifacts</div>
              </div>
            </div>

            <div className="rounded-xl border border-hairline/80 bg-ink/[0.02] p-3 text-[12.5px] leading-relaxed text-muted">
              🔒 <strong>Local-First Storage:</strong> All documents, question history, and generated notes for <em>{notebook.name}</em> live exclusively in IndexedDB on this device.
            </div>

            <div className="flex justify-end pt-2">
              <button className={btnGhost} onClick={() => setAnalyticsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
