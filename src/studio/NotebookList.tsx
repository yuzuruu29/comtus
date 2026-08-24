import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  DotsThreeVertical,
  DownloadSimple,
  ListDashes,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SquaresFour,
  Trash,
  X,
} from "@phosphor-icons/react";
import { db, createNotebook, deleteNotebook, touchNotebook } from "../lib/db";
import type { Notebook, Source } from "../lib/types";
import { detectPlatform, isTauri } from "../lib/desktop";
import StudyGlyph from "../components/icons/StudyGlyph";
import ComtusLogo, { ComtusEmblem } from "../components/brand/ComtusLogo";
import { ByokBadge, ProBadge, SettingsButton, CreateNotebookEmblem } from "../components/brand/BrandControls";
import { SOFT, Spotlight } from "./fx";
import { timeAgo, Modal, Field, inputCls, btnLamp, btnGhost } from "./ui";
import SettingsModal from "./SettingsModal";
import DeskShell from "./DeskShell";
import CaptionButtons from "./Titlebar";
import { useSettings } from "../lib/settings";

type SortOption = "recent" | "az" | "oldest" | "sources";

interface NotebookWithCount extends Notebook {
  sourceCount: number;
}

export default function NotebookList({
  onOpen,
  needsKey,
}: {
  onOpen: (id: string) => void;
  needsKey: boolean;
}) {
  const [notebooks, setNotebooks] = useState<NotebookWithCount[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(needsKey);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"all" | "my">("all");
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const [renamingNotebook, setRenamingNotebook] = useState<Notebook | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortMenuRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const allNotebooks = await db.notebooks.toArray();
    const allSources = await db.sources.toArray();

    const sourceCountMap = new Map<string, number>();
    for (const s of allSources) {
      sourceCountMap.set(s.notebookId, (sourceCountMap.get(s.notebookId) ?? 0) + 1);
    }

    setNotebooks(
      allNotebooks.map((nb) => ({
        ...nb,
        sourceCount: sourceCountMap.get(nb.id) ?? 0,
      })),
    );
  };

  useEffect(() => {
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
          onOpen(nb.id);
          return;
        }
      } catch {}
      void refresh();
    };
    void handleKickstart();
  }, [onOpen]);

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
    setName("");
    setCreating(true);
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const nb = await createNotebook(trimmed);
    setCreating(false);
    setName("");
    onOpen(nb.id);
  };

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
    setMenuOpenId(null);
    void refresh();
  };

  const handleExport = async (nb: Notebook) => {
    setMenuOpenId(null);
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

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <DeskShell onSettings={() => setSettingsOpen(true)} onNewNotebook={openCreateModal}>
      <div className="min-h-[100svh] bg-ground">
        <div className="pointer-events-none fixed inset-x-0 top-0 h-[45vh] bg-[radial-gradient(75%_100%_at_50%_0%,rgba(227,176,75,0.06),transparent_80%)]" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 sm:px-10 lg:px-12">
          <ShelfHeader onSettings={() => setSettingsOpen(true)} />

          {needsKey && (
            <div className="mt-4 mb-6 rounded-[var(--radius-dialog)] border border-brass/30 bg-brass/[0.06] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5">
                  <ComtusEmblem size={22} breathe className="mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[14px] font-medium text-ink">Light the lamp</div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                      Connect OpenRouter with free models, Claude via PayPal, or run offline with Ollama / LM Studio.
                    </p>
                  </div>
                </div>
                <button onClick={() => setSettingsOpen(true)} className={btnLamp}>
                  Configure key
                </button>
              </div>
            </div>
          )}

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
                  className="h-9 w-44 rounded-[var(--radius-control)] border border-hairline bg-surface/50 pl-8 pr-3 text-[12.5px] text-ink placeholder:text-muted/60 outline-none transition-all duration-200 hover:border-brass/35 focus:w-60 focus:border-brass/70 focus:bg-surface focus:shadow-[0_0_0_1px_rgba(227,176,75,0.4),0_0_16px_-2px_rgba(227,176,75,0.25)]"
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
                    viewMode === "grid" ? "bg-ink/[0.08] text-brasspale" : "text-muted hover:text-ink"
                  }`}
                  title="Grid view"
                  aria-label="Grid view"
                >
                  <SquaresFour size={16} weight={viewMode === "grid" ? "fill" : "light"} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-colors ${
                    viewMode === "list" ? "bg-ink/[0.08] text-brasspale" : "text-muted hover:text-ink"
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
                  className="flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-hairline bg-surface/60 px-3 text-[12.5px] font-medium text-muted hover:text-ink hover:border-brass/35 transition-all"
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

          {/* Section Heading */}
          <div className="mt-8 mb-5 flex items-baseline justify-between">
            <h2 className="font-display text-[1.45rem] font-[450] text-ink">Recent notebooks</h2>
            <span className="font-mono text-[11px] text-muted">
              {processedNotebooks.length} {processedNotebooks.length === 1 ? "notebook" : "notebooks"}
            </span>
          </div>

          {/* Grid View Mode */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* 1st Card: + Create new notebook */}
              <button
                onClick={openCreateModal}
                className="group flex min-h-[175px] flex-col items-center justify-center gap-3 rounded-[var(--radius-dialog)] border border-dashed border-hairline-strong bg-surface/30 p-5 text-center transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-brass/60 hover:bg-brass/[0.04] hover:shadow-[0_14px_30px_-6px_rgba(227,176,75,0.16)] active:scale-[0.98]"
              >
                <CreateNotebookEmblem />
                <span className="font-display text-[15px] font-[450] text-ink/90 group-hover:text-brasspale">
                  Create new notebook
                </span>
              </button>

              {/* Notebook Cards */}
              <AnimatePresence initial={false}>
                {processedNotebooks.map((nb) => {
                  const isMenuOpen = menuOpenId === nb.id;

                  return (
                    <Spotlight
                      key={nb.id}
                      className="rounded-[var(--radius-dialog)]"
                      radius={200}
                    >
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={SOFT}
                        className="group relative flex min-h-[175px] flex-col justify-between rounded-[var(--radius-dialog)] border border-hairline bg-surface/70 p-5 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-brass/50 hover:bg-surface hover:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.5),0_0_24px_-4px_rgba(227,176,75,0.18)] active:scale-[0.985]"
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
                          onClick={() => onOpen(nb.id)}
                          className="my-3 text-left outline-none"
                        >
                          <h3 className="line-clamp-2 font-display text-[16px] font-[450] leading-snug text-ink transition-colors group-hover:text-brasspale">
                            {nb.name}
                          </h3>
                        </button>

                        {/* Footer Meta Row */}
                        <div className="flex items-center text-[11.5px] text-muted">
                          <span>{formatDate(nb.updatedAt)}</span>
                          <span className="mx-1.5 text-muted/60">·</span>
                          <span>
                            {nb.sourceCount} {nb.sourceCount === 1 ? "source" : "sources"}
                          </span>
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
              {processedNotebooks.map((nb) => {
                return (
                  <div
                    key={nb.id}
                    className="group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-ink/[0.025] transition-colors"
                  >
                    <button
                      onClick={() => onOpen(nb.id)}
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
        <Modal open={creating} onClose={() => setCreating(false)} title="New notebook">
          <div className="space-y-5">
            <Field label="Name" hint="e.g. Comparison of Android 15 and iOS 18">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void create()}
                placeholder="Name this notebook"
                className={inputCls}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <button className={btnGhost} onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className={btnLamp} onClick={() => void create()} disabled={!name.trim()}>
                Create
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

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </DeskShell>
  );
}

function ShelfHeader({ onSettings }: { onSettings: () => void }) {
  const tauri = isTauri();
  const platform = detectPlatform();
  const macPad = tauri && platform === "mac";

  const isPro = useSettings((s) => Boolean(s.isPro && s.planTier !== "free"));
  const planTier = useSettings((s) => s.planTier);
  const tokenBalance = useSettings((s) => s.tokenBalance || 0);
  const tokensUsed = useSettings((s) => s.tokensUsed || 0);
  const remainingTokens = Math.max(0, tokenBalance - tokensUsed);

  return (
    <header
      data-tauri-drag-region={tauri ? true : undefined}
      className={`desk-header flex items-center justify-between pb-6 pt-[calc(1.25rem+var(--sat))] border-b border-hairline ${macPad ? "pl-[78px]" : ""}`}
    >
      {tauri ? (
        <div className="flex select-none items-center">
          <ComtusLogo variant="full" size="sm" />
        </div>
      ) : (
        <Link to="/" className="flex items-center" aria-label="Back to landing">
          <ComtusLogo variant="full" size="sm" />
        </Link>
      )}
      <div className="no-drag flex items-center gap-2.5">
        <SettingsButton onClick={onSettings} />

        {/* Plan Status Badge */}
        {isPro ? (
          <ProBadge
            planTier={planTier}
            remainingTokens={remainingTokens}
            onClick={onSettings}
          />
        ) : (
          <ByokBadge onClick={onSettings} />
        )}

        <CaptionButtons />
      </div>
    </header>
  );
}
