import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Books,
  ChatCircle,
  GearSix,
  MagnifyingGlass,
  Notebook,
  Plus,
  SidebarSimple,
} from "@phosphor-icons/react";
import { db } from "../lib/db";
import type { Notebook as NotebookRow } from "../lib/types";
import { detectPlatform } from "../lib/desktop";
import { SOFT } from "./fx";
import { useDesk } from "./DeskContext";
import type { LayoutMode } from "./layout";
import { modLabel } from "./shortcuts";

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: typeof GearSix;
  run: () => void;
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
  const [query, setQuery] = useState("");
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const platform = detectPlatform();
  const mod = modLabel(platform);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    void db.notebooks.orderBy("updatedAt").reverse().toArray().then(setNotebooks);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
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
      { id: "new", group: "Actions", label: "New notebook", hint: `${mod}+N`, icon: Plus, run: desk.newNotebook },
      { id: "settings", group: "Actions", label: "Settings", hint: `${mod}+,`, icon: GearSix, run: desk.openSettings },
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
    return all
      .map((item) => ({ item, score: fuzzyScore(item.label, item.group, q) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [desk, mod, notebooks, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

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

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[min(18vh,7rem)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16 } }}
        >
          <div className="absolute inset-0 bg-night/70" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Command palette"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.14 } }}
            transition={SOFT}
            className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-field)] border border-white/[0.08] bg-study shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-3.5 py-2.5">
              <MagnifyingGlass size={16} weight="light" className="text-faded" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                placeholder="Open a notebook, change layout, or jump to settings"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-parchment outline-none placeholder:text-faded/55"
              />
              <kbd className="font-mono text-[10px] text-faded/70">esc</kbd>
            </div>
            <div className="max-h-[min(52vh,22rem)] overflow-y-auto py-1.5">
              {items.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-faded">Nothing matches.</div>
              )}
              {items.map((item, i) => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                return (
                  <div key={item.id}>
                    {showGroup && (
                      <div className="px-3.5 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faded/60">
                        {item.group}
                      </div>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(item)}
                      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] ${
                        i === active ? "bg-brass/[0.1] text-parchment" : "text-parchment/85"
                      }`}
                    >
                      <item.icon size={16} weight="light" className="shrink-0 text-faded" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && (
                        <span className="font-mono text-[10px] text-faded/55">{item.hint}</span>
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
