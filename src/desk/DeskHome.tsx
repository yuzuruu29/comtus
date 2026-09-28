import { useEffect, useRef, useState, useMemo } from "react";
import {
  DotsThreeVertical,
  DownloadSimple,
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
import { exportNotebook } from "../lib/backup";
import type { Notebook } from "../lib/types";
import StudyGlyph from "../components/icons/StudyGlyph";
import ComtusLogo from "../components/brand/ComtusLogo";
import { ByokBadge, ProBadge, SettingsButton, CreateNotebookEmblem } from "../components/brand/BrandControls";
import { SOFT, Spotlight, staggerDelay } from "../studio/fx";
import { Modal, Field, inputCls, btnLamp, btnGhost, timeAgo } from "../studio/ui";
import { examCountdown } from "../lib/exam";
import { AnimatePresence, motion } from "motion/react";
import { useSettings } from "../lib/settings";
import ReviewDueStrip from "../studio/ReviewDueStrip";

type SortOption = "recent" | "az" | "oldest" | "sources";

interface NotebookWithCount extends Notebook {
  sourceCount: number;
}

export default function DeskHome({
  hasKey: _hasKey,
  onOpenResume,
  onOpenWork,
  onNew: _onNew,
  onSettings,
}: {
  hasKey: boolean;
  resume: Notebook | null;
  modelLabel: string;
  effortLabel: string;
  onOpenResume: (id: string) => void;
  onOpenWork: (notebookId: string, generationId: string) => void;
  onNew: () => void;
  onImport: () => void;
  onSettings: () => void;
}) {
  const isPro = useSettings((s) => Boolean(s.isPro && s.planTier !== "free"));
  const planTier = useSettings((s) => s.planTier);
  const tokenBalance = useSettings((s) => s.tokenBalance || 0);
  const tokensUsed = useSettings((s) => s.tokensUsed || 0);
  const remainingTokens = Math.max(0, tokenBalance - tokensUsed);

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
                remainingTokens={remainingTokens}
                onClick={onSettings}
              />
            ) : (
              <ByokBadge onClick={onSettings} />
            )}
          </div>
        </div>

        {/* Filter & View Controls Toolbar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Tab Pills */}
          <div className="flex items-center gap-1.5 rounded-[var(--radius-control)] bg-surface/80 p-1 border border-hairline">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-[var(--radius-control)] px-3.5 py-1 text-[13px] font-medium transition-all ${
                activeTab === "all"
                  ? "bg-brass/15 text-brasspale shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("my")}
              className={`rounded-[var(--radius-control)] px-3.5 py-1 text-[13px] font-medium transition-all ${
                activeTab === "my"
                  ? "bg-brass/15 text-brasspale shadow-sm"
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
                size={14}
                weight="light"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notebooks…"
                className="h-9 w-44 rounded-[var(--radius-control)] border border-hairline bg-surface/50 pl-8 pr-3 text-[12.5px] text-ink placeholder:text-muted/60 outline-none transition-all focus:w-60 focus:border-brass/40 focus:bg-surface"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-[var(--radius-control)] border border-hairline bg-surface/60 p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-colors ${
                  viewMode === "grid"
                    ? "bg-ink/[0.08] text-brasspale"
                    : "text-muted hover:text-ink"
                }`}
                title="Grid view"
                aria-label="Grid view"
              >
                <SquaresFour size={16} weight={viewMode === "grid" ? "fill" : "light"} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-colors ${
                  viewMode === "list"
                    ? "bg-ink/[0.08] text-brasspale"
                    : "text-muted hover:text-ink"
                }`}
                title="List view"
                aria-label="List view"
              >
                <ListDashes size={16} weight={viewMode === "list" ? "bold" : "light"} />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div ref={sortMenuRef} className="relative">
              <button
                onClick={() => setSortMenuOpen((v) => !v)}
                className="flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-hairline bg-surface/60 px-3 text-[12.5px] font-medium text-muted hover:text-ink transition-colors"
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
                <span className="text-[10px] text-muted">▾</span>
              </button>

              <AnimatePresence>
                {sortMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
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
                        className={`flex w-full items-center px-3 py-2 text-left text-[12.5px] rounded-[var(--radius-control)] transition-colors ${
                          sortOption === opt.id
                            ? "bg-brass/10 text-brasspale font-medium"
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

            {/* + Create New Button */}
            <button
              onClick={openCreateModal}
              className="flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] grad-lamp px-4 text-[13px] font-semibold text-night shadow-sm hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <Plus size={15} weight="bold" />
              <span>Create new</span>
            </button>
          </div>
        </div>

        <ReviewDueStrip onReview={onOpenWork} />

        {/* Section Heading */}
        <div className="mt-8 mb-5 flex items-baseline justify-between">
          <h2 className="font-display text-[1.45rem] font-[450] text-ink">
            Recent notebooks
          </h2>
          <span className="font-mono text-[11px] text-muted">
            {processedNotebooks.length} {processedNotebooks.length === 1 ? "notebook" : "notebooks"}
          </span>
        </div>

        {loadError && (
          <div role="alert" className="mb-6 flex items-center gap-2.5 rounded-xl border border-rust/30 bg-rust/[0.06] px-4 py-3 text-[13px] text-rust">
            <WarningCircle size={16} weight="light" />
            The desk could not read your library. No data was removed.
          </div>
        )}

        {/* Grid View Mode */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1st Card: + Create new notebook — same family as studio shelf. */}
            <div className="anim-rise h-full" style={{ ["--d" as string]: staggerDelay(0) }}>
              <button
                onClick={openCreateModal}
                className="card-wake group flex min-h-[175px] h-full w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-dialog)] border border-dashed border-hairline-strong bg-surface/30 p-5 text-center"
              >
                <CreateNotebookEmblem />
                <span className="font-display text-[15px] font-[450] text-ink/90 group-hover:text-brasspale">
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
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={SOFT}
                      className="card-wake group relative flex min-h-[175px] h-full flex-col justify-between rounded-[var(--radius-dialog)] border border-hairline bg-surface/70 p-5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-t-[var(--radius-dialog)] before:bg-gradient-to-r before:from-brass/70 before:via-moon/40 before:to-sage/50"
                    >
                      {/* Top Row: Study Glyph & 3-Dot Menu */}
                      <div className="flex items-start justify-between">
                        <StudyGlyph name={nb.name} size="md" />

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
                            <DotsThreeVertical size={18} weight="bold" />
                          </button>

                          <AnimatePresence>
                            {isMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
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
                                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[12px] text-ink hover:bg-ink/[0.06]"
                                >
                                  <PencilSimple size={13} />
                                  Rename
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleExport(nb);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[12px] text-ink hover:bg-ink/[0.06]"
                                >
                                  <DownloadSimple size={13} />
                                  Export
                                </button>
                                <div className="my-1 border-t border-hairline" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingId(nb.id);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[12px] text-rust hover:bg-rust/10"
                                >
                                  <Trash size={13} />
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
                        className="my-3 text-left outline-none"
                      >
                        <h3 className="line-clamp-2 font-display text-[16px] font-[450] leading-snug text-ink transition-colors group-hover:text-brasspale">
                          {nb.name}
                        </h3>
                      </button>

                      {/* Footer Meta Row (Screenshot 1 format: "Oct 6, 2025 · 1 source") */}
                      <div className="flex items-center text-[11.5px] text-muted">
                        <span>{formatDate(nb.updatedAt)}</span>
                        <span className="mx-1.5 text-muted/60">·</span>
                        <span>
                          {nb.sourceCount} {nb.sourceCount === 1 ? "source" : "sources"}
                        </span>
                        {examCountdown(nb) && (
                          <>
                            <span className="mx-1.5 text-muted/60">·</span>
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
                    <StudyGlyph name={nb.name} size="sm" />
                    <div className="min-w-0">
                      <span className="block truncate font-display text-[15px] font-[450] text-ink group-hover:text-brasspale">
                        {nb.name}
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center gap-6 text-[12px] text-muted">
                    {examCountdown(nb) && (
                      <span className="font-[560] text-brass">{examCountdown(nb)}</span>
                    )}
                    <span className="rounded-full bg-ink/[0.04] px-2.5 py-0.5 font-mono text-[11px]">
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
                        <PencilSimple size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingId(nb.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-rust/10 hover:text-rust"
                        title="Delete"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {processedNotebooks.length === 0 && (
              <div className="px-6 py-10 text-center text-muted text-[13px]">
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
      >
        <div className="space-y-5">
          <Field label="Notebook name" hint="e.g. Comparison of Android 15 and iOS 18, Cellular Biology, etc.">
            <input
              autoFocus
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
            <p role="alert" className="text-[13px] leading-relaxed text-rust">
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
              autoFocus
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
          <p className="text-[13.5px] leading-relaxed text-muted">
            Are you sure you want to delete this notebook? All sources, notes, and study history inside it will be permanently deleted from this device.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button className={btnGhost} onClick={() => setDeletingId(null)}>
              Cancel
            </button>
            <button
              onClick={() => deletingId && void handleDelete(deletingId)}
              className="rounded-[var(--radius-control)] bg-rust px-4 py-2 text-[13px] font-medium text-white hover:brightness-110 active:scale-95 transition-all"
            >
              Delete permanently
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
