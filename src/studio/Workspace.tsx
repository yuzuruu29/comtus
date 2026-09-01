import { useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Books, CaretLeft, ChatCircle, GearSix, Notebook, SidebarSimple, UserCircle } from "@phosphor-icons/react";
import type { Notebook as NotebookRow } from "../lib/types";
import { useCallSettings, useSettings } from "../lib/settings";
import { effortLabelFor, modelLabelFor } from "../lib/llm";
import { detectPlatform, isTauri } from "../lib/desktop";
import StudyGlyph from "../components/icons/StudyGlyph";
import { ByokBadge, ProBadge } from "../components/brand/BrandControls";
import { SPRING, SOFT, deskPane, useCountUp } from "./fx";
import SourcesPane from "./SourcesPane";
import ChatPane from "./ChatPane";
import StudioPane from "./StudioPane";
import SettingsModal from "./SettingsModal";
import DeskShell from "./DeskShell";
import CaptionButtons from "./Titlebar";
import { useNotebookDesk } from "./useNotebookDesk";
import { panesFor } from "./layout";
import { usePaneResize } from "./usePaneResize";
import { db } from "../lib/db";
import { LampPulse, Modal, btnGhost } from "./ui";
import MilestonesButton from "./companion/MilestonesButton";
import ConsoleShell from "./ConsoleShell";

type MobilePane = "sources" | "chat" | "studio";

const DEFAULT_SOURCES_W = 270;
const DEFAULT_STUDIO_W = 290;
const RAIL_W = 48;
const PANE_WIDTH_VAR = "--pane-width" as const;

/** Left-to-right reading order of the mobile panes; a swap between two of
    them slides the incoming pane in from the direction it sits toward. */
const MOBILE_PANE_ORDER: Record<MobilePane, number> = { sources: 0, chat: 1, studio: 2 };

