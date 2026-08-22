import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Key, Plus, Trash } from "@phosphor-icons/react";
import { db, createNotebook, deleteNotebook } from "../lib/db";
import type { Notebook } from "../lib/types";
import { detectPlatform, greeting, isDesktopApp, isTauri, todayLine } from "../lib/desktop";
import { SOFT, Spotlight } from "./fx";
import { timeAgo, Modal, Field, inputCls, btnLamp, btnGhost } from "./ui";
import SettingsModal from "./SettingsModal";
import DeskShell from "./DeskShell";
import CaptionButtons from "./Titlebar";
import { useDesk } from "./DeskContext";
import { modLabel } from "./shortcuts";

export default function NotebookList({
  onOpen,
  needsKey,
}: {
  onOpen: (id: string) => void;
  needsKey: boolean;
}) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(needsKey);

  const desktop = isDesktopApp();
  const tauri = isTauri();
  const g = greeting();
  const last = notebooks[0];

  const refresh = () => {
    db.notebooks.orderBy("updatedAt").reverse().toArray().then(setNotebooks);
  };
  useEffect(refresh, []);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const nb = await createNotebook(trimmed);
    setCreating(false);
    setName("");
    onOpen(nb.id);
  };

  return (
    <DeskShell onSettings={() => setSettingsOpen(true)} onNewNotebook={() => setCreating(true)}>
      <div className="min-h-[100svh] bg-ground">
        <div className="pointer-events-none fixed inset-x-0 top-0 h-[42vh] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(227,176,75,0.07),transparent_80%)]" />
        <div className="relative mx-auto w-full max-w-5xl px-6 pb-24">
          <ShelfHeader onSettings={() => setSettingsOpen(true)} />

          {desktop ? (
            <div className="mt-6 mb-10">
              <div className="text-[12px] text-muted">
                The shelf · {todayLine()}
              </div>
              <h1 className="mt-4 font-display text-[clamp(2.2rem,5vw,3.4rem)] font-[400] leading-tight text-ink">
                {g.hello}. <em className="font-[420] text-lamp">The lamp is lit.</em>
              </h1>
              <p className="mt-3 max-w-lg text-[14.5px] text-muted">
                Every notebook, drill, and draft is waiting exactly as you left it.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {last && (
                  <button
                    onClick={() => onOpen(last.id)}
                    className={`${btnLamp} !min-h-[36px]`}
                  >
                    Continue {last.name.length > 24 ? `${last.name.slice(0, 24)}…` : last.name}
                  </button>
                )}
                <button onClick={() => setCreating(true)} className={btnGhost}>
                  <Plus size={14} weight="light" /> New notebook
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-10 mb-10">
              <div className="text-[12px] text-muted">The shelf</div>
              <h1 className="mt-4 font-display text-[clamp(2.2rem,5vw,3.4rem)] font-[400] leading-tight text-ink">
                Your notebooks, <em className="font-[420] text-lamp">lamplit.</em>
              </h1>
              <p className="mt-3 max-w-lg text-[14.5px] text-muted">
                One notebook per subject or exam. Fill it with sources, then ask, drill,
                and grade against them.
              </p>
            </div>
          )}

          {needsKey && (
            <div className="mb-8 rounded-[var(--radius-dialog)] border border-brass/30 bg-brass/[0.06] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5">
                  <Flame className="breathe mt-0.5 h-5 w-5 shrink-0 text-brass" weight="light" />
                  <div>
                    <div className="text-[14px] font-medium text-ink">
                      Light the lamp
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                      Connect OpenRouter with free models, Claude via PayPal, or run offline with Ollama / LM Studio.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className={btnLamp}
                >
                  Configure key
                </button>
              </div>
            </div>
          )}

          {tauri ? (
            <div className="divide-y divide-hairline border-y border-hairline">
              <AnimatePresence initial={false}>
                {notebooks.map((nb) => (
                  <NotebookRow
                    key={nb.id}
                    notebook={nb}
                    onOpen={() => onOpen(nb.id)}
                    onDelete={async () => {
                      await deleteNotebook(nb.id);
                      refresh();
                    }}
                  />
                ))}
              </AnimatePresence>
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-3 px-1 py-3 text-left text-[13.5px] text-muted hover:text-ink"
              >
                <Plus size={16} weight="light" />
                New notebook
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence initial={false}>
                {notebooks.map((nb) => (
                  <NotebookCard
                    key={nb.id}
                    notebook={nb}
                    onOpen={() => onOpen(nb.id)}
                    onDelete={async () => {
                      await deleteNotebook(nb.id);
                      refresh();
                    }}
                  />
                ))}
              </AnimatePresence>
              <button
                onClick={() => setCreating(true)}
                className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-[var(--radius-dialog)] border border-hairline-strong text-muted hover:border-brass/40 hover:text-brasspale"
              >
                <Plus size={17} weight="light" />
                <span className="text-[13.5px]">New notebook</span>
              </button>
            </div>
          )}
        </div>

        <Modal open={creating} onClose={() => setCreating(false)} title="New notebook">
          <div className="space-y-5">
            <Field label="Name" hint="e.g. Nursing Sem 1 — MS, CHN, Pharma">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Name this notebook"
                className={inputCls}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <button className={btnGhost} onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className={btnLamp} onClick={create} disabled={!name.trim()}>
                Create
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
  const desk = useDesk();
  const tauri = isTauri();
  const platform = detectPlatform();
  const macPad = tauri && platform === "mac";
  return (
    <header
      data-tauri-drag-region={tauri ? true : undefined}
      className={`desk-header flex items-center justify-between pb-7 pt-[calc(1.25rem+var(--sat))] ${macPad ? "pl-[78px]" : ""}`}
    >
      {tauri ? (
        <div className="flex select-none items-center gap-2.5">
          <Flame className="h-5 w-5 text-brass" weight="light" />
          <span className="font-display text-[15px] font-[480] tracking-[0.2em] text-ink">
            COMTUS
          </span>
        </div>
      ) : (
        <Link to="/" className="flex items-center gap-2.5" aria-label="Back to landing">
          <Flame className="h-5 w-5 text-brass" weight="light" />
          <span className="font-display text-[15px] font-[480] tracking-[0.2em] text-ink">
            COMTUS
          </span>
        </Link>
      )}
      <div className="no-drag flex items-center gap-1">
        <button
          type="button"
          onClick={desk.openPalette}
          className="hidden rounded-[var(--radius-control)] px-2 py-1.5 font-mono text-[10.5px] text-muted hover:text-ink sm:inline"
        >
          {modLabel(platform)}K
        </button>
        <button
          onClick={onSettings}
          className="flex min-h-[40px] items-center gap-2 rounded-[var(--radius-control)] border border-hairline px-3 py-2 text-[13px] text-muted hover:text-ink"
        >
          <Key size={14} weight="light" />
          Settings
        </button>
        <CaptionButtons />
      </div>
    </header>
  );
}

