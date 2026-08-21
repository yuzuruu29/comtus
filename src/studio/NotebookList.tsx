import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Plus, Trash2, KeyRound } from "lucide-react";
import { db, createNotebook, deleteNotebook } from "../lib/db";
import type { Notebook } from "../lib/types";
import { detectPlatform, greeting, isDesktopApp, isStandalone, todayLine } from "../lib/desktop";
import { BorderBeam, SOFT, Spotlight } from "./fx";
import { timeAgo, Modal, Field, inputCls, btnLamp, btnGhost } from "./ui";
import SettingsModal from "./SettingsModal";

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

  // Installed-app context: native-feel home when running as the Desk App.
  const desktop = isDesktopApp();
  const macWindowControls = desktop && isStandalone() && detectPlatform() === "mac";
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
    <div className="min-h-[100svh] bg-night">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[42vh] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(227,176,75,0.09),rgba(42,54,84,0.12)_55%,transparent_80%)]" />
      <div className="relative mx-auto w-full max-w-5xl px-6 pb-24">
        <header className="flex items-center justify-between pb-7 pt-[calc(1.75rem+var(--sat))]">
          {desktop ? (
            <div
              className={`flex select-none items-center gap-2.5 ${macWindowControls ? "ml-16" : ""}`}
            >
              <Flame className="h-5 w-5 text-brass" />
              <span className="font-display text-[15px] font-[480] tracking-[0.2em] text-parchment">
                COMTUS
              </span>
              <span className="ml-1 border-l border-white/10 pl-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-faded/60">
                Desk App
              </span>
            </div>
          ) : (
            <Link to="/" className="flex items-center gap-2.5" aria-label="Back to landing">
              <Flame className="h-5 w-5 text-brass" />
              <span className="font-display text-[15px] font-[480] tracking-[0.2em] text-parchment">
                COMTUS
              </span>
            </Link>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] text-faded transition-colors hover:border-white/20 hover:text-parchment active:scale-95 sm:min-h-[38px]"
          >
            <KeyRound size={14} />
            Settings
          </button>
        </header>

        {desktop ? (
          <div className="mt-6 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SOFT}
              className="label-mono"
            >
              The Shelf · {todayLine()}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ ...SOFT, delay: 0.07 }}
              className="mt-4 font-display text-[clamp(2.2rem,5vw,3.4rem)] font-[400] leading-tight text-parchment"
            >
              {g.hello}. <em className="font-[420] text-lamp">The lamp is lit.</em>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SOFT, delay: 0.15 }}
              className="mt-3 max-w-lg text-[14.5px] text-faded"
            >
              Every notebook, drill, and draft is waiting exactly as you left it —
              all on this machine, none of it in a browser.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SOFT, delay: 0.22 }}
              className="mt-6 flex flex-wrap items-center gap-2.5"
            >
              {last && (
                <button
                  onClick={() => onOpen(last.id)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full grad-lamp px-5 py-2 text-[12.5px] font-semibold text-night shadow-[0_4px_20px_rgba(227,176,75,0.25)] transition-all hover:brightness-105 active:scale-95"
                >
                  Continue “{last.name.length > 24 ? `${last.name.slice(0, 24)}…` : last.name}”
                </button>
              )}
              <button
                onClick={() => setCreating(true)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-5 py-2 text-[12.5px] font-medium text-parchment/90 transition-all hover:border-white/25 hover:bg-white/[0.06] active:scale-95"
              >
                <Plus size={14} /> New notebook
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="mt-10 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SOFT}
              className="label-mono"
            >
              The Shelf
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ ...SOFT, delay: 0.07 }}
              className="mt-4 font-display text-[clamp(2.2rem,5vw,3.4rem)] font-[400] leading-tight text-parchment"
            >
              Your notebooks, <em className="font-[420] text-lamp">lamplit.</em>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SOFT, delay: 0.15 }}
              className="mt-3 max-w-lg text-[14.5px] text-faded"
            >
              One notebook per subject or exam. Fill it with sources, then ask, drill,
              and grade against them.
            </motion.p>
          </div>
        )}

        {needsKey && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SOFT, delay: 0.22 }}
            className="mb-8 rounded-2xl border border-brass/30 bg-brass/[0.06] p-5 shadow-[0_4px_30px_rgba(227,176,75,0.08)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <Flame className="breathe mt-0.5 h-5 w-5 shrink-0 text-brass" />
                <div>
                  <div className="text-[14px] font-medium text-parchment">
                    Light the lamp — Bring Your Own Key (BYOK)
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-faded">
                    Connect OpenRouter with free AI models (:free), unlock Smarter Claude Models via PayPal, or run 100% offline with Ollama / LM Studio.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(true)}
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-xl grad-lamp px-4 py-2 text-[12.5px] font-semibold text-night shadow-[0_4px_20px_rgba(227,176,75,0.25)] transition-all hover:brightness-105 active:scale-95"
              >
                Configure Key & Guide
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <motion.button
            onClick={() => setCreating(true)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SOFT, delay: 0.2 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex min-h-[150px] flex-col items-center justify-center gap-3 overflow-hidden rounded-[1.4rem] border border-dashed border-white/15 bg-white/[0.015] text-faded transition-colors duration-200 hover:border-brass/40 hover:text-brasspale"
          >
            <BorderBeam size={70} duration={9} />
            <span className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border border-current">
              <Plus size={17} className="transition-transform duration-300 group-hover:rotate-90" />
            </span>
            <span className="relative z-[1] text-[13.5px] font-medium">New notebook</span>
          </motion.button>
        </div>
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
    db.sources
      .where("notebookId")
      .equals(notebook.id)
      .count()
      .then(setSources);
  }, [notebook.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={SOFT}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="group relative rounded-[1.4rem]"
    >
      <Spotlight className="h-full overflow-hidden rounded-[1.4rem] border border-white/[0.07] bg-study/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors duration-300 group-hover:border-brass/30">
        <button onClick={onOpen} className="block w-full p-6 text-left">
          <h3 className="font-display text-[1.3rem] font-[440] leading-snug text-parchment">
            {notebook.name}
          </h3>
          <div className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faded">
            {sources} {sources === 1 ? "source" : "sources"} · {timeAgo(notebook.updatedAt)}
          </div>
        </button>
        <button
          onClick={() => {
            if (confirming) onDelete();
            else setConfirming(true);
          }}
          onBlur={() => setConfirming(false)}
          className={`absolute right-3.5 top-3.5 z-[2] flex h-9 w-9 items-center justify-center rounded-full transition-all sm:right-4 sm:top-4 ${
            confirming
              ? "bg-rust/15 text-rust"
              : "text-faded/60 hover:!bg-rust/10 hover:!text-rust active:scale-90 sm:text-faded/0 sm:group-hover:text-faded"
          }`}
          aria-label={confirming ? "Confirm delete" : "Delete notebook"}
        >
          <Trash2 size={15} />
        </button>
        {confirming && (
          <div className="px-6 pb-5 text-[12px] text-rust">Click again to delete everything inside.</div>
        )}
      </Spotlight>
    </motion.div>
  );
}
