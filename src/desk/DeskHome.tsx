import { useEffect, useRef, useState, useMemo } from "react";
import {
  BookOpen,
  DotsThreeVertical,
  DeviceMobile,
  DownloadSimple,
  FolderOpen,
  ListDashes,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SquaresFour,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { liveQuery } from "dexie";
import { db, createNotebook, deleteNotebook, touchNotebook } from "../lib/db";
import { exportNotebook, openNotebookText, readNotebookFileNative } from "../lib/backup";
import { isTauri } from "../lib/desktop";
import { ReceiveFromDeviceDialog, SendToDeviceDialog } from "../studio/DeviceTransfer";
import type { Notebook } from "../lib/types";
import StudyGlyph from "../components/icons/StudyGlyph";
import ComtusLogo from "../components/brand/ComtusLogo";
import { ByokBadge, ProBadge, SettingsButton, CreateNotebookEmblem } from "../components/brand/BrandControls";
import { EXIT, POPOVER, SOFT, Spotlight, staggerDelay } from "../studio/fx";
import { Modal, Field, inputCls, btnLamp, btnGhost, timeAgo } from "../studio/ui";
import { examCountdown } from "../lib/exam";
import { AnimatePresence, motion } from "motion/react";
import { useSettings } from "../lib/settings";
import ReviewDueStrip from "../studio/ReviewDueStrip";
import { ICON } from "../ui/iconScale";

type SortOption = "recent" | "az" | "oldest" | "sources";

interface NotebookWithCount extends Notebook {
  sourceCount: number;
}

export default function DeskHome({
  needsSetup,
  onSetup,
  onOpenResume,
  onOpenWork,
  onNew: _onNew,
  onSettings,
}: {
  needsSetup: boolean;
  onSetup: () => void;
  resume: Notebook | null;
  modelLabel: string;
  onOpenResume: (id: string) => void;
  onOpenWork: (notebookId: string, generationId: string) => void;
  onNew: () => void;
  onImport: () => void;
  onSettings: () => void;
}) {
  const isPro = useSettings((s) => Boolean(s.isPro && s.planTier !== "free"));
  const planTier = useSettings((s) => s.planTier);
  const lastBackupAt = useSettings((s) => s.lastBackupAt) ?? 0;
  const [needsBackup, setNeedsBackup] = useState(false);

  useEffect(() => {
    if (lastBackupAt > 0) {
      setNeedsBackup(false);
      return;
    }
    void db.sources.count().then((n) => setNeedsBackup(n > 0)).catch(() => setNeedsBackup(false));
  }, [lastBackupAt]);

  const [notebooks, setNotebooks] = useState<NotebookWithCount[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"all" | "my">("all");
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // Dialog states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newNotebookName, setNewNotebookName] = useState("");
  const [renamingNotebook, setRenamingNotebook] = useState<Notebook | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Live query for notebooks and their source counts
  useEffect(() => {
    const sub = liveQuery(async () => {
      const allNotebooks = await db.notebooks.toArray();
      const allSources = await db.sources.toArray();

      const sourceCountMap = new Map<string, number>();
      for (const s of allSources) {
        sourceCountMap.set(s.notebookId, (sourceCountMap.get(s.notebookId) ?? 0) + 1);
      }

      return allNotebooks.map((nb) => ({
        ...nb,
        sourceCount: sourceCountMap.get(nb.id) ?? 0,
      }));
    }).subscribe({
      next: (items) => {
        setNotebooks(items);
        setLoadError(false);
      },
      error: () => setLoadError(true),
    });

    return () => sub.unsubscribe();
  }, []);

  // Close sort menu or card menus on click outside
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
      if (!(e.target as HTMLElement).closest("[data-notebook-menu]")) {
        setMenuOpenId(null);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  // Filtered & sorted notebooks
  const processedNotebooks = useMemo(() => {
    let list = [...notebooks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((nb) => nb.name.toLowerCase().includes(q));
    }

    switch (sortOption) {
      case "recent":
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case "az":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "oldest":
        list.sort((a, b) => a.updatedAt - b.updatedAt);
        break;
      case "sources":
        list.sort((a, b) => b.sourceCount - a.sourceCount);
        break;
    }

    return list;
  }, [notebooks, searchQuery, sortOption]);

  const openCreateModal = () => {
    setNewNotebookName("");
    setCreateError("");
    setCreateModalOpen(true);
  };

  const handleCreate = async () => {
    const trimmed = newNotebookName.trim();
    if (!trimmed || createPending) return;
    setCreatePending(true);
    setCreateError("");

    let nb: Notebook;
    try {
      nb = await createNotebook(trimmed);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "The notebook could not be created.");
      setCreatePending(false);
      return;
    }

    setCreateModalOpen(false);
    setNewNotebookName("");
    setCreatePending(false);
    onOpenResume(nb.id);
  };

  const handleRename = async () => {
    if (!renamingNotebook) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) return;
    await db.notebooks.update(renamingNotebook.id, { name: trimmed });
    await touchNotebook(renamingNotebook.id);
    setRenamingNotebook(null);
    setRenameDraft("");
  };

  const handleDelete = async (id: string) => {
    await deleteNotebook(id);
    setDeletingId(null);
    setMenuOpenId(null);
  };

  const handleExport = async (nb: Notebook) => {
    setMenuOpenId(null);
    await exportNotebook(nb).catch(() => undefined);
  };

  // An exported notebook opens straight away; a full backup merges in and
  // the live query picks it up.
  const [fileNotice, setFileNotice] = useState("");
  const [sending, setSending] = useState<Notebook | null>(null);
  const [receiving, setReceiving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const openFileText = async (text: string | null) => {
    if (text === null) return;
    setFileNotice("");
    try {
      const opened = await openNotebookText(text);
      if (opened.kind === "notebook") onOpenResume(opened.notebookId);
      else setFileNotice(`Restored ${opened.count.toLocaleString()} items from the backup.`);
    } catch (error) {
      setFileNotice(error instanceof Error ? error.message : "That file could not be opened.");
    }
  };
  const pickFile = () => {
    if (!isTauri()) {
      fileRef.current?.click();
      return;
    }
    readNotebookFileNative()
      .then(openFileText)
      .catch(() => setFileNotice("That file could not be read."));
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <main aria-label="Comtus Desktop Home" className="relative min-h-0 flex-1 overflow-y-auto bg-ground">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[45vh] bg-[radial-gradient(75%_100%_at_50%_0%,rgba(227,176,75,0.06),transparent_80%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-6 sm:px-10 sm:py-8 lg:px-12">
        {/* Top Header Row matching Screenshot 1 */}
        <div className="flex items-center justify-between border-b border-hairline pb-5">
          <ComtusLogo variant="full" size="sm" />

          <div className="flex items-center gap-2.5">
            <SettingsButton onClick={onSettings} />
            {isPro ? (
              <ProBadge
                planTier={planTier}
                onClick={onSettings}
              />
            ) : (
              <ByokBadge onClick={onSettings} />
            )}
          </div>
        </div>

        {needsBackup && (
          <p className="mt-4 text-small text-muted">Export a backup. This browser can remove site data.</p>
        )}

        {/* Filter & View Controls Toolbar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Tab Pills */}
          <div className="flex items-center gap-1.5 rounded-[var(--radius-control)] bg-surface/80 p-1 border border-hairline">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-[var(--radius-control)] px-3.5 py-1 text-small font-medium transition-all ${
                activeTab === "all"
                  ? "bg-brass/15 text-brass shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("my")}
              className={`rounded-[var(--radius-control)] px-3.5 py-1 text-small font-medium transition-all ${
                activeTab === "my"
                  ? "bg-brass/15 text-brass shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              My notebooks
            </button>
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative hidden sm:block">
              <MagnifyingGlass
                size={ICON.sm}
                weight="light"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notebooks…"
                className="h-9 w-44 rounded-[var(--radius-control)] border border-hairline bg-surface/50 pl-8 pr-3 text-small text-ink placeholder:text-muted transition-all focus:w-60 focus:border-brass/40 focus:bg-surface"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  <X size={ICON.xs} />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-[var(--radius-control)] border border-hairline bg-surface/60 p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-colors ${
                  viewMode === "grid"
                    ? "bg-ink/[0.08] text-brass"
                    : "text-muted hover:text-ink"
                }`}
                title="Grid view"
                aria-label="Grid view"
              >
                <SquaresFour size={ICON.md} weight={viewMode === "grid" ? "fill" : "light"} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-colors ${
                  viewMode === "list"
                    ? "bg-ink/[0.08] text-brass"
                    : "text-muted hover:text-ink"
                }`}
                title="List view"
                aria-label="List view"
              >
                <ListDashes size={ICON.md} weight={viewMode === "list" ? "bold" : "light"} />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div ref={sortMenuRef} className="relative">
              <button
                onClick={() => setSortMenuOpen((v) => !v)}
                className="flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-hairline bg-surface/60 px-3 text-small font-medium text-muted hover:text-ink transition-colors"
              >
                <span>
                  {sortOption === "recent"
                    ? "Most recent"
                    : sortOption === "az"
                      ? "Alphabetical"
                      : sortOption === "oldest"
                        ? "Oldest"
                        : "Most sources"}
                </span>
                <span className="text-label text-muted">▾</span>
              </button>

              <AnimatePresence>
                {sortMenuOpen && (
                  <motion.div
                    initial={POPOVER.initial}
                    animate={POPOVER.animate}
                    exit={{ ...POPOVER.exit, transition: EXIT }}
                    transition={SOFT}
                    className="absolute right-0 top-[calc(100%+6px)] z-50 w-40 overflow-hidden rounded-[var(--radius-control)] border border-hairline bg-surface p-1 shadow-modal"
                  >
                    {[
                      { id: "recent", label: "Most recent" },
                      { id: "az", label: "Alphabetical" },
                      { id: "oldest", label: "Oldest" },
                      { id: "sources", label: "Most sources" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSortOption(opt.id as SortOption);
                          setSortMenuOpen(false);
                        }}
                        className={`flex w-full items-center px-3 py-2 text-left text-small rounded-[var(--radius-control)] transition-colors ${
                          sortOption === opt.id
                            ? "bg-brass/10 text-brass font-medium"
                            : "text-muted hover:bg-ink/[0.04] hover:text-ink"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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
            <button
              onClick={pickFile}
              className="flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-hairline px-3.5 text-small text-ink/85 hover:border-hairline-strong hover:text-ink transition-colors"
            >
              <FolderOpen size={ICON.md} />
              <span>Open a file</span>
            </button>
            <button
              onClick={() => setReceiving(true)}
              className="flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-hairline px-3.5 text-small text-ink/85 hover:border-hairline-strong hover:text-ink transition-colors"
            >
              <DeviceMobile size={ICON.md} />
              <span>From another device</span>
            </button>

            {/* + Create New Button */}
            <button
              onClick={openCreateModal}
              className="flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] grad-lamp px-4 text-small font-semibold text-ground shadow-sm hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <Plus size={ICON.md} weight="bold" />
              <span>Create new</span>
            </button>
          </div>
        </div>

        {fileNotice && (
          <p role="status" className="mt-4 text-small text-muted">
            {fileNotice}
          </p>
        )}

        <ReviewDueStrip onReview={onOpenWork} />

        {needsSetup && (
          <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-[var(--radius-dialog)] border border-brass/25 bg-brass/[0.05] px-4 py-3.5 sm:flex-row sm:items-center">
            <p className="text-body leading-relaxed text-muted">
              <strong className="text-ink">No model connected yet.</strong> A free local model keeps
              every answer on this machine.
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={onSetup} className={btnLamp}>
                Set up a local model
              </button>
              <button
                type="button"
                onClick={onSettings}
                className="rounded-[var(--radius-control)] border border-hairline px-3.5 py-2 text-label text-muted transition-colors hover:border-hairline-strong hover:text-ink"
              >
                Connect online
              </button>
            </div>
          </div>
        )}

        {/* Section Heading */}
        <div className="mt-8 mb-5 flex items-baseline justify-between">
          <h2 className="font-display text-[1.45rem] font-[450] text-ink">
            Recent notebooks
          </h2>
          <span className="text-label tabular-nums text-muted">
            {processedNotebooks.length} {processedNotebooks.length === 1 ? "notebook" : "notebooks"}
          </span>
        </div>

        {loadError && (
          <div role="alert" className="mb-6 flex items-center gap-2.5 rounded-[var(--radius-dialog)] border border-rust/30 bg-rust/[0.06] px-4 py-3 text-small text-rust">
            <WarningCircle size={ICON.md} weight="light" />
            The desk could not read your library. No data was removed.
          </div>
        )}

        {/* Grid View Mode */}
        {notebooks.length === 0 && !loadError ? (
          <StartHero onCreate={openCreateModal} onOpenFile={pickFile} />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1st Card: + Create new notebook — same family as studio shelf. */}
            <div className="anim-rise h-full" style={{ ["--d" as string]: staggerDelay(0) }}>
              <button
                onClick={openCreateModal}
                className="card-wake group flex min-h-[175px] h-full w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-dialog)] border border-dashed border-hairline-strong bg-surface/30 p-5 text-center"
              >
                <CreateNotebookEmblem />
                <span className="font-display text-lead font-[450] text-ink/90 group-hover:text-brass">
                  Create new notebook
                </span>
              </button>
            </div>

            {/* Notebook Cards */}
            <AnimatePresence>
              {processedNotebooks.map((nb, i) => {
                const isMenuOpen = menuOpenId === nb.id;

                return (
                  <Spotlight
                    key={nb.id}
                    className="anim-rise h-full rounded-[var(--radius-dialog)]"
                    style={{ ["--d" as string]: staggerDelay(i + 1) }}
                    radius={200}
                  >
                    <motion.div
                      layout
                      initial={false}
                      exit={{ opacity: 0 }}
                      transition={SOFT}
                      className="card-wake group relative flex min-h-[175px] h-full flex-col justify-between rounded-[var(--radius-dialog)] border border-hairline bg-surface/70 p-5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-t-[var(--radius-dialog)] before:bg-gradient-to-r before:from-brass/70 before:via-moon/40 before:to-sage/50"
                    >
                      {/* Top Row: Study Glyph & 3-Dot Menu */}
                      <div className="flex items-start justify-between">
                        <StudyGlyph name={nb.name} size="md" bare />

                        {/* 3-Dot Context Menu */}
                        <div className="relative" data-notebook-menu>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(isMenuOpen ? null : nb.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink transition-colors"
                            aria-label="Notebook options"
                          >
                            <DotsThreeVertical size={ICON.lg} weight="bold" />
                          </button>

                          <AnimatePresence>
                            {isMenuOpen && (
                              <motion.div
                                initial={POPOVER.initial}
                                animate={POPOVER.animate}
                                exit={{ ...POPOVER.exit, transition: EXIT }}
                                transition={SOFT}
                                className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-[var(--radius-control)] border border-hairline bg-surface p-1 shadow-modal"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(null);
                                    setRenamingNotebook(nb);
                                    setRenameDraft(nb.name);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-small text-ink hover:bg-ink/[0.06]"
                                >
                                  <PencilSimple size={ICON.sm} />
                                  Rename
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleExport(nb);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-small text-ink hover:bg-ink/[0.06]"
                                >
                                  <DownloadSimple size={ICON.sm} />
                                  Export
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(null);
                                    setSending(nb);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-small text-ink hover:bg-ink/[0.06]"
                                >
                                  <DeviceMobile size={ICON.sm} />
                                  Send to device
                                </button>
                                <div className="my-1 border-t border-hairline" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingId(nb.id);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-small text-rust hover:bg-rust/10"
                                >
                                  <Trash size={ICON.sm} />
                                  Delete
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Main Title & Open Action */}
                      <button
                        onClick={() => onOpenResume(nb.id)}
                        className="my-3 text-left"
                      >
                        <h3 className="line-clamp-2 font-display text-lead font-[450] leading-snug text-ink transition-colors group-hover:text-brass">
                          {nb.name}
                        </h3>
                      </button>

                      {/* Footer Meta Row (Screenshot 1 format: "Oct 6, 2025 · 1 source") */}
                      <div className="flex items-center text-small text-muted">
                        <span>{formatDate(nb.updatedAt)}</span>
                        <span className="mx-1.5 text-muted">·</span>
                        <span>
                          {nb.sourceCount} {nb.sourceCount === 1 ? "source" : "sources"}
                        </span>
                        {examCountdown(nb) && (
                          <>
                            <span aria-hidden="true" className="mx-1.5 text-muted">·</span>
                            <span className="font-[560] text-brass">{examCountdown(nb)}</span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  </Spotlight>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* List View Mode */
          <div className="divide-y divide-hairline rounded-[var(--radius-dialog)] border border-hairline bg-surface/50 overflow-hidden">
            {processedNotebooks.map((nb, i) => {
              return (
                <div
                  key={nb.id}
                  className="anim-rise group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-ink/[0.025] transition-colors"
                  style={{ ["--d" as string]: staggerDelay(i) }}
                >
                  <button
                    onClick={() => onOpenResume(nb.id)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                  >
                    <StudyGlyph name={nb.name} size="sm" bare />
                    <div className="min-w-0">
                      <span className="block truncate font-display text-lead font-[450] text-ink group-hover:text-brass">
                        {nb.name}
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center gap-6 text-small text-muted">
                    {examCountdown(nb) && (
                      <span className="font-[560] text-brass">{examCountdown(nb)}</span>
                    )}
                    <span className="rounded-[var(--radius-pill)] bg-ink/[0.04] px-2.5 py-0.5 text-small tabular-nums">
                      {nb.sourceCount} {nb.sourceCount === 1 ? "source" : "sources"}
                    </span>
                    <span className="w-28 text-right">{timeAgo(nb.updatedAt)}</span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setRenamingNotebook(nb);
                          setRenameDraft(nb.name);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink"
                        title="Rename"
                      >
                        <PencilSimple size={ICON.sm} />
                      </button>
                      <button
                        onClick={() => setDeletingId(nb.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-rust/10 hover:text-rust"
                        title="Delete"
                      >
                        <Trash size={ICON.sm} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {processedNotebooks.length === 0 && (
              <div className="px-6 py-10 text-center text-muted text-small">
                No notebooks match your search.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Notebook Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => {
          if (!createPending) setCreateModalOpen(false);
        }}
        title="Create new notebook"
      >        <div className="space-y-5">
          <Field label="Notebook name" hint="e.g. Comparison of Android 15 and iOS 18, Cellular Biology, etc.">
            <input
              data-autofocus
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder="Enter notebook title"
              className={inputCls}
              disabled={createPending}
            />
          </Field>
          {createError && (
            <p role="alert" className="text-small leading-relaxed text-rust">
              {createError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              className={btnGhost}
              onClick={() => setCreateModalOpen(false)}
              disabled={createPending}
            >
              Cancel
            </button>
            <button
              className={btnLamp}
              onClick={() => void handleCreate()}
              disabled={createPending || !newNotebookName.trim()}
            >
              {createPending ? "Creating…" : "Create notebook"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Rename Notebook Modal */}
      <Modal
        open={renamingNotebook !== null}
        onClose={() => setRenamingNotebook(null)}
        title="Rename notebook"
      >
        <div className="space-y-5">
          <Field label="Notebook name">
            <input
              data-autofocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleRename()}
              className={inputCls}
            />
          </Field>
          <div className="flex justify-end gap-3">
            <button className={btnGhost} onClick={() => setRenamingNotebook(null)}>
              Cancel
            </button>
            <button
              className={btnLamp}
              onClick={() => void handleRename()}
              disabled={!renameDraft.trim()}
            >
              Save changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="Delete notebook"
      >
        <div className="space-y-4">
          <p className="text-body leading-relaxed text-muted">
            Are you sure you want to delete this notebook? All sources, notes, and study history inside it will be permanently deleted from this device.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button className={btnGhost} onClick={() => setDeletingId(null)}>
              Cancel
            </button>
            <button
              onClick={() => deletingId && void handleDelete(deletingId)}
              className="rounded-[var(--radius-control)] bg-rust px-4 py-2 text-small font-medium text-white hover:brightness-110 active:scale-95 transition-all"
            >
              Delete permanently
            </button>
          </div>
        </div>
      </Modal>

      {sending && <SendToDeviceDialog notebook={sending} onClose={() => setSending(null)} />}
      {receiving && (
        <ReceiveFromDeviceDialog
          onClose={() => setReceiving(false)}
          onReceived={(result) => {
            setReceiving(false);
            onOpenResume(result.notebookId);
          }}
        />
      )}
    </main>
  );
}

/** The empty-desk welcome: what a notebook is for, before the first one
    exists. Mirrors the web shelf's start section in desk clothes. */
function StartHero({ onCreate, onOpenFile }: { onCreate: () => void; onOpenFile: () => void }) {
  return (
    <section
      aria-labelledby="desk-start-title"
      className="grid gap-8 rounded-[var(--radius-dialog)] border border-hairline bg-surface/40 p-7 sm:p-9 lg:grid-cols-[1.15fr_1fr] lg:gap-12"
    >
      <div>
        <span className="text-small font-medium text-brass">
          A notebook of your own
        </span>
        <h2 id="desk-start-title" className="mt-3 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-[450] leading-tight text-ink">
          What are you working on?
        </h2>
        <p className="mt-3 max-w-md text-body leading-relaxed text-muted">
          A course. An exam. A question that will not leave you alone. Give it a notebook, and keep
          the reading, the questions, and the practice in one place.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onCreate} className={btnLamp}>
            <span className="inline-flex items-center gap-2">
              <Plus size={ICON.md} weight="bold" aria-hidden="true" />
              New notebook
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenFile}
            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-hairline px-3.5 py-2 text-body text-muted transition-colors hover:border-hairline-strong hover:text-ink"
          >
            <FolderOpen size={ICON.md} aria-hidden="true" />
            Open a notebook file
          </button>
        </div>
        <p className="mt-4 text-label text-muted">Start with a name. Add the material as you go.</p>
      </div>
      <div className="rounded-[var(--radius-dialog)] border border-hairline bg-ground/60 p-5">
        <div className="flex items-center gap-2 text-label text-muted">
          <BookOpen size={ICON.lg} aria-hidden="true" />
          <span>Inside your notebook</span>
        </div>
        <ol className="mt-4 grid gap-4">
          <li>
            <h3 className="text-body font-semibold text-ink">Add your sources</h3>
            <p className="mt-1 text-body leading-relaxed text-muted">
              Documents, links, or your own notes. Drag them anywhere in the window.
            </p>
          </li>
          <li>
            <h3 className="text-body font-semibold text-ink">Talk it through</h3>
            <p className="mt-1 text-body leading-relaxed text-muted">
              Ask questions and follow answers back to the passage they came from.
            </p>
          </li>
          <li>
            <h3 className="text-body font-semibold text-ink">Make it stick</h3>
            <p className="mt-1 text-body leading-relaxed text-muted">
              Turn the material into quizzes, flashcards, and a study plan.
            </p>
          </li>
        </ol>
      </div>
    </section>
  );
}
