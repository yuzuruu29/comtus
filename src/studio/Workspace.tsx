import { useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { BookOpenText, Books, CaretLeft, ChartBar, ChatCircle, DeviceMobile, DotsThree, DownloadSimple, FileArrowDown, GearSix, ListChecks, Notebook, SidebarSimple } from "@phosphor-icons/react";
import type { Generation, Notebook as NotebookRow, Source } from "../lib/types";
import { useCallSettings, useSettings } from "../lib/settings";
import { modelLabelFor } from "../lib/llm";
import { detectPlatform, isTauri } from "../lib/desktop";
import { IconButton, LampSwitch, Menu } from "../ui";
import { CRISP, ENTER, EXIT, SPRING, SOFT, deskPane, useCountUp } from "./fx";
import SourcesPane from "./SourcesPane";
import SourceReader from "./SourceReader";
import ChatPane from "./ChatPane";
import StudioPane from "./StudioPane";
import SettingsModal, { type SettingsTab } from "./SettingsModal";
import DeskShell from "./DeskShell";
import CaptionButtons from "./Titlebar";
import { useNotebookDesk } from "./useNotebookDesk";
import { useMediaQuery } from "../lib/useMediaQuery";
import { panesFor } from "./layout";
import { usePaneResize } from "./usePaneResize";
import { db } from "../lib/db";
import { exportNotebook } from "../lib/backup";
import { LampPulse, Modal, btnGhost } from "./ui";
import { useDesk } from "./DeskContext";
import ConsoleShell from "./ConsoleShell";
import { SendToDeviceDialog } from "./DeviceTransfer";
import { ICON } from "../ui/iconScale";
import FocusTimer from "./FocusTimer";
import type { AddSourceKind } from "./AddSourceMenu";
import "./lamplight.css";
import PracticeDesk from "./PracticeDesk";

type MobilePane = "sources" | "chat" | "studio";

/** Understand is the full desk: sources, the reader, chat and the study tools.
 *  Chat gives the conversation the whole desk; Practice runs the study tools
 *  on it. The mode lives in the URL, so a reload or a shared link keeps it. */
type DeskMode = "understand" | "chat" | "practice";

const DESK_MODES: { id: DeskMode; label: string; icon: typeof ChatCircle }[] = [
  { id: "understand", label: "Understand", icon: BookOpenText },
  { id: "chat", label: "Chat", icon: ChatCircle },
  { id: "practice", label: "Practice", icon: ListChecks },
];

function deskModeFrom(value: string | null): DeskMode {
  return value === "chat" || value === "practice" ? value : "understand";
}

const DEFAULT_SOURCES_W = 252;
const DEFAULT_STUDIO_W = 268;
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
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("settings");
  const openSettings = useCallback((tab: SettingsTab = "settings") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = deskModeFrom(searchParams.get("mode"));
  const setMode = useCallback(
    (next: DeskMode) => {
      setSearchParams(
        (params) => {
          const nextParams = new URLSearchParams(params);
          if (next === "understand") nextParams.delete("mode");
          else nextParams.set("mode", next);
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const chatOnly = mode === "chat";
  // Practice mounts on first use, then stays: a sitting in progress survives
  // a look at the sources or a question in chat.
  const [practiceMounted, setPracticeMounted] = useState(mode === "practice");
  if (mode === "practice" && !practiceMounted) setPracticeMounted(true);
  const [practiceRequest, setPracticeRequest] = useState<{ gen: Generation } | null>(null);
  // One URL update: setSearchParams does not queue, so a separate call to
  // drop `?work=` would read the old params and undo the mode change.
  const openPractice = useCallback(
    (gen?: Generation) => {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          next.set("mode", "practice");
          next.delete("work");
          return next;
        },
        { replace: true },
      );
      if (gen) setPracticeRequest({ gen });
    },
    [setSearchParams],
  );
  const shownMobilePane: MobilePane = chatOnly ? "chat" : mobilePane;
  const panes = panesFor(desk.layout);
  const desktop = useMediaQuery("(min-width: 1024px)");
  // From 1280px an opened source docks beside the chat, so the page and the
  // answer about it share the desk. Narrower, the reader stays a dialog.
  const wide = useMediaQuery("(min-width: 1280px)");
  const [reading, setReading] = useState<{ source: Source; startChar?: number } | null>(null);
  const readerDocked = wide && reading !== null;
  // The docked reader borrows the study tools' column. The student can bring
  // the tools back for this reading without changing the saved layout.
  const [studioWhileReading, setStudioWhileReading] = useState(false);
  const studioShown = panes.studio && (!readerDocked || studioWhileReading);
  const closeReading = useCallback(() => {
    setReading(null);
    setStudioWhileReading(false);
  }, []);
  // A source deleted while it is open closes its reader.
  useEffect(() => {
    if (!reading) return;
    let cancelled = false;
    void db.sources.get(reading.source.id).then((source) => {
      if (!cancelled && !source) closeReading();
    });
    return () => {
      cancelled = true;
    };
  }, [closeReading, desk.sourcesVersion, reading]);
  const [desktopChatTarget, setDesktopChatTarget] = useState<HTMLElement | null>(null);
  const [mobileChatTarget, setMobileChatTarget] = useState<HTMLElement | null>(null);
  const [chatFocusRequest, setChatFocusRequest] = useState(0);
  const focusChat = useCallback(() => {
    if (mode === "practice") setMode("chat");
    setMobilePane("chat");
    setChatFocusRequest((request) => request + 1);
  }, [mode, setMode]);
  const [addSourceRequest, setAddSourceRequest] = useState(0);
  const [addSourceKind, setAddSourceKind] = useState<AddSourceKind | undefined>(undefined);
  const consumeAddSource = useCallback(() => setAddSourceRequest(0), []);

  // `?work=<generationId>` opens a saved item (e.g. a deck due for review)
  // in the studio pane. Only the visible StudioPane receives it: the hidden
  // desktop tree stays mounted on mobile, and its dialogs would portal out.
  const pendingWork = searchParams.get("work");
  useEffect(() => {
    if (!pendingWork) return;
    if (!desktop) setMobilePane("studio");
    else if (!panes.studio) setLayout(panes.sources ? "standard" : "writing");
    else if (readerDocked) setStudioWhileReading(true);
  }, [desktop, panes.sources, panes.studio, pendingWork, readerDocked, setLayout]);
  // Search deep links, file picks and drops land on the pane that handles
  // them on mobile.
  const pendingChat = desk.pendingChatId;
  const pendingSource = desk.pendingView;
  const pendingFiles = desk.importTick > 0 || !!desk.dropFiles;
  useEffect(() => {
    if (desktop) return;
    if (pendingSource || pendingFiles) setMobilePane("sources");
    else if (pendingChat) setMobilePane("chat");
  }, [desktop, pendingChat, pendingFiles, pendingSource]);
  // A citation, a source link or a dropped file needs the sources, which
  // only Understand shows.
  useEffect(() => {
    if ((pendingSource || pendingFiles) && mode !== "understand") setMode("understand");
  }, [mode, pendingFiles, pendingSource, setMode]);

  const clearPendingWork = useCallback(() => {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete("work");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const collapseSources = useCallback(
    () => setLayout(panes.studio ? "writing" : "focus"),
    [panes.studio, setLayout],
  );
  const collapseStudio = useCallback(
    () => (readerDocked ? setStudioWhileReading(false) : setLayout(panes.sources ? "reading" : "focus")),
    [panes.sources, readerDocked, setLayout],
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

  const askAboutPassage = desk.askInChat;
  const askInChat = useCallback(
    (prompt: string) => {
      askAboutPassage(prompt);
      focusChat();
    },
    [askAboutPassage, focusChat],
  );

  const modelLabel = modelLabelFor(cs.provider, cs.model);

  const isDropping = desk.dropping > 0;
  // Direction of the last mobile pane swap, read before the effect advances
  // the ref — the entering pane slides in from the side it sits toward.
  const lastPaneRef = useRef<MobilePane>(mobilePane);
  useEffect(() => {
    lastPaneRef.current = mobilePane;
  }, [mobilePane]);
  const paneDelta = MOBILE_PANE_ORDER[mobilePane] - MOBILE_PANE_ORDER[lastPaneRef.current];
  const paneSlideClass = paneDelta > 0 ? "anim-slide-r" : paneDelta < 0 ? "anim-slide-l" : undefined;
  const paneWrapperClass = `workspace-mobile-pane flex min-h-0 flex-1 flex-col${paneSlideClass ? ` ${paneSlideClass}` : ""}`;

  // Compad needs a lane of its own. The workspace reserves the strip at the
  // bottom of the panes so the companion never has to sit on the work, and
  // the panes read the reservation from this one variable.
  const companionOn = useSettings((s) => s.companion !== false);

  const toggleSources = useCallback(() => {
    setLayout(panes.sources ? (panes.studio ? "writing" : "focus") : (panes.studio ? "standard" : "reading"));
  }, [panes.sources, panes.studio, setLayout]);

  const toggleStudio = useCallback(() => {
    if (readerDocked && panes.studio) {
      setStudioWhileReading((shown) => !shown);
      return;
    }
    setLayout(panes.studio ? (panes.sources ? "reading" : "focus") : (panes.sources ? "standard" : "writing"));
  }, [panes.sources, panes.studio, readerDocked, setLayout]);

  /** Brings the Sources pane forward and opens one way in (or its menu). */
  const addSources = (kind?: AddSourceKind) => {
    if (mode !== "understand") setMode("understand");
    if (desktop) { if (!panes.sources) desk.setLayout(panes.studio ? "standard" : "reading"); }
    else setMobilePane("sources");
    setAddSourceKind(kind);
    setAddSourceRequest((request) => request + 1);
  };

  return (
    <DeskShell
      layout={desk.layout}
      onLayout={desk.setLayout}
      onSettings={openSettings}
      onImport={desk.requestImport}
      onFocusChat={focusChat}
    >
      <ChatPane
        notebook={desk.notebook}
        sourcesVersion={desk.sourcesVersion}
        onNavigateSources={openSource}
        modelLabel={modelLabel}
        onOpenSettings={() => openSettings("models")}
        onAddSources={addSources}
        surfaceTarget={desktop ? desktopChatTarget : shownMobilePane === "chat" ? mobileChatTarget : null}
        focusRequest={chatFocusRequest}
        pendingSessionId={desk.pendingChatId}
        onPendingSessionConsumed={desk.clearPendingChat}
        quoteRequest={desk.chatQuote}
        onQuoteConsumed={desk.clearChatQuote}
      />
      <ConsoleShell
        notebookName={desk.notebook?.name || "Course Notebook"}
      >
        <div
          className="bg-desk-surface workspace-companion-root relative flex h-full flex-col overflow-hidden text-ink"
          style={{ ["--companion-on"]: companionOn ? "1" : "0" } as CSSProperties}
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
              exit={{ opacity: 0, transition: EXIT }}
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
                  className="rounded-[var(--radius-control)] border border-brass/40 px-4 py-2 text-small text-brass"
                >
                  Retry
                </button>
                <Link
                  to="/studio"
                  className="rounded-[var(--radius-control)] border border-hairline px-4 py-2 text-small text-muted hover:text-ink"
                >
                  Notebook shelf
                </Link>
              </div>
            </div>
          </div>
        )}
        {/* Kept mounted: the drop veil fades on a data-attribute flip so the
            overlay never remounts mid-drag (dragenter/leave pairs flicker). */}
        <div data-dropping={isDropping ? "true" : undefined} className="desk-drop-veil">
          <div className="desk-drop-sheet">
            <FileArrowDown size={ICON.xxxl} weight="light" aria-hidden="true" />
            <strong>Drop onto this notebook</strong>
            <span>It joins your sources, ready to read and ask about.</span>
          </div>
        </div>

        <WorkspaceHeader
          notebook={desk.notebook}
          panes={{ sources: panes.sources, studio: studioShown }}
          mode={mode}
          onMode={setMode}
          onToggleSources={toggleSources}
          onToggleStudio={toggleStudio}
          onRename={(name) => void desk.rename(name)}
          onSettings={openSettings}
        />

        <div className="desk-mode-view relative z-10 hidden min-h-0 flex-1 lg:flex" data-mode={mode} hidden={mode === "practice"}>
          {/* Left Sidebar: Sources (Retractable & Resizable). Chat mode
              hides the side panes instead of unmounting them, so a draft
              note or a study set in progress is still there afterwards. */}
          <aside
            ref={sourcesResize.paneRef}
            id="workspace-sources-pane"
            hidden={chatOnly}
            data-resizing={sourcesResize.isDragging ? "true" : undefined}
            style={{
              [PANE_WIDTH_VAR]: `${panes.sources ? sourcesResize.width : RAIL_W}px`,
              width: `var(${PANE_WIDTH_VAR})`,
            } as CSSProperties}
            className="relative shrink-0 overflow-visible border-r desk-split transition-[width] duration-slow ease-[var(--ease-out)] data-[resizing=true]:transition-none motion-reduce:transition-none will-change-[width] [backface-visibility:hidden]"
          >
            {panes.sources ? (
              <div id="workspace-sources-content" className={`${deskPane} flex flex-col anim-fade anim-fade--fast`}>
                {/* One-shot requests go to the visible pane only. This tree
                    stays mounted (hidden) on mobile, where a second consumer
                    stacked reader dialogs and imported every drop twice. */}
                <SourcesPane
                  notebookId={notebookId}
                  version={desk.sourcesVersion}
                  onCollapse={() => desk.setLayout(panes.studio ? "writing" : "focus")}
                  onChanged={desk.bumpSources}
                  pendingView={desktop ? desk.pendingView : null}
                  onPendingConsumed={desk.clearPendingView}
                  importTick={desktop ? desk.importTick : 0}
                  onImportTriggered={desk.consumeImport}
                  dropFiles={desktop ? desk.dropFiles : null}
                  onDropConsumed={() => desk.setDropFiles(null)}
                  addRequest={desktop ? addSourceRequest : 0}
                  addKind={addSourceKind}
                  onAddRequestConsumed={consumeAddSource}
                  onAsk={askInChat}
                  onView={setReading}
                  readingId={reading?.source.id ?? null}
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
                <div className="h-8 w-1 rounded-[var(--radius-pill)] bg-hairline/80 shadow-sm transition-all duration-med group-hover:h-14 group-hover:w-1.5 group-hover:bg-brass group-active:h-20 group-active:bg-brass group-focus-visible:h-14 group-focus-visible:w-1.5 group-focus-visible:bg-brass group-focus-visible:shadow-[0_0_14px_rgba(227,176,75,0.42)] group-data-[collapse-ready=true]:h-20 group-data-[collapse-ready=true]:w-1.5 group-data-[collapse-ready=true]:bg-brass" />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-pill)] border border-brass/30 bg-raised px-2.5 py-1 text-label tracking-normal text-brass opacity-0 shadow-modal transition-opacity group-data-[collapse-ready=true]:opacity-100">
                  Release to collapse
                </span>
              </div>
            )}
          </aside>

          {readerDocked && reading && (
            <div id="workspace-reader-pane" hidden={chatOnly} className="desk-sheet-frame workspace-reader anim-fade anim-fade--fast">
              <div className="desk-sheet">
                <SourceReader
                  key={`${reading.source.id}:${reading.startChar ?? ""}`}
                  docked
                  source={reading.source}
                  startChar={reading.startChar}
                  onClose={closeReading}
                  onAsk={askInChat}
                  onHighlightsChanged={desk.bumpSources}
                />
              </div>
            </div>
          )}

          <main id="workspace-chat-pane" className="desk-sheet-frame min-w-0 flex-1">
            <motion.div ref={setDesktopChatTarget} initial={ENTER.initial} animate={ENTER.animate} transition={SOFT} className="desk-sheet" />
          </main>

          {/* Right Sidebar: Studio (Retractable & Resizable) */}
          <aside
            ref={studioResize.paneRef}
            id="workspace-studio-pane"
            hidden={chatOnly}
            data-resizing={studioResize.isDragging ? "true" : undefined}
            style={{
              [PANE_WIDTH_VAR]: `${studioShown ? studioResize.width : RAIL_W}px`,
              width: `var(${PANE_WIDTH_VAR})`,
            } as CSSProperties}
            className="relative shrink-0 overflow-visible border-l desk-split transition-[width] duration-slow ease-[var(--ease-out)] data-[resizing=true]:transition-none motion-reduce:transition-none will-change-[width] [backface-visibility:hidden]"
          >
            {/* While the docked reader borrows the column, the tools stay
                mounted but hidden, so an unsaved note or a study set in
                progress is still there when they come back. */}
            {panes.studio && (
              <div id="workspace-studio-content" hidden={!studioShown} className={`${deskPane} flex flex-col anim-fade anim-fade--fast`}>
                <StudioPane
                  notebookId={notebookId}
                  onCollapse={collapseStudio}
                  pendingGenerationId={desktop ? pendingWork : null}
                  onPendingGenerationConsumed={clearPendingWork}
                  onOpenPractice={openPractice}
                />
              </div>
            )}
            {!studioShown && (
              <div className="anim-fade flex h-full flex-col items-center pt-3" style={{ ["--d"]: "60ms" } as CSSProperties}>
                <RailButton
                  icon={Books}
                  label="Notes & guides"
                  side="right"
                  onClick={() => (readerDocked && panes.studio ? setStudioWhileReading(true) : desk.setLayout(panes.sources ? "standard" : "writing"))}
                />
              </div>
            )}

            {/* Pull / Stretch Resizer Handle for Right Sidebar */}
            {studioShown && (
              <div
                {...studioResize.separatorProps}
                title="Drag to resize · Arrow keys adjust · Double-click resets"
                className="group absolute left-0 top-0 bottom-0 z-30 -ml-1.5 flex w-3 cursor-col-resize select-none items-center justify-center transition-colors hover:opacity-100 focus-visible:bg-brass/[0.06] focus-visible:outline-none"
              >
                <div className="h-8 w-1 rounded-[var(--radius-pill)] bg-hairline/80 shadow-sm transition-all duration-med group-hover:h-14 group-hover:w-1.5 group-hover:bg-brass group-active:h-20 group-active:bg-brass group-focus-visible:h-14 group-focus-visible:w-1.5 group-focus-visible:bg-brass group-focus-visible:shadow-[0_0_14px_rgba(227,176,75,0.42)] group-data-[collapse-ready=true]:h-20 group-data-[collapse-ready=true]:w-1.5 group-data-[collapse-ready=true]:bg-brass" />
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-pill)] border border-brass/30 bg-raised px-2.5 py-1 text-label tracking-normal text-brass opacity-0 shadow-modal transition-opacity group-data-[collapse-ready=true]:opacity-100">
                  Release to collapse
                </span>
              </div>
            )}
          </aside>
        </div>

        {practiceMounted && (
          <div className="desk-mode-view relative z-10 flex min-h-0 flex-1 flex-col" hidden={mode !== "practice"}>
            <PracticeDesk
              notebookId={notebookId}
              sourcesVersion={desk.sourcesVersion}
              onOpenSettings={() => openSettings("models")}
              onAddSources={() => addSources()}
              openRequest={practiceRequest}
            />
          </div>
        )}

        <div className={`relative z-10 flex min-h-0 flex-col lg:hidden ${mode === "practice" ? "" : "flex-1"}`}>
          {/* Flex column, not block: the panes size themselves with flex-1,
              which is ignored under a plain block parent — the studio and
              sources panes silently lost all scrolling on mobile. */}
          <div className="flex min-h-0 flex-1 flex-col" hidden={mode === "practice"}>
            {shownMobilePane === "sources" && (
              <div key={mobilePane} className={paneWrapperClass}>
                <SourcesPane
                  notebookId={notebookId}
                  version={desk.sourcesVersion}
                  onChanged={desk.bumpSources}
                  pendingView={desktop ? null : desk.pendingView}
                  onPendingConsumed={desk.clearPendingView}
                  importTick={desktop ? 0 : desk.importTick}
                  onImportTriggered={desk.consumeImport}
                  dropFiles={desktop ? null : desk.dropFiles}
                  onDropConsumed={() => desk.setDropFiles(null)}
                  addRequest={desktop ? 0 : addSourceRequest}
                  addKind={addSourceKind}
                  onAddRequestConsumed={consumeAddSource}
                  onAsk={askInChat}
                />
              </div>
            )}
            {shownMobilePane === "chat" && (
              <div key="chat" id="workspace-chat-pane-mobile" ref={setMobileChatTarget} className={paneWrapperClass} />
            )}
            {shownMobilePane === "studio" && (
              <div key={mobilePane} className={paneWrapperClass}>
                <StudioPane
                  notebookId={notebookId}
                  pendingGenerationId={desktop ? null : pendingWork}
                  onPendingGenerationConsumed={clearPendingWork}
                  onOpenPractice={openPractice}
                />
              </div>
            )}
          </div>
          <nav
            id="mobile-bottom-nav"
            aria-label="Notebook panes"
            className="workspace-mobile-nav"
          >
            {(
              [
                ["sources", Notebook, "Sources"],
                ["chat", ChatCircle, "Chat"],
                ["studio", Books, "Saved"],
                ["practice", ListChecks, "Practice"],
              ] as const
            ).map(([id, Icon, label]) => {
              const current = mode === "practice" ? "practice" : shownMobilePane;
              return (
              <button
                key={id}
                onClick={() => {
                  if (id === "practice") {
                    setMode("practice");
                    return;
                  }
                  if (mode !== "understand") setMode("understand");
                  setMobilePane(id);
                }}
                aria-pressed={current === id}
                className="workspace-mobile-tab"
              >
                {current === id && (
                  <motion.span
                    layoutId="mobile-tab-pill"
                    transition={SPRING}
                    className="workspace-mobile-indicator"
                  />
                )}
                <Icon size={ICON.xl} weight={current === id ? "fill" : "light"} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
              );
            })}
          </nav>
        </div>

        {reading && !wide && (
          <SourceReader
            key={`${reading.source.id}:${reading.startChar ?? ""}`}
            source={reading.source}
            startChar={reading.startChar}
            onClose={closeReading}
            onAsk={askInChat}
            onHighlightsChanged={desk.bumpSources}
          />
        )}
        <SettingsModal open={settingsOpen} initialTab={settingsTab} onClose={() => setSettingsOpen(false)} />
        </div>
      </ConsoleShell>
    </DeskShell>
  );
}

