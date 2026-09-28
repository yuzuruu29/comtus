import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, FolderOpen, GearSix, ListDashes, MagnifyingGlass, Plug, Plus, SquaresFour, X } from "@phosphor-icons/react";
import { Button, Dialog, Empty, Field, IconButton, Input, Segmented, Skeleton } from "../ui";
import { db, createNotebook, deleteNotebook, touchNotebook } from "../lib/db";
import { exportNotebook, openNotebookText, readNotebookFileNative } from "../lib/backup";
import type { Notebook } from "../lib/types";
import ComtusLogo from "../components/brand/ComtusLogo";
import DeskShell from "./DeskShell";
import SettingsModal, { type SettingsTab } from "./SettingsModal";
import NotebookCard, { type NotebookCardData } from "./NotebookCard";
import NewNotebookDialog from "./NewNotebookDialog";
import ReviewDueStrip from "./ReviewDueStrip";
import { useDesk } from "./DeskContext";
import { modLabel } from "./shortcuts";
import { detectPlatform, isTauri } from "../lib/desktop";
import { timeAgo } from "./ui";
import "./shelf.css";

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
  const [notebooks, setNotebooks] = useState<NotebookCardData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [kickstartError, setKickstartError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("settings");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const [renamingNotebook, setRenamingNotebook] = useState<Notebook | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openSettings = useCallback((tab: SettingsTab = "settings") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const refresh = useCallback(async () => {
    const [allNotebooks, allSources] = await Promise.all([db.notebooks.toArray(), db.sources.toArray()]);
    const sourceCountMap = new Map<string, number>();
    for (const s of allSources) {
      sourceCountMap.set(s.notebookId, (sourceCountMap.get(s.notebookId) ?? 0) + 1);
    }
    setNotebooks(
      allNotebooks.map((nb) => ({ ...nb, sourceCount: sourceCountMap.get(nb.id) ?? 0 })),
    );
    setLoaded(true);
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
    await exportNotebook(nb).catch(() => undefined);
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

  const openFileButton = (
    <Button variant="secondary" icon={<FolderOpen size={18} aria-hidden="true" />} onClick={pickFile}>
      Open a file
    </Button>
  );

  return (
    <DeskShell onSettings={openSettings} onNewNotebook={() => setCreating(true)}>
      <div className="shelf-page">
        <div className="shelf-content">
          <header className="shelf-header">
            <Link to="/" aria-label="Back to landing" className="shelf-brand">
              <ComtusLogo variant="full" size="sm" />
            </Link>
            <div className="shelf-header-actions">
              <span className="shelf-save-note">Saved on this device</span>
              <IconButton aria-label="Settings" onClick={() => openSettings("settings")}>
                <GearSix size={20} aria-hidden="true" />
              </IconButton>
            </div>
          </header>

          <main>
            <div className="shelf-intro">
              <div>
                <h1>Your notebooks</h1>
                <p>Your sources, conversations, and study tools, kept together.</p>
              </div>
              {notebooks.length > 0 && (
                <div className="shelf-intro-actions">
                  {openFileButton}
                  <Button className="shelf-new" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setCreating(true)}>
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
                if (file) void file.text().then(openFileText);
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

            {!loaded ? (
              <div className="shelf-grid" aria-label="Loading notebooks" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton.Card key={i} />
                ))}
              </div>
            ) : notebooks.length === 0 ? (
              <section className="shelf-start" aria-labelledby="shelf-start-title">
                <div className="shelf-start-copy">
                  <BookOpen size={36} weight="light" aria-hidden="true" />
                  <h2 id="shelf-start-title">Start with what you’re learning.</h2>
                  <p>Make a notebook for a course, an exam, or a question you want to work through.</p>
                  <Button className="shelf-new" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setCreating(true)}>
                    New notebook
                  </Button>
                  <span className="shelf-start-note">Give it a name. Add your material when you’re ready.</span>
                  <button type="button" className="shelf-start-open" onClick={pickFile}>
                    Have a notebook file? Open it
                  </button>
                </div>
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
              </section>
            ) : (
              <>
                {latestNotebook && (
                  <section className="shelf-resume" aria-label="Continue studying">
                    <BookOpen className="shelf-resume-icon" size={32} weight="light" aria-hidden="true" />
                    <div className="shelf-resume-copy">
                      <h2>{latestNotebook.name}</h2>
                      <p>
                        Updated {timeAgo(latestNotebook.updatedAt)}
                        <span>{latestNotebook.sourceCount} {latestNotebook.sourceCount === 1 ? "source" : "sources"}</span>
                      </p>
                    </div>
                    <Button variant="secondary" onClick={() => onOpen(latestNotebook.id)}>
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
                    <div className="shelf-search">
                      <MagnifyingGlass size={18} aria-hidden="true" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search notebooks"
                        aria-label="Search notebooks"
                      />
                      {searchQuery && (
                        <IconButton aria-label="Clear search" className="shelf-search-clear" onClick={() => setSearchQuery("")}>
                          <X size={16} aria-hidden="true" />
                        </IconButton>
                      )}
                    </div>
                    <SearchLibraryButton />
                    <Segmented
                      aria-label="View"
                      value={viewMode}
                      onChange={setViewMode}
                      options={[
                        { value: "grid", label: "Grid", icon: <SquaresFour size={17} aria-hidden="true" /> },
                        { value: "list", label: "List", icon: <ListDashes size={17} aria-hidden="true" /> },
                      ]}
                    />
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
                      {processedNotebooks.map((nb) => (
                        <li key={nb.id}>
                          <NotebookCard
                            notebook={nb}
                            onOpen={onOpen}
                            onRename={(notebook) => {
                              setRenamingNotebook(notebook);
                              setRenameDraft(notebook.name);
                            }}
                            onExport={(notebook) => void handleExport(notebook)}
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
                <Plug size={20} aria-hidden="true" />
                <p>
                  <strong>Ready for questions and study tools?</strong>
                  <span>Connect a model when you need one. You can organize your sources first.</span>
                </p>
                <Button variant="ghost" onClick={() => openSettings("models")}>
                  Connect a model
                </Button>
              </aside>
            )}
          </main>
        </div>

        <NewNotebookDialog open={creating} onClose={() => setCreating(false)} onCreated={onOpen} />

        <Dialog open={renamingNotebook !== null} onClose={() => setRenamingNotebook(null)} title="Rename notebook">
          <div className="shelf-dialog space-y-5">
            <Field label="Notebook name">
              <Input
                autoFocus
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
      </div>
    </DeskShell>
  );
}

/** The title filter only sees names; this opens full-text search across
 *  every source, chat and saved item. Rendered inside DeskShell so it
 *  reaches the palette through desk context. */
function SearchLibraryButton() {
  const desk = useDesk();
  return (
    <Button variant="ghost" className="shelf-search-library" onClick={desk.openPalette}>
      Search inside notebooks
      <kbd aria-hidden="true">{modLabel(detectPlatform())} K</kbd>
    </Button>
  );
}