export default function Workspace({ notebookId }: { notebookId: string }) {
  const cs = useCallSettings();
  const desk = useNotebookDesk(notebookId);
  const setLayout = desk.setLayout;
  const openNotebookSource = desk.openSource;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  const panes = panesFor(desk.layout);

  const collapseSources = useCallback(
    () => setLayout(panes.studio ? "writing" : "focus"),
    [panes.studio, setLayout],
  );
  const collapseStudio = useCallback(
    () => setLayout(panes.sources ? "reading" : "focus"),
    [panes.sources, setLayout],
  );

  const sourcesResize = usePaneResize({
    side: "left",
    storageKey: "comtus_sources_width",
    cssVariable: PANE_WIDTH_VAR,
    controlsId: "workspace-sources-content",
    label: "Resize sources sidebar",
    minWidth: 180,
    maxWidth: 550,
    defaultWidth: DEFAULT_SOURCES_W,
    collapseThreshold: 140,
    onCollapse: collapseSources,
  });
  const studioResize = usePaneResize({
    side: "right",
    storageKey: "comtus_studio_width",
    cssVariable: PANE_WIDTH_VAR,
    controlsId: "workspace-studio-content",
    label: "Resize studio sidebar",
    minWidth: 200,
    maxWidth: 550,
    defaultWidth: DEFAULT_STUDIO_W,
    collapseThreshold: 150,
    onCollapse: collapseStudio,
  });

  const openSource = useCallback(
    (sourceId: string, startChar?: number) => {
      openNotebookSource(sourceId, startChar);
      setMobilePane("sources");
    },
    [openNotebookSource],
  );

  const modelLabel = modelLabelFor(cs.provider, cs.model);
  const effortLabel = effortLabelFor(cs.effort);

  const isDropping = desk.dropping > 0;
  // Direction of the last mobile pane swap, read before the effect advances
  // the ref — the entering pane slides in from the side it sits toward.
  const lastPaneRef = useRef<MobilePane>(mobilePane);
  useEffect(() => {
    lastPaneRef.current = mobilePane;
  }, [mobilePane]);
  const paneDelta = MOBILE_PANE_ORDER[mobilePane] - MOBILE_PANE_ORDER[lastPaneRef.current];
  const paneSlideClass = paneDelta > 0 ? "anim-slide-r" : paneDelta < 0 ? "anim-slide-l" : undefined;
  const paneWrapperClass = `flex min-h-0 flex-1 flex-col${paneSlideClass ? ` ${paneSlideClass}` : ""}`;

  const toggleSources = useCallback(() => {
    setLayout(panes.sources ? (panes.studio ? "writing" : "focus") : (panes.studio ? "standard" : "reading"));
  }, [panes.sources, panes.studio, setLayout]);

  const toggleStudio = useCallback(() => {
    setLayout(panes.studio ? (panes.sources ? "reading" : "focus") : (panes.sources ? "standard" : "writing"));
  }, [panes.sources, panes.studio, setLayout]);

  return (
    <DeskShell
      layout={desk.layout}
      onLayout={desk.setLayout}
      onSettings={() => setSettingsOpen(true)}
      onImport={desk.requestImport}
    >
      <ConsoleShell
        notebookName={desk.notebook?.name || "Course Notebook"}
        modelLabel={modelLabel}
      >
        <div
          className="relative flex h-full flex-col overflow-hidden bg-ground text-ink"
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
        <AnimatePresence>
          {desk.loadState === "loading" && (
            <motion.div
              key="workspace-loading"
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="absolute inset-0 z-[70] flex items-center justify-center bg-ground/90"
            >
              <LampPulse label="Opening notebook…" />
            </motion.div>
          )}
        </AnimatePresence>
        {desk.loadState === "error" && (
          <div role="alert" className="absolute inset-0 z-[70] flex items-center justify-center bg-ground/95 px-6 text-center">
            <div className="anim-rise max-w-sm rounded-[var(--radius-dialog)] border border-rust/30 bg-surface p-6 shadow-modal">
              <h1 className="font-display text-heading text-ink">This notebook did not open.</h1>
              <p className="mt-2 text-body text-muted">{desk.loadError}</p>
              <div className="mt-5 flex justify-center gap-2">
                <button
                  onClick={desk.retryLoad}
                  className="rounded-[var(--radius-control)] border border-brass/40 px-4 py-2 text-[12px] text-brasspale"
                >
                  Retry
                </button>
                <Link
                  to="/studio"
                  className="rounded-[var(--radius-control)] border border-hairline px-4 py-2 text-[12px] text-muted hover:text-ink"
                >
                  Notebook shelf
                </Link>
              </div>
            </div>
          </div>
        )}
        {/* Kept mounted: the drop veil fades on a data-attribute flip so the
            overlay never remounts mid-drag (dragenter/leave pairs flicker). */}
        <div
          data-dropping={isDropping ? "true" : undefined}
          className="pointer-events-none absolute inset-0 z-[50] flex items-center justify-center bg-ground/70 text-[15px] text-ink opacity-0 transition-opacity duration-fast ease-house data-[dropping]:opacity-100"
        >
          <div
            data-dropping={isDropping ? "true" : undefined}
            className={`rounded-[var(--radius-control)] px-6 py-3 scale-[0.98] transition-transform duration-fast ease-house data-[dropping]:scale-100 ${isDropping ? "ring-breathe" : ""}`}
          >
            Drop onto this notebook
          </div>
        </div>
        <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[42vh] bg-[radial-gradient(55%_90%_at_50%_0%,rgba(227,176,75,0.13),transparent_68%),radial-gradient(40%_70%_at_88%_8%,rgba(127,168,201,0.10),transparent_62%)]" />

        <WorkspaceHeader
          notebook={desk.notebook}
          modelLabel={modelLabel}
          effortLabel={effortLabel}
          panes={panes}
          onToggleSources={toggleSources}
          onToggleStudio={toggleStudio}
          onRename={(name) => void desk.rename(name)}
          onSettings={() => setSettingsOpen(true)}
        />

        <div className="relative z-10 hidden min-h-0 flex-1 lg:flex">
          {/* Left Sidebar: Sources (Retractable & Resizable) */}
          <aside
            ref={sourcesResize.paneRef}
            id="workspace-sources-pane"
            data-resizing={sourcesResize.isDragging ? "true" : undefined}
            style={{
              [PANE_WIDTH_VAR]: `${panes.sources ? sourcesResize.width : RAIL_W}px`,
              width: `var(${PANE_WIDTH_VAR})`,
            } as CSSProperties}
            className="relative shrink-0 overflow-visible border-r desk-split transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-[resizing=true]:transition-none motion-reduce:transition-none will-change-[width] [backface-visibility:hidden]"
          >
            {panes.sources ? (
              <div id="workspace-sources-content" className={`${deskPane} flex flex-col anim-fade anim-fade--fast`}>
                <SourcesPane
                  notebookId={notebookId}
                  version={desk.sourcesVersion}
                  onCollapse={() => desk.setLayout(panes.studio ? "writing" : "focus")}
                  onChanged={desk.bumpSources}
                  pendingView={desk.pendingView}
                  onPendingConsumed={desk.clearPendingView}
                  importTick={desk.importTick}
                  onImportTriggered={desk.consumeImport}
                  dropFiles={desk.dropFiles}
                  onDropConsumed={() => desk.setDropFiles(null)}
                />
              </div>
            ) : (
              <div className="anim-fade flex h-full flex-col items-center pt-3" style={{ ["--d"]: "60ms" } as CSSProperties}>
                <RailButton icon={Notebook} label="Sources" side="left" onClick={() => desk.setLayout(panes.studio ? "standard" : "reading")} />
              </div>
            )}

            {/* Pull / Stretch Resizer Handle for Left Sidebar */}
            {panes.sources && (
              <div
                {...sourcesResize.separatorProps}
                title="Drag to resize · Arrow keys adjust · Double-click resets"
                className="group absolute right-0 top-0 bottom-0 z-30 -mr-1.5 flex w-3 cursor-col-resize select-none items-center justify-center transition-colors hover:opacity-100 focus-visible:bg-brass/[0.06] focus-visible:outline-none"
              >
                <div className="h-8 w-1 rounded-full bg-hairline/80 shadow-sm transition-all duration-200 group-hover:h-14 group-hover:w-1.5 group-hover:bg-brass group-active:h-20 group-active:bg-brass group-focus-visible:h-14 group-focus-visible:w-1.5 group-focus-visible:bg-brass group-focus-visible:shadow-[0_0_14px_rgba(227,176,75,0.42)] group-data-[collapse-ready=true]:h-20 group-data-[collapse-ready=true]:w-1.5 group-data-[collapse-ready=true]:bg-brass" />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-brass/30 bg-raised px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-brasspale opacity-0 shadow-modal transition-opacity group-data-[collapse-ready=true]:opacity-100">
                  Release to collapse
                </span>
              </div>
            )}
          </aside>

          <main className="min-w-0 flex-1">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SOFT} className={`${deskPane} overflow-hidden`}>
              <ChatPane
                notebook={desk.notebook}
                sourcesVersion={desk.sourcesVersion}
                onNavigateSources={openSource}
                modelLabel={modelLabel}
                onOpenSettings={() => setSettingsOpen(true)}
                onAddSources={() => {
                  if (window.matchMedia("(min-width: 1024px)").matches) {
                    desk.setLayout(panes.studio ? "standard" : "reading");
                  } else {
                    setMobilePane("sources");
                  }
                }}
              />
            </motion.div>
          </main>

          {/* Right Sidebar: Studio (Retractable & Resizable) */}
          <aside
            ref={studioResize.paneRef}
            id="workspace-studio-pane"
            data-resizing={studioResize.isDragging ? "true" : undefined}
            style={{
              [PANE_WIDTH_VAR]: `${panes.studio ? studioResize.width : RAIL_W}px`,
              width: `var(${PANE_WIDTH_VAR})`,
            } as CSSProperties}
            className="relative shrink-0 overflow-visible border-l desk-split transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-[resizing=true]:transition-none motion-reduce:transition-none will-change-[width] [backface-visibility:hidden]"
          >
            {panes.studio ? (
              <div id="workspace-studio-content" className={`${deskPane} flex flex-col anim-fade anim-fade--fast`}>
                <StudioPane
                  notebookId={notebookId}
                  onCollapse={() => desk.setLayout(panes.sources ? "reading" : "focus")}
                />
              </div>
            ) : (
              <div className="anim-fade flex h-full flex-col items-center pt-3" style={{ ["--d"]: "60ms" } as CSSProperties}>
                <RailButton icon={Books} label="Studio" side="right" onClick={() => desk.setLayout(panes.sources ? "standard" : "writing")} />
              </div>
            )}

            {/* Pull / Stretch Resizer Handle for Right Sidebar */}
            {panes.studio && (
              <div
                {...studioResize.separatorProps}
                title="Drag to resize · Arrow keys adjust · Double-click resets"
                className="group absolute left-0 top-0 bottom-0 z-30 -ml-1.5 flex w-3 cursor-col-resize select-none items-center justify-center transition-colors hover:opacity-100 focus-visible:bg-brass/[0.06] focus-visible:outline-none"
              >
                <div className="h-8 w-1 rounded-full bg-hairline/80 shadow-sm transition-all duration-200 group-hover:h-14 group-hover:w-1.5 group-hover:bg-brass group-active:h-20 group-active:bg-brass group-focus-visible:h-14 group-focus-visible:w-1.5 group-focus-visible:bg-brass group-focus-visible:shadow-[0_0_14px_rgba(227,176,75,0.42)] group-data-[collapse-ready=true]:h-20 group-data-[collapse-ready=true]:w-1.5 group-data-[collapse-ready=true]:bg-brass" />
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-brass/30 bg-raised px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-brasspale opacity-0 shadow-modal transition-opacity group-data-[collapse-ready=true]:opacity-100">
                  Release to collapse
                </span>
              </div>
            )}
          </aside>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:hidden">
          {/* Flex column, not block: the panes size themselves with flex-1,
              which is ignored under a plain block parent — the studio and
              sources panes silently lost all scrolling on mobile. */}
          <div className="flex min-h-0 flex-1 flex-col">
            {mobilePane === "sources" && (
              <div key={mobilePane} className={paneWrapperClass}>
                <SourcesPane
                  notebookId={notebookId}
                  version={desk.sourcesVersion}
                  onChanged={desk.bumpSources}
                  pendingView={desk.pendingView}
                  onPendingConsumed={desk.clearPendingView}
                  importTick={desk.importTick}
                  onImportTriggered={desk.consumeImport}
                  dropFiles={desk.dropFiles}
                  onDropConsumed={() => desk.setDropFiles(null)}
                />
              </div>
            )}
            {mobilePane === "chat" && (
              <div key={mobilePane} className={paneWrapperClass}>
                <ChatPane
                  notebook={desk.notebook}
                  sourcesVersion={desk.sourcesVersion}
                  onNavigateSources={openSource}
                  modelLabel={modelLabel}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onAddSources={() => setMobilePane("sources")}
                />
              </div>
            )}
            {mobilePane === "studio" && (
              <div key={mobilePane} className={paneWrapperClass}>
                <StudioPane notebookId={notebookId} />
              </div>
            )}
          </div>
          <nav
            id="mobile-bottom-nav"
            className="flex h-[calc(4.25rem+var(--sab))] shrink-0 items-center justify-around border-t border-hairline bg-ground/95 px-3 pb-[var(--sab)] pt-1"
          >
            {(
              [
                ["sources", Notebook, "Sources"],
                ["chat", ChatCircle, "Chat"],
                ["studio", Books, "Studio"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setMobilePane(id)}
                aria-pressed={mobilePane === id}
                className={`relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] px-3 py-1.5 text-[10.5px] font-medium tracking-[0.08em] transition-colors duration-200 active:scale-95 ${
                  mobilePane === id ? "text-brasspale" : "text-muted"
                }`}
              >
                {mobilePane === id && (
                  <motion.span
                    layoutId="mobile-tab-pill"
                    transition={SPRING}
                    className="absolute inset-0 rounded-[var(--radius-control)] bg-brass/[0.08]"
                  />
                )}
                <Icon size={20} weight={mobilePane === id ? "fill" : "light"} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </ConsoleShell>
    </DeskShell>
  );
}

function WorkspaceHeader({
  notebook,
  modelLabel,
  effortLabel,
  panes,
  onToggleSources,
  onToggleStudio,
  onRename,
  onSettings,
}: {
  notebook: NotebookRow | null;
  modelLabel: string;
  effortLabel: string;
  panes: { sources: boolean; studio: boolean };
  onToggleSources: () => void;
  onToggleStudio: () => void;
  onRename: (name: string) => void;
  onSettings: () => void;
}) {
  const platform = detectPlatform();
  const tauri = isTauri();
  const macPad = tauri && platform === "mac";
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
        data-tauri-drag-region={tauri ? true : undefined}
        className={`desk-header relative z-[40] flex h-[calc(var(--desk-header)+var(--sat))] shrink-0 items-center gap-2 border-b border-hairline bg-ground px-2 pt-[var(--sat)] sm:gap-3 sm:px-3 ${macPad ? "pl-[78px]" : ""}`}
      >
        <Link
          to="/studio"
          className="no-drag flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink"
          aria-label="All notebooks"
        >
          <CaretLeft size={18} weight="light" />
        </Link>

        {/* Retract / Expand Left Sidebar Button */}
        <button
          onClick={onToggleSources}
          title={panes.sources ? "Retract Sources Sidebar" : "Expand Sources Sidebar"}
          aria-label="Toggle sources sidebar"
          aria-pressed={panes.sources}
          className={`no-drag hidden h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-all sm:flex ${
            panes.sources
              ? "text-brass bg-brass/10 hover:bg-brass/20"
              : "text-muted hover:bg-ink/5 hover:text-ink"
          }`}
        >
          <SidebarSimple size={16} weight={panes.sources ? "fill" : "light"} />
        </button>

        <StudyGlyph name={notebook?.name} size="sm" />
        <input
          defaultValue={notebook?.name}
          key={notebook?.name}
          onBlur={(e) => onRename(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="no-drag min-w-0 max-w-[42vw] flex-none truncate rounded-[var(--radius-control)] border border-transparent bg-transparent px-1.5 py-1 font-display text-[15px] font-[450] outline-none hover:border-hairline focus:border-brass/40 sm:max-w-xs sm:text-[16px]"
          aria-label="Notebook name"
        />
        <div className="no-drag ml-auto flex items-center gap-1.5">
          <div className="hidden sm:inline-flex">
            <MilestonesButton />
          </div>
          {notebook && (
            <>
              <button
                onClick={() => void openAnalytics()}
                className="hidden items-center gap-1 rounded-[var(--radius-control)] px-2.5 py-1.5 text-[12px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
              >
                Analytics
              </button>
              <button
                onClick={() => void handleShare()}
                className="hidden items-center gap-1 rounded-[var(--radius-control)] px-2.5 py-1.5 text-[12px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
              >
                Share
              </button>
            </>
          )}
          <button
            onClick={onSettings}
            className="hidden items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-[12px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
          >
            {modelLabel} · {effortLabel}
          </button>
          <button
            onClick={onSettings}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink"
            aria-label="Settings"
          >
            <GearSix size={17} weight="light" />
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

          {/* Retract / Expand Right Sidebar (Studio) Button */}
          <button
            onClick={onToggleStudio}
            title={panes.studio ? "Retract Studio Sidebar" : "Expand Studio Sidebar"}
            aria-label="Toggle studio sidebar"
            aria-pressed={panes.studio}
            className={`no-drag hidden h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-all sm:flex ${
              panes.studio
                ? "text-brass bg-brass/10 hover:bg-brass/20"
                : "text-muted hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <SidebarSimple size={16} weight={panes.studio ? "fill" : "light"} className="scale-x-[-1]" />
          </button>

          {/* Account & Settings */}
          <button
            onClick={onSettings}
            className="flex h-8 w-8 items-center justify-center rounded-full text-brass transition-all hover:bg-brass/10 hover:text-brasspale active:scale-95"
            title="Account & Settings"
            aria-label="Account and settings"
          >
            <UserCircle size={21} weight="light" />
          </button>
        </div>
        <CaptionButtons />
      </header>

      {/* Analytics Modal */}
      {notebook && (
        <Modal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} title="Notebook Analytics">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <AnalyticsTile index={0} label="Sources" target={stats?.sources ?? 0} format={(v) => `${v}`} />
              <AnalyticsTile
                index={1}
                label="Tokens Grounded"
                target={stats?.tokens ?? 0}
                format={(v) => `${(v / 1000).toFixed(1)}k`}
              />
              <AnalyticsTile index={2} label="Saved Artifacts" target={stats?.gens ?? 0} format={(v) => `${v}`} />
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

function RailButton({
  icon: Icon,
  label,
  side,
  onClick,
}: {
  icon: ComponentType<{ size?: number; weight?: "light" }>;
  label: string;
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-brasspale"
        aria-label={`Show ${label}`}
      >
        <Icon size={16} weight="light" />
      </button>
      <span
        className={`pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-[11px] text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
          side === "left" ? "left-full ml-2" : "right-full mr-2"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function AnalyticsTile({
  label,
  target,
  format,
  index,
}: {
  label: string;
  target: number;
  format: (value: number) => string;
  index: number;
}) {
  const counted = useCountUp(target);
  return (
    <div
      className="anim-rise rounded-xl border border-hairline bg-surface/70 p-3"
      style={{ ["--d"]: `${Math.min(index, 10) * 30}ms` } as CSSProperties}
    >
      <div className="font-mono text-[18px] font-semibold text-brasspale">{format(counted)}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mt-1">{label}</div>
    </div>
  );
}
