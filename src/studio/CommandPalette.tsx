import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Books,
  ChatCircle,
  ChatsCircle,
  Cpu,
  FileText,
  GearSix,
  House,
  MagnifyingGlass,
  Medal,
  Notebook,
  NotePencil,
  Plus,
  SidebarSimple,
} from "@phosphor-icons/react";
import { db } from "../lib/db";
import {
  hitHref,
  isSearchable,
  loadLibrarySnapshot,
  searchSnapshot,
  type LibraryHit,
  type LibrarySnapshot,
} from "../lib/librarySearch";
import type { Notebook as NotebookRow } from "../lib/types";
import { detectPlatform } from "../lib/desktop";
import { ENTER, EXIT, SOFT } from "./fx";
import { useDesk } from "./DeskContext";
import type { LayoutMode } from "./layout";
import { modLabel } from "./shortcuts";
import { ICON } from "../ui/iconScale";

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  /** Notebook a search result lives in. */
  meta?: string;
  /** Text around a search match. */
  snippet?: LibraryHit["snippet"];
  icon: typeof GearSix;
  run: () => void;
};

const HIT_ICONS: Record<LibraryHit["group"], typeof GearSix> = {
  Sources: FileText,
  "Saved work": NotePencil,
  Conversations: ChatsCircle,
};