function WorkspaceHeader({
  notebook,
  panes,
  mode,
  onMode,
  onToggleSources,
  onToggleStudio,
  onRename,
  onSettings,
}: {
  notebook: NotebookRow | null;
  panes: { sources: boolean; studio: boolean };
  mode: DeskMode;
  onMode: (mode: DeskMode) => void;
  onToggleSources: () => void;
  onToggleStudio: () => void;
  onRename: (name: string) => void;
  onSettings: (tab?: SettingsTab) => void;
}) {
  const platform = detectPlatform();
  const tauri = isTauri();
  const macPad = tauri && platform === "mac";
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [stats, setStats] = useState<{ sources: number; tokens: number; gens: number } | null>(null);

  const actions = useDesk();

  const openAnalytics = async () => {
    if (!notebook) return;
    const sources = await db.sources.where("notebookId").equals(notebook.id).toArray();
    const gens = await db.generations.where("notebookId").equals(notebook.id).count();
    const tokens = sources.reduce((sum, s) => sum + s.tokens, 0);
    setStats({ sources: sources.length, tokens, gens });
    setAnalyticsOpen(true);
  };

  const handleExport = async () => {
    if (notebook) await exportNotebook(notebook).catch(() => undefined);
  };

  return (
    <>
      <header
        data-tauri-drag-region={tauri ? true : undefined}
        className={`desk-header workspace-header relative z-[40] ${macPad ? "workspace-header-mac" : ""}`}
      >
        <Link
          to="/studio"
          className="no-drag workspace-back"
          aria-label="All notebooks"
        >
          <CaretLeft size={ICON.lg} aria-hidden="true" />
          <span>Notebooks</span>
        </Link>

        <div className="workspace-heading">
          <input
            defaultValue={notebook?.name}
            key={notebook?.name}
            onBlur={(e) => onRename(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="no-drag workspace-title"
            aria-label="Notebook name"
          />
        </div>

        <div role="group" aria-label="Notebook mode" className="no-drag workspace-modes">
          {DESK_MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => onMode(id)}
              className="workspace-mode"
            >
              {mode === id && <motion.span layoutId="desk-mode-thumb" transition={CRISP} className="workspace-mode-thumb" aria-hidden="true" />}
              <Icon size={ICON.md} weight={mode === id ? "fill" : "regular"} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="no-drag workspace-actions">
          <FocusTimer />
          <div className="workspace-pane-group" hidden={mode !== "understand"}>
            <IconButton
              onClick={onToggleSources}
              title={panes.sources ? "Retract Sources Sidebar" : "Expand Sources Sidebar"}
              aria-label="Toggle sources sidebar"
              aria-pressed={panes.sources}
              className={`no-drag workspace-pane-toggle ${
                panes.sources
                  ? "text-ink bg-ink/[0.05] hover:bg-ink/[0.08]"
                  : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <SidebarSimple size={ICON.md} weight={panes.sources ? "regular" : "light"} />
            </IconButton>
            <IconButton
              onClick={onToggleStudio}
              title={panes.studio ? "Retract Studio Sidebar" : "Expand Studio Sidebar"}
              aria-label="Toggle studio sidebar"
              aria-pressed={panes.studio}
              className={`no-drag workspace-pane-toggle ${
                panes.studio
                  ? "text-ink bg-ink/[0.05] hover:bg-ink/[0.08]"
                  : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <SidebarSimple size={ICON.md} weight={panes.studio ? "regular" : "light"} className="scale-x-[-1]" />
            </IconButton>
          </div>

          <Menu
            align="end"
            aria-label="Notebook actions"
            trigger={<IconButton aria-label="Notebook actions"><DotsThree size={ICON.xxl} aria-hidden="true" /></IconButton>}
            items={[
              { key: "analytics", label: "Notebook details", icon: <ChartBar size={ICON.md} aria-hidden="true" />, disabled: !notebook, onSelect: () => void openAnalytics() },
              { key: "export", label: "Export notebook", icon: <DownloadSimple size={ICON.md} aria-hidden="true" />, disabled: !notebook, onSelect: () => void handleExport() },
              { key: "send", label: "Send to another device", icon: <DeviceMobile size={ICON.md} aria-hidden="true" />, disabled: !notebook, onSelect: () => setSendOpen(true) },
              { key: "models", label: "AI models", onSelect: () => onSettings("models") },
              { key: "milestones", label: "Study milestones", onSelect: actions.openMilestones },
              { key: "commands", label: "Search and commands", onSelect: actions.openPalette },
            ]}
          />
          <LampSwitch className="no-drag" />
          <IconButton
            onClick={() => onSettings()}
            aria-label="Settings"
          >
            <GearSix size={ICON.xl} aria-hidden="true" />
          </IconButton>
        </div>
        <CaptionButtons />
      </header>

      {sendOpen && notebook && <SendToDeviceDialog notebook={notebook} onClose={() => setSendOpen(false)} />}

      {/* Analytics Modal */}
      {notebook && (
        <Modal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} title="Notebook details">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <AnalyticsTile index={0} label="Sources" target={stats?.sources ?? 0} format={(v) => `${v}`} />
              <AnalyticsTile
                index={1}
                label="Source tokens"
                target={stats?.tokens ?? 0}
                format={(v) => `${(v / 1000).toFixed(1)}k`}
              />
              <AnalyticsTile index={2} label="Saved work" target={stats?.gens ?? 0} format={(v) => `${v}`} />
            </div>

            <div className="rounded-[var(--radius-dialog)] border border-hairline/80 bg-ink/[0.02] p-3 text-small leading-relaxed text-muted">
              Your sources, conversations, and saved work are stored on this device. Export this notebook to keep a backup you control.
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
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-brass"
        aria-label={`Show ${label}`}
      >
        <Icon size={ICON.md} weight="light" />
      </button>
      <span
        className={`pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-label text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
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
      className="anim-rise rounded-[var(--radius-dialog)] border border-hairline bg-surface/70 p-3"
      style={{ ["--d"]: `${Math.min(index, 10) * 30}ms` } as CSSProperties}
    >
      <div className="font-mono text-title font-semibold text-brass">{format(counted)}</div>
      <div className="mt-1 text-label text-muted">{label}</div>
    </div>
  );
}
