import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Books, CaretLeft, ChatCircle, Flame, GearSix, MagnifyingGlass, Notebook } from "@phosphor-icons/react";
import { db } from "../lib/db";
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
import {
  applyCitationOpen,
  loadLayout,
  panesFor,
  saveLayout,
  type LayoutMode,
} from "./layout";
import { modLabel } from "./shortcuts";

type MobilePane = "sources" | "chat" | "studio";

const SOURCES_W = 260;
const STUDIO_W = 280;
const RAIL_W = 48;

export default function Workspace({ notebookId }: { notebookId: string }) {
  const cs = useCallSettings();
  const [notebook, setNotebook] = useState<NotebookRow | null>(null);
  const [sourcesVersion, setSourcesVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layout, setLayoutState] = useState<LayoutMode>(loadLayout);
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
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

  const openSource = (sourceId: string, startChar?: number) => {
    setPendingView({ sourceId, startChar });
    setLayout(applyCitationOpen(layout));
    setMobilePane("sources");
  };

  useEffect(() => {
    db.notebooks.get(notebookId).then((nb) => {
      if (nb) setNotebook(nb);
      else window.location.href = "/studio";
    });
  }, [notebookId]);

  const rename = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !notebook) return;
    await db.notebooks.update(notebookId, { name: trimmed });
    setNotebook({ ...notebook, name: trimmed });
  };

  const modelLabel =
    cs.provider === "anthropic"
      ? (MODELS.find((m) => m.id === cs.model)?.label ?? cs.model)
      : (cs.model.split("/").pop() ?? cs.model).slice(0, 16);
  const effortLabel =
    cs.effort === "medium" ? "Steady" : cs.effort === "high" ? "Deep" : "Exhaustive";

  const panes = panesFor(layout);
  const desktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  return (
    <DeskShell
      layout={layout}
      onLayout={setLayout}
      onSettings={() => setSettingsOpen(true)}
      onImport={() => setImportTick((n) => n + 1)}
    >
      <div
        className="relative flex h-[100svh] flex-col overflow-hidden bg-night text-parchment"
        onDragEnter={(e) => {
          e.preventDefault();
          setDropping((n) => n + 1);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDropping((n) => Math.max(0, n - 1))}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(0);
          if (e.dataTransfer.files.length) setDropFiles(e.dataTransfer.files);
        }}
      >
        {dropping > 0 && (
          <div className="pointer-events-none absolute inset-0 z-[50] flex items-center justify-center bg-night/70 text-[15px] text-parchment">
            Drop onto this notebook
          </div>
        )}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[38vh] bg-[radial-gradient(50%_90%_at_50%_0%,rgba(227,176,75,0.05),transparent_70%)]" />

        <WorkspaceHeader
          notebook={notebook}
          modelLabel={modelLabel}
          effortLabel={effortLabel}
          onRename={rename}
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
                  version={sourcesVersion}
                  onCollapse={() => setLayout(desktop && panes.studio ? "writing" : "focus")}
                  onChanged={() => setSourcesVersion((v) => v + 1)}
                  pendingView={pendingView}
                  onPendingConsumed={() => setPendingView(null)}
                  importTick={importTick}
                  dropFiles={dropFiles}
                  onDropConsumed={() => setDropFiles(null)}
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center pt-3">
                <RailButton icon={Notebook} label="Sources" side="left" onClick={() => setLayout(panes.studio ? "standard" : "reading")} />
              </div>
            )}
          </motion.aside>

          <main className="min-w-0 flex-1">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SOFT} className={`${deskPane} overflow-hidden`}>
              <ChatPane notebook={notebook} sourcesVersion={sourcesVersion} onNavigateSources={openSource} />
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
                  onCollapse={() => setLayout(panes.sources ? "reading" : "focus")}
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center pt-3">
                <RailButton icon={Books} label="Studio" side="right" onClick={() => setLayout(panes.sources ? "standard" : "writing")} />
              </div>
            )}
          </motion.aside>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:hidden">
          <div className="min-h-0 flex-1">
            {mobilePane === "sources" && (
              <SourcesPane
                notebookId={notebookId}
                version={sourcesVersion}
                onChanged={() => setSourcesVersion((v) => v + 1)}
                pendingView={pendingView}
                onPendingConsumed={() => setPendingView(null)}
                importTick={importTick}
                dropFiles={dropFiles}
                onDropConsumed={() => setDropFiles(null)}
              />
            )}
            {mobilePane === "chat" && (
              <ChatPane notebook={notebook} sourcesVersion={sourcesVersion} onNavigateSources={openSource} />
            )}
            {mobilePane === "studio" && <StudioPane notebookId={notebookId} />}
          </div>
          <nav className="flex h-[calc(4.25rem+var(--sab))] shrink-0 items-center justify-around border-t border-white/[0.06] bg-night/95 px-3 pb-[var(--sab)] pt-1">
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
                  mobilePane === id ? "text-brasspale" : "text-faded"
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
      className={`desk-header relative z-[40] flex h-[calc(var(--desk-header)+var(--sat))] shrink-0 items-center gap-2 border-b border-white/[0.07] bg-night px-2 pt-[var(--sat)] sm:gap-3 sm:px-3 ${macPad ? "pl-[78px]" : ""}`}
    >
      <Link
        to="/studio"
        className="no-drag flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-faded hover:bg-white/5 hover:text-parchment"
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
        className="no-drag min-w-0 max-w-[42vw] flex-none truncate rounded-[var(--radius-control)] border border-transparent bg-transparent px-1.5 py-1 font-display text-[15px] font-[450] outline-none hover:border-white/10 focus:border-brass/40 sm:max-w-xs sm:text-[16px]"
        aria-label="Notebook name"
      />
      <div className="no-drag ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={desk.openPalette}
          className="hidden items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1.5 font-mono text-[10.5px] text-faded hover:bg-white/[0.05] hover:text-parchment sm:flex"
          aria-label="Command palette"
        >
          <MagnifyingGlass size={14} weight="light" />
          {modLabel(platform)}K
        </button>
        <button
          onClick={onSettings}
          className="hidden items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-[12px] text-faded hover:bg-white/[0.05] hover:text-parchment sm:flex"
        >
          {modelLabel} · {effortLabel}
        </button>
        <button
          onClick={onSettings}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-faded hover:bg-white/5 hover:text-parchment"
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
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-faded hover:bg-white/[0.05] hover:text-brasspale"
        aria-label={`Show ${label}`}
      >
        <Icon size={16} weight="light" />
      </button>
      <span
        className={`pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] border border-white/10 bg-study px-2 py-1 text-[11px] text-parchment opacity-0 transition-opacity group-hover:opacity-100 ${
          side === "left" ? "left-full ml-2" : "right-full mr-2"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
