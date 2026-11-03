import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { IconButton, Input } from "../ui";
import type { ChatSession } from "../lib/types";
import { EXIT, POPOVER, SOFT } from "./fx";
import { timeAgo } from "./ui";
import { ICON } from "../ui/iconScale";

/** Top chat bar: active-session trigger, new conversation action, and the
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
      className="pane-head chat-session-head relative z-30"
    >
      <div className="pane-head-title">
        <span className="pane-index" aria-hidden="true">02</span>
        <h2>Chat</h2>
      </div>
      <div className="pane-head-actions chat-session-actions">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Switch conversation"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          className="chat-session-trigger"
        >
          <span>{activeSession?.title || "New conversation"}</span>
          <CaretDown size={ICON.xs} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        <IconButton size="sm" aria-label="New chat thread" title="New chat" onClick={onNew}>
          <Plus size={ICON.lg} weight="light" />
        </IconButton>
      </div>

      {/* Sessions Dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={POPOVER.initial}
            animate={POPOVER.animate}
            exit={{ ...POPOVER.exit, transition: EXIT }}
            transition={SOFT}
            role="dialog"
            aria-label="Conversations"
            className="chat-session-menu"
          >
            <p className="chat-session-menu-label">Conversations in this notebook</p>
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
                        aria-label="Conversation name"
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="!py-1 !text-small"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={session.id}
                    className={`group relative flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-2.5 py-1 text-left text-small transition-colors ${
                      isActive
                        ? "bg-brass/10 text-brass font-medium"
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

                    <div className="chat-session-row-actions">
                      <span className="chat-session-time">
                        {timeAgo(session.updatedAt)}
                      </span>
                      <div className="chat-session-edit-actions">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(session);
                          }}
                          className="chat-session-edit"
                          title="Rename"
                          aria-label={`Rename ${session.title || "New chat"}`}
                        >
                          <PencilSimple size={ICON.xs} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(session.id);
                          }}
                          className="chat-session-edit chat-session-delete"
                          title="Delete"
                          aria-label={`Delete ${session.title || "New chat"}`}
                        >
                          <Trash size={ICON.xs} weight="bold" />
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
              className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2 text-small font-medium text-brass hover:bg-brass/[0.06] transition-colors"
            >
              <Plus size={ICON.sm} />
              New chat
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
