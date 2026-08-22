import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plus, SidebarSimple, Trash } from "@phosphor-icons/react";
import { liveQuery } from "dexie";
import { db, deleteNotebook } from "../lib/db";
import type { Notebook } from "../lib/types";
import { SPRING, Spotlight } from "../studio/fx";
import { timeAgo } from "../studio/ui";

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
  onSelect,
  onNew,
  onDeleted,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Fired after a notebook row is deleted, so the shell can land somewhere safe. */
  onDeleted: (id: string) => void;
}) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsed);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const sub = liveQuery(() => db.notebooks.orderBy("updatedAt").reverse().toArray()).subscribe({
      next: (rows) => setNotebooks(rows ?? []),
      error: () => setNotebooks([]),
    });
    return () => sub.unsubscribe();
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      saveCollapsed(!c);
      return !c;
    });
  };

  const remove = async (id: string) => {
    await deleteNotebook(id);
    onDeleted(id);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? SLIM : WIDE }}
      transition={SPRING}
      className="relative z-20 flex shrink-0 flex-col overflow-hidden border-r border-hairline bg-ground"
    >
      {/* Rail head */}
      <div className="flex h-10 shrink-0 items-center px-2.5">
        {collapsed ? (
          <button
            onClick={toggle}
            className="mx-auto flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-ink/5 hover:text-ink"
            aria-label="Expand library"
          >
            <SidebarSimple size={15} weight="light" />
          </button>
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
              <SidebarSimple size={15} weight="light" />
            </button>
          </>
        )}
      </div>

      {/* New notebook */}
      <div className="shrink-0 px-2 pb-1">
        {collapsed ? (
          <button
            onClick={onNew}
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-md border border-brass/25 bg-brass/[0.08] text-brasspale hover:bg-brass/[0.14]"
            aria-label="New notebook"
            title="New notebook"
          >
            <Plus size={15} weight="light" />
          </button>
        ) : (
          <button
            onClick={onNew}
            className="flex h-8 w-full items-center gap-2 rounded-md border border-brass/25 bg-brass/[0.08] px-2.5 text-[12.5px] text-brasspale hover:bg-brass/[0.14]"
          >
            <Plus size={14} weight="light" />
            New notebook
          </button>
        )}
      </div>

      {/* Notebooks */}
      <div
        className={`scroll-thin min-h-0 flex-1 overflow-y-auto py-1 ${collapsed ? "px-1.5" : "px-2"}`}
      >
        {notebooks.map((nb, i) =>
          collapsed ? (
            <div key={nb.id} className="anim-rise" style={{ ["--d" as string]: `${i * 40}ms` }}>
              <RailItemSlim notebook={nb} active={nb.id === activeId} onSelect={onSelect} />
            </div>
          ) : (
            <div key={nb.id} className="anim-rise" style={{ ["--d" as string]: `${i * 40}ms` }}>
              <RailItemWide
                notebook={nb}
                active={nb.id === activeId}
                confirming={confirming === nb.id}
                onSelect={onSelect}
                onConfirmToggle={() => setConfirming((c) => (c === nb.id ? null : nb.id))}
                onCancelConfirm={() => setConfirming((c) => (c === nb.id ? null : c))}
                onDelete={() => void remove(nb.id)}
              />
            </div>
          ),
        )}
        {!collapsed && notebooks.length === 0 && (
          <p className="px-2 pt-3 text-[12px] leading-relaxed text-muted">
            No notebooks yet. One per subject works best.
          </p>
        )}
      </div>
    </motion.aside>
  );
}

function LetterTile({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "·";
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 select-none items-center justify-center rounded bg-brass/10 font-mono text-[10px] tracking-normal text-brasspale">
      {letter}
    </span>
  );
}

function RailItemWide({
  notebook,
  active,
  confirming,
  onSelect,
  onConfirmToggle,
  onCancelConfirm,
  onDelete,
}: {
  notebook: Notebook;
  active: boolean;
  confirming: boolean;
  onSelect: (id: string) => void;
  onConfirmToggle: () => void;
  onCancelConfirm: () => void;
  onDelete: () => void;
}) {
  return (
    <Spotlight className="group relative rounded-md" radius={180} onBlur={onCancelConfirm}>
      {active && (
        <span className="pointer-events-none absolute inset-y-[7px] left-0 w-[2px] rounded-full bg-brass shadow-[0_0_8px_rgba(227,176,75,0.45)]" />
      )}
      <button
        onClick={() => onSelect(notebook.id)}
        className={`relative flex w-full items-center gap-2.5 rounded-md px-2 py-[7px] text-left transition-colors duration-150 ${
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
        onClick={() => (confirming ? onDelete() : onConfirmToggle())}
        className={`absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] opacity-0 transition-opacity group-hover:opacity-100 ${
          confirming ? "!opacity-100 bg-rust/15 text-rust" : "text-muted/60 hover:text-rust"
        }`}
        aria-label={confirming ? "Confirm delete" : "Delete notebook"}
      >
        <Trash size={13} weight="light" />
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
      className={`group relative mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-md ${
        active ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
      }`}
    >
      {active && (
        <span className="pointer-events-none absolute inset-y-[6px] -left-[6px] w-[2px] rounded-full bg-brass shadow-[0_0_8px_rgba(227,176,75,0.45)]" />
      )}
      <LetterTile name={notebook.name} />
    </button>
  );
}