function NotebookCard({
  notebook,
  onOpen,
  onDelete,
}: {
  notebook: Notebook;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [sources, setSources] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    db.sources.where("notebookId").equals(notebook.id).count().then(setSources);
  }, [notebook.id]);

  return (
    <Spotlight className="hover-lift rounded-[var(--radius-dialog)]">
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      transition={SOFT}
      className="group relative rounded-[var(--radius-dialog)] border border-hairline bg-surface/40"
    >
      <button onClick={onOpen} className="block w-full p-5 text-left">
        <h3 className="font-display text-title text-ink">
          {notebook.name}
        </h3>
        <div className="mt-2 text-[12px] text-muted">
          {sources} {sources === 1 ? "source" : "sources"} · {timeAgo(notebook.updatedAt)}
        </div>
      </button>
      <button
        onClick={() => {
          if (confirming) onDelete();
          else setConfirming(true);
        }}
        onBlur={() => setConfirming(false)}
        className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] ${
          confirming ? "bg-rust/15 text-rust" : "text-muted/50 hover:text-rust"
        }`}
        aria-label={confirming ? "Confirm delete" : "Delete notebook"}
      >
        <Trash size={15} weight="light" />
      </button>
      {confirming && (
        <div className="px-5 pb-4 text-label text-rust">Click again to delete everything inside.</div>
      )}
    </motion.div>
    </Spotlight>
  );
}

function NotebookRow({
  notebook,
  onOpen,
  onDelete,
}: {
  notebook: Notebook;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [sources, setSources] = useState(0);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    db.sources.where("notebookId").equals(notebook.id).count().then(setSources);
  }, [notebook.id]);
  return (
    <div className="group flex items-center gap-3 py-2.5">
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="truncate font-display text-[17px] font-[440] text-ink">{notebook.name}</div>
        <div className="text-[12px] text-muted">
          {sources} {sources === 1 ? "source" : "sources"} · {timeAgo(notebook.updatedAt)}
        </div>
      </button>
      <button
        onClick={() => {
          if (confirming) onDelete();
          else setConfirming(true);
        }}
        onBlur={() => setConfirming(false)}
        className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] ${
          confirming ? "text-rust" : "text-muted/40 hover:text-rust"
        }`}
        aria-label={confirming ? "Confirm delete" : "Delete notebook"}
      >
        <Trash size={15} weight="light" />
      </button>
    </div>
  );
}
