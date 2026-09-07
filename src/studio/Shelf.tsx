import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GearSix, ListDashes, MagnifyingGlass, Plus, SquaresFour } from "@phosphor-icons/react";
import { Button, Dialog, Empty, Field, IconButton, Input, Segmented, Skeleton } from "../ui";
import { db, createNotebook, deleteNotebook, touchNotebook } from "../lib/db";
import type { Notebook, Source } from "../lib/types";
import ComtusLogo, { ComtusEmblem } from "../components/brand/ComtusLogo";
import DeskShell from "./DeskShell";
import SettingsModal, { type SettingsTab } from "./SettingsModal";
import NotebookCard, { type NotebookCardData } from "./NotebookCard";
import NewNotebookDialog from "./NewNotebookDialog";

type ViewMode = "grid" | "list";

const GRID_COLS = "grid-cols-[repeat(auto-fill,minmax(240px,1fr))]";

export default function Shelf({
  onOpen,
  needsKey,
}: {
  onOpen: (id: string) => void;
  needsKey: boolean;
}) {
  const [notebooks, setNotebooks] = useState<NotebookCardData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [kickstartError, setKickstartError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(needsKey);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(needsKey ? "models" : "settings");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const [renamingNotebook, setRenamingNotebook] = useState<Notebook | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const processedNotebooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q ? notebooks.filter((nb) => nb.name.toLowerCase().includes(q)) : [...notebooks];
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notebooks, searchQuery]);

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
    const sources = await db.sources.where("notebookId").equals(nb.id).toArray();
    const generations = await db.generations.where("notebookId").equals(nb.id).toArray();
    const payload = {
      notebook: nb,
      exportedAt: new Date().toISOString(),
      sources: sources.map((s: Source) => ({ title: s.title, kind: s.kind, content: s.content })),
      generations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nb.name.replace(/[^a-z0-9_-]/gi, "_")}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DeskShell onSettings={openSettings} onNewNotebook={() => setCreating(true)}>
      <div className="min-h-[100svh] overflow-y-auto bg-ground">
        <div className="mx-auto w-full max-w-6xl px-3 pb-24 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between gap-4 border-b border-hairline pb-6 pt-[calc(1.25rem+var(--sat))]">
            <div className="flex items-center gap-3">
              <Link to="/" aria-label="Back to landing" className="flex items-center">
                <ComtusLogo variant="full" size="sm" />
              </Link>
              <span className="hidden h-5 w-px bg-hairline-strong sm:block" aria-hidden="true" />
              <h1 className="hidden font-display text-title font-[550] text-ink sm:block">Your notebooks</h1>
            </div>
            <div className="flex items-center gap-2">
              <IconButton aria-label="Settings" onClick={() => openSettings("settings")}>
                <GearSix size={17} weight="light" />
              </IconButton>
              {notebooks.length > 0 && (
                <Button variant="primary" icon={<Plus size={15} weight="bold" />} onClick={() => setCreating(true)}>
                  New notebook
                </Button>
              )}
            </div>
          </header>

          {needsKey && (
            <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-dialog)] border border-brass/30 bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ComtusEmblem size={20} breathe className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-body font-semibold text-ink">Power up your model</p>
                  <p className="mt-0.5 text-label text-muted">
                    Connect OpenRouter with free models, Claude via PayPal, or run offline with Ollama or LM Studio.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => openSettings("models")}>
                Configure key
              </Button>
            </div>
          )}

          {kickstartError && (
            <p className="mt-4 text-body text-rust" role="alert">
              {kickstartError}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <MagnifyingGlass
                size={14}
                weight="bold"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notebooks…"
                aria-label="Search notebooks"
                className="pl-8"
              />
            </div>
            <Segmented
              aria-label="View"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "grid", label: "Grid", icon: <SquaresFour size={14} weight="bold" /> },
                { value: "list", label: "List", icon: <ListDashes size={14} weight="bold" /> },
              ]}
            />
          </div>

          {!loaded ? (
            <div className={`mt-6 grid gap-4 ${GRID_COLS}`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton.Card key={i} />
              ))}
            </div>
          ) : notebooks.length === 0 ? (
            <Empty
              title="Your shelf is empty."
              body="Make a notebook for the course you are studying."
              action={
                <Button variant="primary" icon={<Plus size={15} weight="bold" />} onClick={() => setCreating(true)}>
                  New notebook
                </Button>
              }
            />
          ) : processedNotebooks.length === 0 ? (
            <Empty title="No matches." body="No notebooks match your search." />
          ) : (
            <div className={`mt-6 grid gap-4 ${viewMode === "grid" ? GRID_COLS : "grid-cols-1"}`}>
              {processedNotebooks.map((nb) => (
                <NotebookCard
                  key={nb.id}
                  notebook={nb}
                  onOpen={onOpen}
                  onRename={(notebook) => {
                    setRenamingNotebook(notebook);
                    setRenameDraft(notebook.name);
                  }}
                  onExport={(notebook) => void handleExport(notebook)}
                  onDelete={setDeletingId}
                />
              ))}
            </div>
          )}
        </div>

        <NewNotebookDialog open={creating} onClose={() => setCreating(false)} onCreated={onOpen} />

        <Dialog open={renamingNotebook !== null} onClose={() => setRenamingNotebook(null)} title="Rename notebook">
          <div className="space-y-5">
            <Field label="Notebook name">
              <Input
                autoFocus
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
          <div className="space-y-4">
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
