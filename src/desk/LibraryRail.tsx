import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { House, Plus, SidebarSimple, Trash, WarningCircle } from "@phosphor-icons/react";
import { liveQuery } from "dexie";
import { db, deleteNotebook } from "../lib/db";
import type { Notebook } from "../lib/types";
import { SPRING, Spotlight } from "../studio/fx";
import { btnGhost, Modal, timeAgo } from "../studio/ui";
import { useMediaQuery } from "../lib/useMediaQuery";
import { ICON } from "../ui/iconScale";

const WIDE = 236;
const SLIM = 52;

const RAIL_KEY = "comtus:rail-collapsed";

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
  } catch {
    /* private mode — collapse just won't persist */
  }
}

/** The persistent library. On the desk, notebooks are never a separate
    screen — the rail is always at hand, one click or ⌘K away. */
export default function LibraryRail({
  activeId,
  onHome,
  onSelect,
  onNew,
  onDeleted,
}: {
  activeId: string | null;
  onHome: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Fired after a notebook row is deleted, so the shell can land somewhere safe. */
  onDeleted: (id: string) => void;
}) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsed);
  const [deletingNotebook, setDeletingNotebook] = useState<Notebook | null>(null);
  const [loadError, setLoadError] = useState(false);
  const compactWindow = useMediaQuery("(max-width: 1199px)");

  useEffect(() => {
    const sub = liveQuery(() => db.notebooks.orderBy("updatedAt").reverse().toArray()).subscribe({
      next: (rows) => {
        setLoadError(false);
        setNotebooks(rows ?? []);
      },
      error: () => setLoadError(true),
    });
    return () => sub.unsubscribe();
  }, []);

  const toggle = () => {
    if (compactWindow) return;
    setCollapsed((c) => {
      saveCollapsed(!c);
      return !c;
    });
  };
  const railCollapsed = compactWindow || collapsed;

  const remove = async (id: string) => {
    await deleteNotebook(id);
    onDeleted(id);
  };

  return (
    <motion.aside
      aria-label="Library"
      initial={false}
      animate={{ width: railCollapsed ? SLIM : WIDE }}
      transition={SPRING}
      className="relative z-20 flex shrink-0 flex-col overflow-hidden border-r border-hairline bg-ground"
    >
      {/* Rail head */}
      <div className="flex h-10 shrink-0 items-center px-2.5">
        {railCollapsed ? (
          compactWindow ? (
            <span
              className="mx-auto flex h-7 w-7 items-center justify-center text-muted"
              title="Library stays compact at this window size"
              aria-hidden="true"
            >
              <SidebarSimple size={ICON.md} weight="light" />
            </span>
          ) : (
            <button
              onClick={toggle}
              className="mx-auto flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink"
              aria-label="Expand library"
            >
              <SidebarSimple size={ICON.md} weight="light" />
            </button>
          )
        ) : (
          <>
            <span className="select-none font-mono text-[10px] uppercase tracking-[0.26em] text-muted">
              Library
            </span>
            <button
              onClick={toggle}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink"
              aria-label="Collapse library"
            >
              <SidebarSimple size={ICON.md} weight="light" />
            </button>
          </>
        )}
      </div>

      {/* The desk home is a first-class location, not a one-time welcome screen. */}
      <div className="shrink-0 px-2 pb-1">
        {railCollapsed ? (
          <button
            onClick={onHome}
            className={`mx-auto flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink ${
              activeId === null ? "bg-ink/[0.06] text-brass" : ""
            }`}
            aria-label="Home"
            aria-current={activeId === null ? "page" : undefined}
            title="Home"
          >
            <House size={ICON.md} weight="light" />
          </button>
        ) : (
          <button
            onClick={onHome}
            className={`flex h-8 w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-[12.5px] hover:bg-ink/5 hover:text-ink ${
              activeId === null ? "bg-ink/[0.055] text-brass" : "text-muted"
            }`}
            aria-current={activeId === null ? "page" : undefined}
          >
            <House size={ICON.sm} weight="light" />
            Desk home
          </button>
        )}
      </div>

      {/* New notebook */}
      <div className="shrink-0 px-2 pb-1">
        {railCollapsed ? (
          <button
            onClick={onNew}
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border border-brass/25 bg-brass/[0.08] text-brass hover:bg-brass/[0.14]"
            aria-label="New notebook"
            title="New notebook"
          >
            <Plus size={ICON.md} weight="light" />
          </button>
        ) : (
          <button
            onClick={onNew}
            className="flex h-8 w-full items-center gap-2 rounded-[var(--radius-control)] border border-brass/25 bg-brass/[0.08] px-2.5 text-[12.5px] text-brass hover:bg-brass/[0.14]"
          >
            <Plus size={ICON.sm} weight="light" />
            New notebook
          </button>
        )}
      </div>

      {/* Notebooks */}
      <div
        className={`scroll-thin min-h-0 flex-1 overflow-y-auto py-1 ${railCollapsed ? "px-1.5" : "px-2"}`}
      >
        {notebooks.map((nb, i) =>
          railCollapsed ? (
            // House stagger: 30ms x row index — pairs with --stagger-step in index.css
            <div key={nb.id} className="anim-rise" style={{ ["--d" as string]: `${Math.min(i, 10) * 30}ms` }}>
              <RailItemSlim notebook={nb} active={nb.id === activeId} onSelect={onSelect} />
            </div>
          ) : (
            // House stagger: 30ms x row index — pairs with --stagger-step in index.css
            <div key={nb.id} className="anim-rise" style={{ ["--d" as string]: `${Math.min(i, 10) * 30}ms` }}>
              <RailItemWide
                notebook={nb}
                active={nb.id === activeId}
                onSelect={onSelect}
                onRequestDelete={() => setDeletingNotebook(nb)}
              />
            </div>
          ),
        )}
        {!railCollapsed && loadError && (
          <div role="alert" className="mx-1 mt-2 flex gap-2 rounded-[var(--radius-control)] border border-rust/25 bg-rust/[0.06] px-2.5 py-2 text-[11.5px] leading-relaxed text-rust">
            <WarningCircle size={ICON.sm} weight="light" className="mt-0.5 shrink-0" />
            <span>Library unavailable. Your data has not been removed.</span>
          </div>
        )}
        {!railCollapsed && !loadError && notebooks.length === 0 && (
          <p className="px-2 pt-3 text-[12px] leading-relaxed text-muted">
            No notebooks yet. One per subject works best.
          </p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deletingNotebook !== null}
        onClose={() => setDeletingNotebook(null)}
        title="Delete notebook"
      >
        <div className="space-y-4">
          <p className="text-[13.5px] leading-relaxed text-muted">
            Are you sure you want to remove/delete <strong className="font-medium text-ink">"{deletingNotebook?.name}"</strong>? All sources, notes, and study history inside it will be permanently deleted from this device.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className={btnGhost}
              onClick={() => setDeletingNotebook(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (deletingNotebook) {
                  void remove(deletingNotebook.id);
                  setDeletingNotebook(null);
                }
              }}
              className="rounded-[var(--radius-control)] bg-rust px-4 py-2 text-[13px] font-medium text-white hover:brightness-110 active:scale-95 transition-all"
            >
              Delete permanently
            </button>
          </div>
        </div>
      </Modal>
    </motion.aside>
  );
}

