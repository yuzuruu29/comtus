import { useEffect, useRef, useState, type ComponentType } from "react";
import { motion } from "motion/react";
import { Books, Notebook } from "@phosphor-icons/react";
import type { Notebook as NotebookRow } from "../lib/types";
import { SPRING, SOFT, deskPane } from "../studio/fx";
import SourcesPane from "../studio/SourcesPane";
import ChatPane from "../studio/ChatPane";
import StudioPane from "../studio/StudioPane";
import { panesFor, type LayoutMode } from "../studio/layout";

const SOURCES_W = 260;
const STUDIO_W = 280;
const RAIL_W = 48;

/** The notebook surface of the desk: sources · chat · studio under the
    app-wide chrome. Desktop-only — no mobile tabs, no back-to-shelf link;
    the library rail owns navigation. */
export default function NotebookDesk({
  notebookId,
  notebook,
  sourcesVersion,
  bumpSources,
  layout,
  setLayout,
  importSignal,
  dropFiles,
  clearDropFiles,
  pendingView,
  openSource,
  clearPendingView,
}: {
  notebookId: string;
  notebook: NotebookRow | null;
  sourcesVersion: number;
  bumpSources: () => void;
  layout: LayoutMode;
  setLayout: (mode: LayoutMode) => void;
  /** Monotonic counter bumped whenever a desk-level import is requested. */
  importSignal: number;
  dropFiles: FileList | null;
  clearDropFiles: () => void;
  pendingView: { sourceId: string; startChar?: number } | null;
  openSource: (sourceId: string, startChar?: number) => void;
  clearPendingView: () => void;
}) {
  const panes = panesFor(layout);

  // Translate desk-level import requests into pane ticks. The seen-ref
  // keeps a stale signal from re-firing when switching between notebooks.
  const [importTick, setImportTick] = useState(0);
  const seenSignal = useRef(0);
  useEffect(() => {
    if (importSignal > seenSignal.current) {
      seenSignal.current = importSignal;
      setImportTick((t) => t + 1);
    }
  }, [importSignal]);

  return (
    <div className="flex min-h-0 flex-1">
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
              onCollapse={() => setLayout(panes.studio ? "writing" : "focus")}
              onChanged={bumpSources}
              pendingView={pendingView}
              onPendingConsumed={clearPendingView}
              importTick={importTick}
              dropFiles={dropFiles}
              onDropConsumed={clearDropFiles}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center pt-3">
            <RailButton
              icon={Notebook}
              label="Sources"
              onClick={() => setLayout(panes.studio ? "standard" : "reading")}
            />
          </div>
        )}
      </motion.aside>

      <main className="min-w-0 flex-1">
        <motion.div
          key="chat"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SOFT}
          className={`${deskPane} overflow-hidden`}
        >
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
            <RailButton
              icon={Books}
              label="Studio"
              onClick={() => setLayout(panes.sources ? "standard" : "writing")}
            />
          </div>
        )}
      </motion.aside>
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
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-brasspale"
        aria-label={`Show ${label}`}
      >
        <Icon size={16} weight="light" />
      </button>
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-[11px] text-ink opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}
