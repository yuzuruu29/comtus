import { useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Books, CaretLeft, ChatCircle, Flame, GearSix, MagnifyingGlass, Notebook } from "@phosphor-icons/react";
import type { Notebook as NotebookRow } from "../lib/types";
import { useCallSettings } from "../lib/settings";
import { MODELS } from "../lib/llm";
import { detectPlatform, isTauri } from "../lib/desktop";
import { SPRING, SOFT, deskPane } from "./fx";
import SourcesPane from "./SourcesPane";
import ChatPane from "./ChatPane";
import StudioPane from "./StudioPane";
import SettingsModal from "./SettingsModal";
import DeskShell from "./DeskShell";
import CaptionButtons from "./Titlebar";
import { useDesk } from "./DeskContext";
import { useNotebookDesk } from "./useNotebookDesk";
import { panesFor } from "./layout";
import { modLabel } from "./shortcuts";
import { LampPulse } from "./ui";

type MobilePane = "sources" | "chat" | "studio";

const SOURCES_W = 260;
const STUDIO_W = 280;
const RAIL_W = 48;

export default function Workspace({ notebookId }: { notebookId: string }) {
  const cs = useCallSettings();
  const desk = useNotebookDesk(notebookId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");

  const openSource = (sourceId: string, startChar?: number) => {
    desk.openSource(sourceId, startChar);
    setMobilePane("sources");
  };

  const modelLabel =
    cs.provider === "anthropic"
      ? (MODELS.find((m) => m.id === cs.model)?.label ?? cs.model)
      : (cs.model.split("/").pop() ?? cs.model).slice(0, 16);
  const effortLabel =
    cs.effort === "medium" ? "Steady" : cs.effort === "high" ? "Deep" : "Exhaustive";

  const panes = panesFor(desk.layout);

  return (
    <DeskShell
      layout={desk.layout}
      onLayout={desk.setLayout}
      onSettings={() => setSettingsOpen(true)}
      onImport={desk.requestImport}
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
        {desk.loadState === "loading" && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-ground/90">
            <LampPulse label="Opening notebook…" />
          </div>
        )}
        {desk.loadState === "error" && (
          <div role="alert" className="absolute inset-0 z-[70] flex items-center justify-center bg-ground/95 px-6 text-center">
            <div className="max-w-sm rounded-[var(--radius-dialog)] border border-rust/30 bg-surface p-6 shadow-modal">
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
        {desk.dropping > 0 && (
          <div className="pointer-events-none absolute inset-0 z-[50] flex items-center justify-center bg-ground/70 text-[15px] text-ink">
            Drop onto this notebook
          </div>
        )}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[38vh] bg-[radial-gradient(50%_90%_at_50%_0%,rgba(227,176,75,0.05),transparent_70%)]" />

        <WorkspaceHeader
          notebook={desk.notebook}
          modelLabel={modelLabel}
          effortLabel={effortLabel}
          onRename={(name) => void desk.rename(name)}
          onSettings={() => setSettingsOpen(true)}
        />

        <div className="relative z-10 hidden min-h-0 flex-1 lg:flex">
          <motion.aside
            initial={false}
            animate={{ width: panes.sources ? SOURCES_W : RAIL_W }}
            transition={SPRING}
            className="relative shrink-0 overflow-hidden border-r desk-split"
          >
            {panes.sources ? (
              <div className={`${deskPane} flex flex-col`}>
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
              <div className="flex h-full flex-col items-center pt-3">
                <RailButton icon={Notebook} label="Sources" side="left" onClick={() => desk.setLayout(panes.studio ? "standard" : "reading")} />
              </div>
            )}
          </motion.aside>

          <main className="min-w-0 flex-1">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SOFT} className={`${deskPane} overflow-hidden`}>
              <ChatPane notebook={desk.notebook} sourcesVersion={desk.sourcesVersion} onNavigateSources={openSource} />
            </motion.div>
          </main>

          <motion.aside
            initial={false}
            animate={{ width: panes.studio ? STUDIO_W : RAIL_W }}
            transition={SPRING}
            className="relative shrink-0 overflow-hidden border-l desk-split"
          >
            {panes.studio ? (
              <div className={`${deskPane} flex flex-col`}>
                <StudioPane
                  notebookId={notebookId}
                  onCollapse={() => desk.setLayout(panes.sources ? "reading" : "focus")}
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center pt-3">
                <RailButton icon={Books} label="Studio" side="right" onClick={() => desk.setLayout(panes.sources ? "standard" : "writing")} />
              </div>
            )}
          </motion.aside>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:hidden">
          <div className="min-h-0 flex-1">
            {mobilePane === "sources" && (
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
            )}
            {mobilePane === "chat" && (
              <ChatPane notebook={desk.notebook} sourcesVersion={desk.sourcesVersion} onNavigateSources={openSource} />
            )}
            {mobilePane === "studio" && <StudioPane notebookId={notebookId} />}
          </div>
          <nav className="flex h-[calc(4.25rem+var(--sab))] shrink-0 items-center justify-around border-t border-hairline bg-ground/95 px-3 pb-[var(--sab)] pt-1">
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
                <Icon size={20} weight="light" className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </DeskShell>
  );
}

function WorkspaceHeader({
  notebook,
  modelLabel,
  effortLabel,
  onRename,
  onSettings,
}: {
  notebook: NotebookRow | null;
  modelLabel: string;
  effortLabel: string;
  onRename: (name: string) => void;
  onSettings: () => void;
}) {
  const desk = useDesk();
  const platform = detectPlatform();
  const tauri = isTauri();
  const macPad = tauri && platform === "mac";

  return (
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
      <Flame size={15} weight="light" className="shrink-0 text-brass" />
      <input
        defaultValue={notebook?.name}
        key={notebook?.name}
        onBlur={(e) => onRename(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="no-drag min-w-0 max-w-[42vw] flex-none truncate rounded-[var(--radius-control)] border border-transparent bg-transparent px-1.5 py-1 font-display text-[15px] font-[450] outline-none hover:border-hairline focus:border-brass/40 sm:max-w-xs sm:text-[16px]"
        aria-label="Notebook name"
      />
      <div className="no-drag ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={desk.openPalette}
          className="hidden items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1.5 font-mono text-[10.5px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
          aria-label="Command palette"
        >
          <MagnifyingGlass size={14} weight="light" />
          {modLabel(platform)}K
        </button>
        <button
          onClick={onSettings}
          className="hidden items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-[12px] text-muted hover:bg-ink/5 hover:text-ink sm:flex"
        >
          {modelLabel} · {effortLabel}
        </button>
        <button
          onClick={onSettings}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink"
          aria-label="Settings"
        >
          <GearSix size={17} weight="light" />
        </button>
      </div>
      <CaptionButtons />
    </header>
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
        className={`pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-[11px] text-ink opacity-0 transition-opacity group-hover:opacity-100 ${
          side === "left" ? "left-full ml-2" : "right-full mr-2"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
