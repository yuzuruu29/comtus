import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown, PencilSimple, Plus, SlidersHorizontal, Trash } from "@phosphor-icons/react";
import { IconButton, Input } from "../ui";
import type { ChatSession } from "../lib/types";
import { SOFT } from "./fx";
import { timeAgo } from "./ui";

/** Top chat bar: active-session trigger, new/settings icon buttons, and the
 *  sessions dropdown (rename-in-place, delete, "New chat"). Fully
 *  self-contained — ChatPane only supplies data + mutation callbacks. */
export default function SessionMenu({
  sessions,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const startRename = (session: ChatSession) => {
    setRenamingId(session.id);
    setRenameDraft(session.title);
  };

  const commitRename = () => {
    const id = renamingId;
    const title = renameDraft.replace(/\s+/g, " ").trim();
    setRenamingId(null);
    if (!id || !title) return;
    onRename(id, title);
  };

  return (
    <div
      ref={menuRef}
      className="relative z-30 flex h-11 shrink-0 items-center justify-between border-b border-hairline bg-ground px-4"
    >
      <div className="flex items-center gap-2">
        <h2 className="font-display text-heading font-[450] text-ink">Chat</h2>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface/60 px-2.5 py-0.5 text-label text-muted hover:border-hairline-strong hover:text-ink transition-colors"
        >
          <span className="truncate max-w-[14rem]">{activeSession?.title || "New chat"}</span>
          <CaretDown size={11} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <IconButton size="sm" aria-label="New chat thread" title="New chat" onClick={onNew}>
          <Plus size={14} weight="light" />
        </IconButton>
        <IconButton
          size="sm"
          aria-label="Chat settings & sessions"
          title="Chat settings & sessions"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <SlidersHorizontal size={14} weight="light" />
        </IconButton>
      </div>

      {/* Sessions Dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={SOFT}
            role="listbox"
            className="absolute left-4 top-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-[var(--radius-dialog)] border border-hairline bg-surface p-1 shadow-modal"
          >
            <div className="max-h-60 overflow-y-auto py-1">
              {sessions.map((session) => {
                const isActive = session.id === activeId;
                const isRenaming = renamingId === session.id;

                if (isRenaming) {
                  return (
                    <div key={session.id} className="p-1">
                      <Input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="!py-1 !text-[12.5px]"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={session.id}
                    className={`group relative flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-2.5 py-1 text-left text-[12.5px] transition-colors ${
                      isActive
                        ? "bg-brass/10 text-brasspale font-medium"
                        : "text-muted hover:bg-ink/[0.04] hover:text-ink"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onSelect(session.id);
                      }}
                      className="truncate min-w-0 flex-1 py-0.5 text-left outline-none cursor-pointer focus-visible:underline"
                    >
                      {session.title || "New chat"}
                    </button>

                    {/* Right-hand slot: timestamp at rest, swaps smoothly to edit/delete buttons on hover */}
                    <div className="relative flex items-center justify-end shrink-0 pl-2">
                      <span
                        className={`font-mono text-[9px] text-muted/60 transition-all duration-200 ${
                          "opacity-70 group-hover:opacity-0 group-hover:invisible group-hover:scale-95"
                        }`}
                      >
                        {timeAgo(session.updatedAt)}
                      </span>

                      <div className="absolute right-0 flex items-center gap-0.5 opacity-0 translate-x-1 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(session);
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted/70 hover:bg-ink/[0.08] hover:text-ink transition-colors"
                          title="Rename"
                          aria-label="Rename"
                        >
                          <PencilSimple size={12} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(session.id);
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted/70 hover:bg-rust/15 hover:text-rust transition-colors"
                          title="Delete"
                          aria-label="Delete"
                        >
                          <Trash size={12} weight="bold" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                onNew();
              }}
              className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2 text-[12px] font-medium text-brasspale hover:bg-brass/[0.06] transition-colors"
            >
              <Plus size={13} />
              New chat
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
