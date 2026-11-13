import { useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { motion } from "motion/react";
import { Books, Notebook } from "@phosphor-icons/react";
import type { Notebook as NotebookRow } from "../lib/types";
import { ENTER, SOFT, deskPane } from "../studio/fx";
import SourcesPane from "../studio/SourcesPane";
import type { AddSourceKind } from "../studio/AddSourceMenu";
import ChatPane from "../studio/ChatPane";
import StudioPane from "../studio/StudioPane";
import { panesFor, type LayoutMode } from "../studio/layout";
import { usePaneResize } from "../studio/usePaneResize";
import { useMediaQuery } from "../lib/useMediaQuery";
import { ICON } from "../ui/iconScale";

const SOURCES_W = 260;
const STUDIO_W = 280;
const RAIL_W = 48;
const PANE_WIDTH_VAR = "--pane-width" as const;

/** The notebook surface of the desk: sources · chat · studio under the
    app-wide chrome. Desktop-only — no mobile tabs, no back-to-shelf link;
    the library rail owns navigation. Panes resize exactly like the web
    workspace, and share its saved widths. */
export default function NotebookDesk({
  notebookId,
  notebook,
  sourcesVersion,
  bumpSources,
  layout,
  setLayout,
  importRequestId,
  onImportConsumed,
  dropRequest,
  onDropConsumed,
  pendingView,
  openSource,
  clearPendingView,
  pendingGenerationId,
  pendingChatId,
  onChatConsumed,
  onGenerationConsumed,
  chatQuote,
  onAsk,
  onQuoteConsumed,
  modelLabel,
  onOpenSettings,
}: {
  notebookId: string;
  notebook: NotebookRow | null;
  sourcesVersion: number;
  bumpSources: () => void;
  layout: LayoutMode;
  setLayout: (mode: LayoutMode) => void;
  /** Notebook-targeted, one-shot shell request. */
  importRequestId: number | null;
  onImportConsumed: (requestId: number) => void;
  dropRequest: { id: number; files: FileList } | null;
  onDropConsumed: (requestId: number) => void;
  pendingView: { sourceId: string; startChar?: number } | null;
  openSource: (sourceId: string, startChar?: number) => void;
  clearPendingView: () => void;
  pendingGenerationId?: string | null;
  pendingChatId?: string | null;
  onChatConsumed?: () => void;
  onGenerationConsumed?: () => void;
  /** A passage from the reader on its way to the chat composer. */
  chatQuote?: { text: string; nonce: number } | null;
  onAsk?: (prompt: string) => void;
  onQuoteConsumed?: () => void;
  modelLabel?: string;
  onOpenSettings?: () => void;
}) {
  const compact = useMediaQuery("(max-width: 1199px)");
  // On compact windows keep Chat usable by showing at most one companion
  // pane. Standard favors Sources; Studio remains one click away.
  const panes = panesFor(layout, compact);

  const [addSourceRequest, setAddSourceRequest] = useState(0);
  const [addSourceKind, setAddSourceKind] = useState<AddSourceKind | undefined>(undefined);
  const consumeAddSource = useCallback(() => {
    setAddSourceRequest(0);
    setAddSourceKind(undefined);
  }, []);
  const onAddSources = useCallback((kind?: AddSourceKind) => {
    if (!panes.sources) setLayout(compact ? "reading" : panes.studio ? "standard" : "reading");
    setAddSourceKind(kind);
    setAddSourceRequest((request) => request + 1);
  }, [compact, panes.sources, panes.studio, setLayout]);

  const sourcesResize = usePaneResize({
    side: "left",
    storageKey: "comtus_sources_width",
    cssVariable: PANE_WIDTH_VAR,
    controlsId: "desk-sources-content",
    label: "Resize sources sidebar",
    minWidth: 180,
    maxWidth: 550,
    defaultWidth: SOURCES_W,
    collapseThreshold: 140,
    onCollapse: () => setLayout(panes.studio ? "writing" : "focus"),
  });
  const studioResize = usePaneResize({
    side: "right",
    storageKey: "comtus_studio_width",
    cssVariable: PANE_WIDTH_VAR,
    controlsId: "desk-studio-content",
    label: "Resize studio sidebar",
    minWidth: 200,
    maxWidth: 550,
    defaultWidth: STUDIO_W,
    collapseThreshold: 150,
    onCollapse: () => setLayout(panes.sources ? "reading" : "focus"),
  });

  // Translate desk-level import requests into pane ticks. The seen-ref
  // keeps a stale signal from re-firing when switching between notebooks.
  const [importTick, setImportTick] = useState(0);
  const seenSignal = useRef<number | null>(null);
  useEffect(() => {
    if (importRequestId !== null && importRequestId !== seenSignal.current) {
      seenSignal.current = importRequestId;
      setImportTick((t) => t + 1);
      onImportConsumed(importRequestId);
    }
  }, [importRequestId, onImportConsumed]);

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        ref={sourcesResize.paneRef}
        aria-label="Sources"
        data-resizing={sourcesResize.isDragging ? "true" : undefined}
        style={{
          [PANE_WIDTH_VAR]: `${panes.sources ? sourcesResize.width : RAIL_W}px`,
          width: `var(${PANE_WIDTH_VAR})`,
        } as CSSProperties}
        className="relative shrink-0 overflow-hidden border-r desk-split transition-[width] duration-slow ease-[var(--ease-out)] data-[resizing=true]:transition-none motion-reduce:transition-none will-change-[width] [backface-visibility:hidden]"
      >
        {panes.sources ? (
          <div id="desk-sources-content" className={`${deskPane} flex flex-col`}>
            <SourcesPane
              notebookId={notebookId}
              version={sourcesVersion}
              onCollapse={() => setLayout(panes.studio ? "writing" : "focus")}
              onChanged={bumpSources}
              pendingView={pendingView}
              onPendingConsumed={clearPendingView}
              importTick={importTick}
              onImportTriggered={() => setImportTick(0)}
              dropFiles={dropRequest?.files ?? null}
              dropRequestId={dropRequest?.id}
              onDropConsumed={() => {
                if (dropRequest) onDropConsumed(dropRequest.id);
              }}
              addRequest={addSourceRequest}
              addKind={addSourceKind}
              onAddRequestConsumed={consumeAddSource}
              onAsk={onAsk}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center pt-3">
            <RailButton
              icon={Notebook}
              label="Sources"
              onClick={() => setLayout(compact ? "reading" : panes.studio ? "standard" : "reading")}
            />
          </div>
        )}
        {panes.sources && (
          <div
            {...sourcesResize.separatorProps}
            title="Drag to resize. Arrow keys adjust. Double-click resets."
            className="group absolute right-0 top-0 bottom-0 z-30 -mr-1.5 flex w-3 cursor-col-resize select-none items-center justify-center transition-colors hover:opacity-100 focus-visible:bg-brass/[0.06] focus-visible:outline-none"
          >
            <div className="h-8 w-1 rounded-[var(--radius-pill)] bg-hairline/80 shadow-sm transition-all duration-med group-hover:h-14 group-hover:w-1.5 group-hover:bg-brass group-active:h-20 group-active:bg-brass group-focus-visible:h-14 group-focus-visible:w-1.5 group-focus-visible:bg-brass group-focus-visible:shadow-[0_0_14px_rgba(227,176,75,0.42)] group-data-[collapse-ready=true]:h-20 group-data-[collapse-ready=true]:w-1.5 group-data-[collapse-ready=true]:bg-brass" />
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1">
        <motion.div
          key="chat"
          initial={ENTER.initial}
          animate={ENTER.animate}
          transition={SOFT}
          className={`${deskPane} overflow-hidden`}
        >
          <ChatPane
            notebook={notebook}
            sourcesVersion={sourcesVersion}
            onNavigateSources={openSource}
            modelLabel={modelLabel}
            onOpenSettings={onOpenSettings}
            onAddSources={onAddSources}
            pendingSessionId={pendingChatId}
            onPendingSessionConsumed={onChatConsumed}
            quoteRequest={chatQuote}
            onQuoteConsumed={onQuoteConsumed}
          />
        </motion.div>
      </main>

      <aside
        ref={studioResize.paneRef}
        aria-label="Studio"
        data-resizing={studioResize.isDragging ? "true" : undefined}
        style={{
          [PANE_WIDTH_VAR]: `${panes.studio ? studioResize.width : RAIL_W}px`,
          width: `var(${PANE_WIDTH_VAR})`,
        } as CSSProperties}
        className="relative shrink-0 overflow-hidden border-l desk-split transition-[width] duration-slow ease-[var(--ease-out)] data-[resizing=true]:transition-none motion-reduce:transition-none will-change-[width] [backface-visibility:hidden]"
      >
        {panes.studio ? (
          <div id="desk-studio-content" className={`${deskPane} flex flex-col`}>
            <StudioPane
              notebookId={notebookId}
              onCollapse={() => setLayout(panes.sources ? "reading" : "focus")}
              pendingGenerationId={pendingGenerationId}
              onPendingGenerationConsumed={onGenerationConsumed}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center pt-3">
            <RailButton
              icon={Books}
              label="Studio"
              onClick={() => setLayout(compact ? "writing" : panes.sources ? "standard" : "writing")}
            />
          </div>
        )}
        {panes.studio && (
          <div
            {...studioResize.separatorProps}
            title="Drag to resize. Arrow keys adjust. Double-click resets."
            className="group absolute left-0 top-0 bottom-0 z-30 -ml-1.5 flex w-3 cursor-col-resize select-none items-center justify-center transition-colors hover:opacity-100 focus-visible:bg-brass/[0.06] focus-visible:outline-none"
          >
            <div className="h-8 w-1 rounded-[var(--radius-pill)] bg-hairline/80 shadow-sm transition-all duration-med group-hover:h-14 group-hover:w-1.5 group-hover:bg-brass group-active:h-20 group-active:bg-brass group-focus-visible:h-14 group-focus-visible:w-1.5 group-focus-visible:bg-brass group-focus-visible:shadow-[0_0_14px_rgba(227,176,75,0.42)] group-data-[collapse-ready=true]:h-20 group-data-[collapse-ready=true]:w-1.5 group-data-[collapse-ready=true]:bg-brass" />
          </div>
        )}
      </aside>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ size?: number; weight?: "light" }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-brass"
        aria-label={`Show ${label}`}
      >
        <Icon size={ICON.md} weight="light" />
      </button>
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-label text-ink opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}