/** Subsequence fuzzy match; higher is better, -1 means no match. */
function fuzzyScore(label: string, group: string, q: string): number {
  const hay = `${group} ${label}`.toLowerCase();
  let cursor = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    const idx = hay.indexOf(ch, cursor);
    if (idx === -1) return -1;
    streak = idx === cursor ? streak + 1 : 0;
    score += 10 + streak * 6 - Math.min(8, idx - cursor);
    if (idx > 0 && /[\s\-_/.,+]/.test(hay[idx - 1])) score += 8;
    cursor = idx + 1;
  }
  // Prefer matches later in the string being the label itself.
  if (label.toLowerCase().startsWith(q)) score += 12;
  return score;
}

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const desk = useDesk();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([]);
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);
  const searchQuery = useDeferredValue(query);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const platform = detectPlatform();
  const mod = modLabel(platform);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    void db.notebooks.orderBy("updatedAt").reverse().toArray().then(setNotebooks);
    // A fresh snapshot per opening, so search always sees today's library.
    setSnapshot(null);
    void loadLibrarySnapshot()
      .then(setSnapshot)
      .catch(() => setSnapshot({ docs: [], notebookNames: new Map() }));
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const layout = (mode: LayoutMode, label: string): Item => ({
      id: `layout-${mode}`,
      group: "Layout",
      label,
      icon: SidebarSimple,
      run: () => desk.setLayout(mode),
    });
    const actions: Item[] = [
      { id: "home", group: "Actions", label: "Home", hint: `${mod}+Shift+H`, icon: House, run: desk.goHome },
      { id: "new", group: "Actions", label: "New notebook", hint: `${mod}+N`, icon: Plus, run: desk.newNotebook },
      { id: "models", group: "Actions", label: "AI Models", icon: Cpu, run: () => desk.openSettings("models") },
      { id: "settings", group: "Actions", label: "Settings", hint: `${mod}+,`, icon: GearSix, run: () => desk.openSettings("settings") },
      { id: "milestones", group: "Actions", label: "Milestones", icon: Medal, run: desk.openMilestones },
      { id: "import", group: "Actions", label: "Add sources", icon: Notebook, run: desk.importFiles },
      { id: "sources", group: "Layout", label: "Toggle sources", hint: `${mod}+1`, icon: Notebook, run: desk.toggleSources },
      { id: "chat", group: "Layout", label: "Focus chat", hint: `${mod}+2`, icon: ChatCircle, run: desk.focusChat },
      { id: "studio", group: "Layout", label: "Toggle studio", hint: `${mod}+3`, icon: Books, run: desk.toggleStudio },
      layout("standard", "Standard layout"),
      layout("reading", "Reading + chat"),
      layout("writing", "Chat + studio"),
      layout("focus", "Chat only"),
    ];
    const nbItems: Item[] = notebooks.map((nb, i) => ({
      id: `nb-${nb.id}`,
      // Notebooks arrive newest-first; surface the top few as recents.
      group: !q && i < 3 ? "Recent" : "Notebooks",
      label: nb.name,
      icon: Notebook,
      run: () => desk.openNotebook(nb.id),
    }));
    const all = [...nbItems, ...actions];
    if (!q) return all;
    const commands = all
      .map((item) => ({ item, score: fuzzyScore(item.label, item.group, q) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
    const hits: Item[] =
      snapshot && isSearchable(searchQuery)
        ? searchSnapshot(snapshot, searchQuery).map((hit) => ({
            id: `hit-${hit.id}`,
            group: hit.group,
            label: hit.title,
            meta: hit.notebookName,
            snippet: hit.snippet,
            icon: HIT_ICONS[hit.group],
            run: () => navigate(hitHref(hit), { flushSync: true }),
          }))
        : [];
    return [...commands, ...hits];
  }, [desk, mod, navigate, notebooks, query, searchQuery, snapshot]);

  const searching = isSearchable(query) && (snapshot === null || query !== searchQuery);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    document
      .getElementById(items[active] ? `command-${items[active].id}` : "")
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active, items]);

  const run = (item: Item) => {
    item.run();
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) run(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const containFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(
      'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onPanelKey = (e: React.KeyboardEvent) => {
    onKey(e);
    if (!e.defaultPrevented) containFocus(e);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[min(18vh,7rem)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: EXIT }}
          transition={SOFT}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close command palette"
            className="absolute inset-0 border-0 bg-ground/70"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-palette-title"
            onKeyDownCapture={onPanelKey}
            initial={ENTER.initial}
            animate={ENTER.animate}
            exit={{ ...ENTER.exit, transition: EXIT }}
            transition={SOFT}
            className="relative w-full max-w-xl overflow-hidden rounded-[var(--radius-field)] border border-hairline bg-surface shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]"
          >
            <h2 id="command-palette-title" className="sr-only">
              Command palette
            </h2>
            <div className="flex items-center gap-2.5 border-b border-hairline px-3.5 py-2.5">
              <MagnifyingGlass size={ICON.md} weight="light" className="text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your notebooks, or type a command"
                role="combobox"
                aria-label="Search your notebooks and commands"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls="command-palette-results"
                aria-activedescendant={items[active] ? `command-${items[active].id}` : undefined}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-muted"
              />
              <kbd className="font-mono text-label text-muted">esc</kbd>
            </div>
            <div
              id="command-palette-results"
              role="listbox"
              aria-label="Results"
              className="max-h-[min(60vh,28rem)] overflow-y-auto py-1.5"
            >
              {items.length === 0 && (
                <div className="px-4 py-8 text-center text-small text-muted">
                  {searching ? "Searching your notebooks…" : "Nothing in your notebooks matches."}
                </div>
              )}
              {items.map((item, i) => {
                const showGroup = i === 0 || item.group !== items[i - 1]?.group;
                return (
                  <div key={item.id}>
                    {showGroup && (
                      <div className="px-3.5 pb-1 pt-2.5 text-label font-medium text-muted">
                        {item.group}
                      </div>
                    )}
                    <button
                      id={`command-${item.id}`}
                      role="option"
                      tabIndex={-1}
                      aria-selected={i === active}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(item)}
                      className={`flex w-full gap-2.5 px-3.5 py-2 text-left text-body ${
                        item.snippet ? "items-start" : "items-center"
                      } ${i === active ? "bg-brass/[0.1] text-ink" : "text-ink/85"}`}
                    >
                      <item.icon
                        size={ICON.md}
                        weight="light"
                        className={`shrink-0 text-muted ${item.snippet ? "mt-0.5" : ""}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.meta && (
                            <span className="max-w-[40%] shrink-0 truncate text-label text-muted">{item.meta}</span>
                          )}
                        </span>
                        {item.snippet && (
                          <span className="mt-0.5 line-clamp-2 block text-small leading-snug text-muted">
                            {item.snippet.text.slice(0, item.snippet.start)}
                            <mark className="rounded-[2px] bg-brass/20 px-0.5 text-ink">
                              {item.snippet.text.slice(item.snippet.start, item.snippet.end)}
                            </mark>
                            {item.snippet.text.slice(item.snippet.end)}
                          </span>
                        )}
                      </span>
                      {item.hint && (
                        <span className="font-mono text-label text-muted">{item.hint}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
