import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ArrowRight,
  CaretDown,
  DeviceMobile,
  FileArrowUp,
  FolderOpen,
  GearSix,
  ListDashes,
  MagnifyingGlass,
  Plug,
  Plus,
  SquaresFour,
  HardDrives,
  X,
} from "@phosphor-icons/react";
import { Button, Dialog, Empty, Field, IconButton, Input, Menu, Segmented, Skeleton } from "../ui";
import { db, createNotebook, deleteNotebook, touchNotebook } from "../lib/db";
import { exportNotebook, openNotebookText, readNotebookFileNative } from "../lib/backup";
import type { Notebook } from "../lib/types";
import DeskShell from "./DeskShell";
import SettingsModal, { type SettingsTab } from "./SettingsModal";
import FirstRunSetup from "../desk/FirstRunSetup";
import NotebookCard, { type NotebookCardData } from "./NotebookCard";
import NewNotebookDialog from "./NewNotebookDialog";
import ReviewDueStrip from "./ReviewDueStrip";
import { ReceiveFromDeviceDialog, SendToDeviceDialog, receiveCodeFromHash } from "./DeviceTransfer";
import { useDesk } from "./DeskContext";
import { modLabel } from "./shortcuts";
import { detectPlatform, isTauri } from "../lib/desktop";
import { timeAgo } from "./ui";
import { useMotionMode } from "./fx";
import "./shelf.css";
import { ICON } from "../ui/iconScale";

type ViewMode = "grid" | "list";