function LetterTile({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "·";
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 select-none items-center justify-center rounded bg-brass/10 font-mono text-[10px] tracking-normal text-brass">
      {letter}
    </span>
  );
}

function RailItemWide({
  notebook,
  active,
  onSelect,
  onRequestDelete,
}: {
  notebook: Notebook;
  active: boolean;
  onSelect: (id: string) => void;
  onRequestDelete: () => void;
}) {
  return (
    <Spotlight className="group relative rounded-[var(--radius-control)]" radius={180}>
      {active && (
        <span className="pointer-events-none absolute inset-y-[7px] left-0 w-[2px] rounded-[var(--radius-pill)] bg-brass shadow-[0_0_8px_rgba(227,176,75,0.45)]" />
      )}
      <button
        onClick={() => onSelect(notebook.id)}
        aria-current={active ? "page" : undefined}
        className={`relative flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-[7px] text-left transition-colors duration-med ${
          active ? "bg-ink/[0.055]" : "hover:bg-ink/[0.03]"
        }`}
        title={notebook.name}
      >
        <LetterTile name={notebook.name} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] leading-tight ${active ? "text-ink" : "text-ink/80"}`}>
            {notebook.name}
          </span>
          <span className="block truncate text-[10.5px] leading-tight text-muted">
            {timeAgo(notebook.updatedAt)}
          </span>
        </span>
      </button>
      <button
        onClick={onRequestDelete}
        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 text-muted hover:bg-rust/10 hover:text-rust"
        aria-label={`Delete ${notebook.name}`}
      >
        <Trash size={ICON.sm} weight="light" />
      </button>
    </Spotlight>
  );
}

function RailItemSlim({
  notebook,
  active,
  onSelect,
}: {
  notebook: Notebook;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(notebook.id)}
      title={notebook.name}
      aria-label={notebook.name}
      aria-current={active ? "page" : undefined}
      className={`group relative mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] ${
        active ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
      }`}
    >
      {active && (
        <span className="pointer-events-none absolute inset-y-[6px] -left-[6px] w-[2px] rounded-[var(--radius-pill)] bg-brass shadow-[0_0_8px_rgba(227,176,75,0.45)]" />
      )}
      <LetterTile name={notebook.name} />
    </button>
  );
}