export default function Shelf({
  onOpen,
  onReview,
  needsKey,
}: {
  onOpen: (id: string) => void;
  /** Opens a saved flashcard deck inside its notebook. */
  onReview?: (notebookId: string, generationId: string) => void;
  needsKey: boolean;
}) {
  const motionMode = useMotionMode();
  const [notebooks, setNotebooks] = useState<NotebookCardData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [kickstartError, setKickstartError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("settings");
  const [setupOpen, setSetupOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadError, setLoadError] = useState("");

  const [renamingNotebook, setRenamingNotebook] = useState<Notebook | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState<Notebook | null>(null);
  // A scanned transfer link ("#receive=<code>") opens straight into
  // receiving; the code comes out of the address bar at once.
  const [receiving, setReceiving] = useState<{ code: string } | null>(() => {
    const code = typeof window === "undefined" ? null : receiveCodeFromHash(window.location.hash);
    return code ? { code } : null;
  });
  useEffect(() => {
    if (receiveCodeFromHash(window.location.hash)) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
  }, []);

  const openSettings = useCallback((tab: SettingsTab = "settings") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const [allNotebooks, allSources] = await Promise.all([db.notebooks.toArray(), db.sources.toArray()]);
      const sourceCountMap = new Map<string, number>();
      for (const s of allSources) {
        sourceCountMap.set(s.notebookId, (sourceCountMap.get(s.notebookId) ?? 0) + 1);
      }
      setNotebooks(
        allNotebooks.map((nb) => ({ ...nb, sourceCount: sourceCountMap.get(nb.id) ?? 0 })),
      );
    } catch {
      setLoadError("Your notebooks couldn’t be loaded. Try opening your notebooks again.");
    } finally {
      setLoaded(true);
    }
  }, []);

  // A kickstart handoff from onboarding mints its notebook here, before the
  // shelf itself is worth showing.
  useEffect(() => {
    let cancelled = false;
    const handleKickstart = async () => {
      try {
        const raw = sessionStorage.getItem("comtus_kickstart");
        if (raw) {
          sessionStorage.removeItem("comtus_kickstart");
          const parsed = JSON.parse(raw);
          const title = parsed.prompt
            ? `${parsed.subject} · ${parsed.prompt.slice(0, 30)}`
            : `${parsed.subject} (${parsed.goal})`;
          const nb = await createNotebook(title);
          if (!cancelled) onOpen(nb.id);
          return;
        }
      } catch (error) {
        if (!cancelled) {
          const fromCreate = error instanceof Error && !(error instanceof SyntaxError) ? error.message : "";
          setKickstartError(fromCreate || "The kickstart notebook could not be created.");
        }
      }
      if (!cancelled) void refresh();
    };
    void handleKickstart();
    return () => {
      cancelled = true;
    };
  }, [onOpen, refresh]);

  const recentNotebooks = useMemo(() => [...notebooks].sort((a, b) => b.updatedAt - a.updatedAt), [notebooks]);
  const latestNotebook = recentNotebooks[0];
  const processedNotebooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q ? recentNotebooks.filter((nb) => nb.name.toLowerCase().includes(q)) : recentNotebooks;
  }, [recentNotebooks, searchQuery]);

  const handleRename = async () => {
    if (!renamingNotebook) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) return;
    await db.notebooks.update(renamingNotebook.id, { name: trimmed });
    await touchNotebook(renamingNotebook.id);
    setRenamingNotebook(null);
    setRenameDraft("");
    void refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteNotebook(id);
    setDeletingId(null);
    void refresh();
  };

  const handleExport = async (nb: Notebook) => {
    setFileNotice(null);
    try {
      await exportNotebook(nb);
    } catch {
      setFileNotice({ tone: "error", text: "The notebook could not be exported. Your original is still on this device." });
    }
  };

  /** A notebook someone exported (maybe you, on another device) opens
   *  straight away; a full backup merges into the shelf. */
  const openFileText = async (text: string | null) => {
    if (text === null) return;
    setFileNotice(null);
    try {
      const opened = await openNotebookText(text);
      if (opened.kind === "notebook") {
        onOpen(opened.notebookId);
        return;
      }
      await refresh();
      setFileNotice({ tone: "ok", text: `Restored ${opened.count.toLocaleString()} items from the backup.` });
    } catch (error) {
      setFileNotice({ tone: "error", text: error instanceof Error ? error.message : "That file could not be opened." });
    }
  };

  const pickFile = () => {
    if (!isTauri()) {
      fileRef.current?.click();
      return;
    }
    readNotebookFileNative()
      .then(openFileText)
      .catch(() => setFileNotice({ tone: "error", text: "That file could not be read." }));
  };

  const openMenu = (
    <Menu
      aria-label="Open a notebook"
      align="end"
      trigger={
        <Button variant="secondary" icon={<FolderOpen size={ICON.lg} aria-hidden="true" />} iconEnd={<CaretDown size={ICON.md} weight="bold" className="shelf-open-caret" aria-hidden="true" />}>
          Open
        </Button>
      }
      items={[
        { key: "file", label: "A notebook file", icon: <FileArrowUp size={ICON.lg} aria-hidden="true" />, onSelect: pickFile },
        {
          key: "device",
          label: "From another device",
          icon: <DeviceMobile size={ICON.lg} aria-hidden="true" />,
          onSelect: () => setReceiving({ code: "" }),
        },
      ]}
    />
  );

  return (
    <DeskShell onSettings={openSettings} onNewNotebook={() => setCreating(true)}>
      <div className="shelf-page bg-desk-surface" data-motion={motionMode}>
        <a className="shelf-skip-link" href="#shelf-main">Skip to notebooks</a>
        <div className="shelf-content">
          <header className="shelf-header">
            <Link to="/" aria-label="Back to landing" className="shelf-brand">
              comtus<span aria-hidden="true">.</span>
            </Link>
            <nav className="shelf-nav" aria-label="Studio navigation">
              <Link to="/studio" aria-current="page">Shelf</Link>
              <Link to="/study-companion">Study guide</Link>
            </nav>
            <div className="shelf-header-actions">
              <span className="shelf-save-note"><HardDrives size={ICON.md} aria-hidden="true" /> Saved on this device</span>
              <IconButton aria-label="Settings" onClick={() => openSettings("settings")}>
                <GearSix size={ICON.xl} aria-hidden="true" />
              </IconButton>
            </div>
          </header>

          <main id="shelf-main" tabIndex={-1}>
            <div className="shelf-intro">
              <div>
                <span className="shelf-kicker">Your notebooks</span>
                <h1>Your study desk<span>.</span></h1>
                <p>A home for your sources. Room for your thinking.</p>
              </div>
              {notebooks.length > 0 && (
                <div className="shelf-intro-actions">
                  {openMenu}
                  <Button className="shelf-new" icon={<Plus size={ICON.lg} aria-hidden="true" />} onClick={() => setCreating(true)}>
                    New notebook
                  </Button>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".json,application/json"
              aria-label="Notebook file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void file.text().then(openFileText).catch(() => setFileNotice({ tone: "error", text: "That file could not be read. Try another copy." }));
              }}
            />
            {fileNotice && (
              <p className={fileNotice.tone === "error" ? "shelf-error" : "shelf-file-note"} role={fileNotice.tone === "error" ? "alert" : "status"}>
                {fileNotice.text}
              </p>
            )}

            {kickstartError && (
              <p className="shelf-error" role="alert">
                {kickstartError}
              </p>
            )}

            {loadError ? (
              <section className="shelf-load-error" role="alert">
                <h2>Your notebooks couldn’t open.</h2>
                <p>{loadError}</p>
                <Button variant="secondary" onClick={() => { setLoaded(false); void refresh(); }}>Try again</Button>
              </section>
            ) : !loaded ? (
              <div className="shelf-grid" aria-label="Loading notebooks" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton.Card key={i} />
                ))}
              </div>
            ) : notebooks.length === 0 ? (
              <section className="shelf-start" aria-labelledby="shelf-start-title">
                <div className="shelf-start-copy">
                  <span className="shelf-kicker"><span aria-hidden="true">01 /</span> A notebook of your own</span>
                  <h2 id="shelf-start-title">What are you<br /><em>working on?</em></h2>
                  <p>A course. An exam. A question that won’t leave you alone. Give it a notebook and start making connections.</p>
                  <Button className="shelf-new" icon={<Plus size={ICON.lg} aria-hidden="true" />} onClick={() => setCreating(true)}>
                    New notebook
                  </Button>
                  <span className="shelf-start-note">Start with a name. Add the material as you go.</span>
                </div>
                <div className="shelf-start-page">
                  <div className="shelf-page-heading"><BookOpen size={ICON.xxl} weight="light" aria-hidden="true" /><span>Inside your notebook</span></div>
                  <ol className="shelf-start-steps" aria-label="How a notebook works">
                  <li>
                    <div>
                      <h3>Add your sources</h3>
                      <p>Bring in documents, links, or your own notes.</p>
                    </div>
                  </li>
                  <li>
                    <div>
                      <h3>Talk it through</h3>
                      <p>Ask questions and follow answers back to your sources.</p>
                    </div>
                  </li>
                  <li>
                    <div>
                      <h3>Make it stick</h3>
                      <p>Turn your material into quizzes, flashcards, and study guides.</p>
                    </div>
                  </li>
                  </ol>
                  <p className="shelf-page-foot">From a source to an idea you can explain.</p>
                </div>
                <div className="shelf-start-open-row">
                  <FolderOpen size={ICON.xl} aria-hidden="true" />
                  <span>Bringing a notebook with you?</span>
                  <button type="button" className="shelf-start-open" onClick={pickFile}>Open its file</button>
                  <span>or</span>
                  <button type="button" className="shelf-start-open" onClick={() => setReceiving({ code: "" })}>receive it from another device</button>
                </div>
              </section>
            ) : (
              <>
                {latestNotebook && notebooks.length > 1 && !searchQuery.trim() && (
                  <section className="shelf-resume" aria-label="Continue studying">
                    <div className="shelf-resume-mark" aria-hidden="true"><BookOpen size={ICON.xl} weight="light" /></div>
                    <div className="shelf-resume-copy">
                      <span className="shelf-kicker">Last opened</span>
                      <h2>{latestNotebook.name}</h2>
                      <p>
                        Updated {timeAgo(latestNotebook.updatedAt)}
                        <span>{latestNotebook.sourceCount} {latestNotebook.sourceCount === 1 ? "source" : "sources"}</span>
                      </p>
                    </div>
                    <Button variant="secondary" iconEnd={<ArrowRight size={ICON.lg} aria-hidden="true" />} onClick={() => onOpen(latestNotebook.id)}>
                      Continue studying
                    </Button>
                  </section>
                )}

                {onReview && <ReviewDueStrip onReview={onReview} />}

                <section className="shelf-collection" aria-labelledby="shelf-collection-title">
                  <div className="shelf-toolbar">
                    <div className="shelf-collection-heading">
                      <h2 id="shelf-collection-title">All notebooks <span>{notebooks.length}</span></h2>
                      <p>Most recently updated first</p>
                    </div>
                    {(notebooks.length > 1 || Boolean(searchQuery.trim())) && (
                      <div className="shelf-search">
                        <MagnifyingGlass size={ICON.lg} aria-hidden="true" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search notebooks"
                          aria-label="Search notebooks"
                        />
                        {searchQuery && (
                          <IconButton aria-label="Clear search" className="shelf-search-clear" onClick={() => setSearchQuery("")}>
                            <X size={ICON.md} aria-hidden="true" />
                          </IconButton>
                        )}
                      </div>
                    )}
                    <SearchNotebooksButton />
                    {(notebooks.length > 1 || Boolean(searchQuery.trim())) && (
                      <Segmented
                        aria-label="View"
                        value={viewMode}
                        onChange={setViewMode}
                        options={[
                          { value: "grid", label: "Grid", icon: <SquaresFour size={ICON.lg} aria-hidden="true" /> },
                          { value: "list", label: "List", icon: <ListDashes size={ICON.lg} aria-hidden="true" /> },
                        ]}
                      />
                    )}
                  </div>

                  {searchQuery.trim() && (
                    <p className="shelf-search-count" role="status">
                      {processedNotebooks.length} {processedNotebooks.length === 1 ? "notebook" : "notebooks"} found
                    </p>
                  )}

                  {processedNotebooks.length === 0 ? (
                    <Empty
                      title="No notebooks found"
                      body="Try another title or clear your search to return to your shelf."
                      action={<Button variant="secondary" onClick={() => setSearchQuery("")}>Clear search</Button>}
                    />
                  ) : (
                    <ul className="shelf-grid" data-view={viewMode} aria-label="Notebooks">
                      {processedNotebooks.map((nb, index) => (
                        <li key={nb.id}>
                          <NotebookCard
                            notebook={nb}
                            number={index + 1}
                            onOpen={onOpen}
                            onRename={(notebook) => {
                              setRenamingNotebook(notebook);
                              setRenameDraft(notebook.name);
                            }}
                            onExport={(notebook) => void handleExport(notebook)}
                            onSend={setSending}
                            onDelete={setDeletingId}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}

            {needsKey && (
              <aside className="shelf-model-setup" aria-label="Model setup">
                <Plug size={ICON.xl} aria-hidden="true" />
                <p>
                  <strong>Ready for questions and study tools?</strong>
                  <span>Connect a model when you need one. You can organize your sources first.</span>
                </p>
                <Button variant="ghost" onClick={() => openSettings("models")}>
                  Connect a model
                </Button>
                <button type="button" className="shelf-start-open" onClick={() => setSetupOpen(true)}>
                  or use a free local model (Ollama)
                </button>
              </aside>
            )}
            <footer className="shelf-footer">
              <span>Rough thought, polished.</span>
              <p>Notebooks stay in this browser. <button type="button" onClick={() => openSettings("settings")}>Keep a backup</button></p>
            </footer>
          </main>
        </div>

        <NewNotebookDialog open={creating} onClose={() => setCreating(false)} onCreated={onOpen} />
        {sending && <SendToDeviceDialog notebook={sending} onClose={() => setSending(null)} />}
        {receiving && (
          <ReceiveFromDeviceDialog
            initialCode={receiving.code}
            onClose={() => setReceiving(null)}
            onReceived={(result) => {
              setReceiving(null);
              onOpen(result.notebookId);
            }}
          />
        )}

        <Dialog open={renamingNotebook !== null} onClose={() => setRenamingNotebook(null)} title="Rename notebook">
          <div className="shelf-dialog space-y-5">
            <Field label="Notebook name">
              <Input
                data-autofocus
                aria-label="Notebook name"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleRename()}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setRenamingNotebook(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void handleRename()} disabled={!renameDraft.trim()}>
                Save changes
              </Button>
            </div>
          </div>
        </Dialog>

        <Dialog open={deletingId !== null} onClose={() => setDeletingId(null)} title="Delete notebook">
          <div className="shelf-dialog space-y-4">
            <p className="text-body leading-relaxed text-muted">
              Are you sure you want to delete this notebook? All sources, notes, and study history inside it will be
              permanently deleted from this device.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setDeletingId(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => deletingId && void handleDelete(deletingId)}>
                Delete permanently
              </Button>
            </div>
          </div>
        </Dialog>

        <SettingsModal open={settingsOpen} initialTab={settingsTab} onClose={() => setSettingsOpen(false)} />
        <FirstRunSetup open={setupOpen} onClose={() => setSetupOpen(false)} />
      </div>
    </DeskShell>
  );
}

/** The title filter only sees names; this opens full-text search across
 *  every source, chat and saved item. It reads as a button, not a second
 *  field: the shelf filter is the only input on this row. Rendered inside
 *  DeskShell so it reaches the palette through desk context. */
function SearchNotebooksButton() {
  const desk = useDesk();
  return (
    <Button variant="secondary" className="shelf-search-library" onClick={desk.openPalette}>
      Search inside notebooks
      <kbd aria-hidden="true">{modLabel(detectPlatform())} K</kbd>
    </Button>
  );
}
