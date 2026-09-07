import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckSquare,
  ClipboardText,
  FileJs,
  FilePdf,
  FileText,
  Globe,
  Image as ImageIcon,
  SidebarSimple,
  Square,
  Trash,
  VideoCamera,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { Button, Dialog, Empty, Field, IconButton, Input, Textarea } from "../ui";
import { ComtusEmblem } from "../components/brand/ComtusLogo";
import { loadFocus, pruneFocus, saveFocus, subscribeFocus } from "./focus";
import { db, deleteSource } from "../lib/db";
import type { Source } from "../lib/types";
import { importFiles, extractUrl, chunkText } from "../lib/import";
import { estTokens } from "../lib/retrieval";
import { uid } from "../lib/db";
import { addSourceWithChunks } from "../lib/db";
import { DRIFT_X, RISE_2, SOFT, Spotlight } from "./fx";
import { ErrorNote } from "./ui";
import AddSourceMenu from "./AddSourceMenu";
import SourceReader from "./SourceReader";
import { UsageLimitsPanel } from "./UsageLimitsPanel";
import { isTauri } from "../lib/desktop";

const KIND_ICON: Record<string, typeof FileText> = {
  pdf: FilePdf,
  docx: FileText,
  txt: FileText,
  md: FileText,
  json: FileJs,
  url: Globe,
  paste: ClipboardText,
  img: ImageIcon,
  youtube: YoutubeLogo,
  video: VideoCamera,
};

/** The one fact a row shows beneath its title: page count when known,
 *  otherwise a rough word count. */
function sourceFact(s: Source): string {
  if (s.meta?.pages) return `${s.meta.pages} ${s.meta.pages === 1 ? "page" : "pages"}`;
  const words = Math.round(s.chars / 5.5);
  return words >= 1000 ? `${(words / 1000).toFixed(1)}k words` : `${words} words`;
}

async function chooseNativeFiles(): Promise<File[] | null> {
  const [{ open }, { readFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);
  const paths = await open({
    multiple: true,
    directory: false,
    filters: [
      {
        name: "Study sources",
        extensions: [
          "pdf",
          "docx",
          "txt",
          "md",
          "markdown",
          "json",
          "png",
          "jpg",
          "jpeg",
          "webp",
          "bmp",
          "tiff",
          "gif",
          "avif",
        ],
      },
    ],
  });
  if (!paths) return null;
  return Promise.all(
    paths.map(async (path) => {
      const bytes = await readFile(path);
      const name = path.split(/[\\/]/).pop() || "source";
      return new File([bytes.slice().buffer as ArrayBuffer], name);
    }),
  );
}

export default function SourcesPane({
  notebookId,
  version,
  onCollapse,
  onChanged,
  pendingView,
  onPendingConsumed,
  importTick,
  onImportTriggered,
  dropFiles,
  dropRequestId,
  onDropConsumed,
}: {
  notebookId: string;
  version: number;
  onCollapse?: () => void;
  onChanged: () => void;
  pendingView?: { sourceId: string; startChar?: number } | null;
  onPendingConsumed?: () => void;
  importTick?: number;
  onImportTriggered?: () => void;
  dropFiles?: FileList | null;
  dropRequestId?: number;
  onDropConsumed?: () => void;
}) {
  const [sources, setSources] = useState<Source[]>([]);
  const [importing, setImporting] = useState<{ done: number; total: number; current: string } | null>(
    null,
  );
  const [flushed, setFlushed] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [urlOpen, setUrlOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [viewing, setViewing] = useState<{ source: Source; startChar?: number } | null>(null);
  const [focused, setFocused] = useState<string[] | null>(() => loadFocus(notebookId));
  const fileRef = useRef<HTMLInputElement>(null);
  const seenImportTick = useRef<number | null>(null);
  const seenDropSignal = useRef<number | FileList | null>(null);

  useEffect(() => {
    return subscribeFocus(notebookId, (ids) => {
      setFocused(ids);
    });
  }, [notebookId]);

  const refresh = useCallback(async () => {
    const list = await db.sources.where("notebookId").equals(notebookId).sortBy("addedAt");
    setSources(list);
    const pruned = pruneFocus(notebookId, list.map((s) => s.id));
    setFocused(pruned);
  }, [notebookId]);

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      const selected = Array.from(files);
      setFailed([]);
      setFlushed(false);
      setImporting({ done: 0, total: selected.length, current: selected[0].name });
      const outcome = await importFiles(selected, notebookId, (done, total, current) => {
        setImporting({ done, total, current });
        if (done >= total) setFlushed(true);
      });
      if (outcome.failed.length) {
        setFailed(outcome.failed.map((failure) => `${failure.name}: ${failure.reason}`));
      }
      onChanged();
      void refresh();
    },
    [notebookId, onChanged, refresh],
  );

  const handleFilesRef = useRef(handleFiles);
  const onImportTriggeredRef = useRef(onImportTriggered);

  useEffect(() => {
    handleFilesRef.current = handleFiles;
    onImportTriggeredRef.current = onImportTriggered;
  }, [handleFiles, onImportTriggered]);

  useEffect(() => {
    if (!importTick || importTick <= 0) return;
    if (seenImportTick.current === importTick) return;
    seenImportTick.current = importTick;
    if (!isTauri()) {
      fileRef.current?.click();
      onImportTriggeredRef.current?.();
      return;
    }
    let cancelled = false;
    void chooseNativeFiles()
      .then((files) => {
        if (!cancelled && files) void handleFilesRef.current(files);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFailed([
            error instanceof Error ? error.message : "The native file picker could not be opened.",
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) onImportTriggeredRef.current?.();
      });
    return () => {
      cancelled = true;
    };
  }, [importTick]);

  useEffect(() => {
    if (!dropFiles || dropFiles.length === 0) {
      seenDropSignal.current = null;
      return;
    }
    const signal = dropRequestId ?? dropFiles;
    if (seenDropSignal.current === signal) return;
    seenDropSignal.current = signal;
    void handleFilesRef.current(dropFiles);
    onDropConsumed?.();
  }, [dropFiles, dropRequestId, onDropConsumed]);

  // Completion beat: hold the full bar ~260ms so the lamp-flush lands, then
  // release the progress card to its exit transition.
  useEffect(() => {
    if (!flushed) return;
    const timer = window.setTimeout(() => setImporting(null), 260);
    return () => window.clearTimeout(timer);
  }, [flushed]);

  useEffect(() => {
    void refresh();
  }, [refresh, version]);

  useEffect(() => {
    if (!pendingView) return;
    let cancelled = false;
    void db.sources.get(pendingView.sourceId).then((source) => {
      if (!cancelled && source) setViewing({ source, startChar: pendingView.startChar });
      onPendingConsumed?.();
    });
    return () => {
      cancelled = true;
    };
  }, [onPendingConsumed, pendingView]);

  const totalTokens = sources.reduce((s, x) => s + x.tokens, 0);

  // All sources selected by default (focused === null or all included)
  const validFocused = focused ? focused.filter((id) => sources.some((s) => s.id === id)) : null;
  const isAllSelected = validFocused === null || (sources.length > 0 && validFocused.length === sources.length);
  const selectedCount = validFocused === null ? sources.length : validFocused.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setFocused([]);
      saveFocus(notebookId, []);
    } else {
      setFocused(null);
      saveFocus(notebookId, null);
    }
  };

  const toggleSourceSelection = (id: string) => {
    const selected = focused ?? sources.map((x) => x.id);
    const next = selected.includes(id)
      ? selected.filter((sId) => sId !== id)
      : [...selected, id];
    const value = next.length === sources.length ? null : next;
    setFocused(value);
    saveFocus(notebookId, value);
  };

  const openPicker = () => fileRef.current?.click();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface/40">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3.5">
        <h2 className="font-display text-heading font-[450] text-ink">Sources</h2>
        {onCollapse && (
          <IconButton aria-label="Collapse sources pane" title="Collapse sources" onClick={onCollapse}>
            <SidebarSimple size={17} weight="light" />
          </IconButton>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.markdown,.json,.png,.jpg,.jpeg,.webp,.bmp,.tiff,image/*"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Sole "Add source" control while sources exist — the empty state
          below owns it otherwise (Task 2.3 brief rule 10). */}
      {sources.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-3.5 pb-2 pt-3.5">
          <AddSourceMenu
            disabled={!!importing}
            onPickFiles={openPicker}
            onPasteText={() => setPasteOpen(true)}
            onWebAddress={() => setUrlOpen(true)}
          />
        </div>
      )}

      <div className="px-3.5 pb-2">
        <AnimatePresence>
          {importing && (
            <motion.div
              key="import-progress"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: RISE_2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.16 } }}
              transition={SOFT}
              className="rounded-xl border border-hairline bg-ink/[0.02] px-3.5 py-3"
            >
              <div className="text-label text-muted">
                {importing.current || "Processing…"} ({importing.done}/{importing.total})
              </div>
              <div className="relative mt-2 h-1 overflow-hidden rounded bg-ink/[0.07]">
                {!flushed && <span aria-hidden className="bar-sheen" />}
                <div
                  role="progressbar"
                  aria-label="Import progress"
                  aria-valuemin={0}
                  aria-valuemax={importing.total}
                  aria-valuenow={importing.done}
                  className={`h-full grad-lamp transition-all duration-300${flushed ? " lamp-flush" : ""}`}
                  style={{ width: `${(importing.done / Math.max(1, importing.total)) * 100}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {failed.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {failed.map((f) => (
              <ErrorNote key={f}>{f}</ErrorNote>
            ))}
          </div>
        )}
      </div>

      {sources.length > 0 && (
        <div className="anim-fade flex items-center justify-between border-b border-hairline px-4 py-2 text-label text-muted">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 hover:text-ink transition-colors"
          >
            <span>Select all sources</span>
            <span className="font-mono text-label text-muted/70">({selectedCount}/{sources.length})</span>
          </button>
          <button
            onClick={toggleSelectAll}
            className="flex h-6 w-6 items-center justify-center text-brass hover:text-brasspale transition-colors"
            aria-label={isAllSelected ? "Deselect all sources" : "Select all sources"}
          >
            {isAllSelected ? (
              <CheckSquare size={16} weight="fill" />
            ) : (
              <Square size={16} weight="light" />
            )}
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2 space-y-1.5">
        <AnimatePresence initial={false}>
          {sources.map((s, i) => {
            const isUrl = s.kind === "url";
            const isYoutube = isUrl && (s.meta?.url?.includes("youtube.com") || s.meta?.url?.includes("youtu.be"));
            const Icon = isYoutube ? YoutubeLogo : (KIND_ICON[s.kind] ?? FileText);
            const isSelected = focused === null || focused.includes(s.id);

            return (
              <Spotlight key={s.id} className="rounded-xl" radius={180}>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -DRIFT_X, scale: 0.96, transition: { duration: 0.16 } }}
                  transition={i < 10 ? { ...SOFT, delay: i * 0.03 } : SOFT}
                  className={`desk-row group flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/40 hover:bg-surface hover:shadow-[0_4px_16px_-2px_rgba(0,0,0,0.35),0_0_12px_-3px_rgba(227,176,75,0.12)] ${
                    isSelected ? "bg-surface/80 border border-hairline/60" : "opacity-60 hover:opacity-100 bg-surface/40 border border-transparent"
                  }`}
                >
                  <button
                    onClick={() => setViewing({ source: s })}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isYoutube ? "bg-rust/10 text-rust" : "bg-ink/[0.04] text-muted group-hover:text-brasspale"
                    }`}>
                      <Icon size={15} weight={isYoutube ? "fill" : "light"} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-[450] text-ink/90 group-hover:text-ink">
                        {s.title}
                      </span>
                      <span className="block font-mono text-label uppercase tracking-[0.1em] text-muted/60">
                        {sourceFact(s)}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-1">
                    <IconButton
                      variant="danger"
                      size="sm"
                      aria-label={`Delete ${s.title}`}
                      title="Delete source"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteSource(s.id);
                        const currentFocus = loadFocus(notebookId);
                        if (currentFocus !== null) {
                          const remaining = currentFocus.filter((id) => id !== s.id);
                          saveFocus(notebookId, remaining);
                          setFocused(remaining);
                        }
                        onChanged();
                        void refresh();
                      }}
                    >
                      <Trash size={13} weight="light" />
                    </IconButton>

                    <button
                      onClick={() => toggleSourceSelection(s.id)}
                      className="flex h-7 w-7 items-center justify-center text-brass hover:text-brasspale transition-colors"
                      aria-label={`Toggle inclusion of ${s.title}`}
                    >
                      {isSelected ? (
                        <CheckSquare size={16} weight="fill" />
                      ) : (
                        <Square size={16} weight="light" className="text-muted/60" />
                      )}
                    </button>
                  </div>
                </motion.div>
              </Spotlight>
            );
          })}
        </AnimatePresence>

        {sources.length === 0 && !importing && (
          <Empty
            icon={<ComtusEmblem size={24} breathe />}
            title="No sources yet."
            body="Add a chapter, your notes, or a link. Every answer will cite the page it came from."
            action={
              <AddSourceMenu
                onPickFiles={openPicker}
                onPasteText={() => setPasteOpen(true)}
                onWebAddress={() => setUrlOpen(true)}
              />
            }
          />
        )}
      </div>

      {sources.length > 0 && (
        <div className="anim-fade border-t border-hairline px-4 py-2.5 font-mono text-label uppercase tracking-[0.14em] text-muted/70 flex items-center justify-between">
          <span>{totalTokens.toLocaleString()} tokens</span>
          <span>{sources.length} sources</span>
        </div>
      )}
      <UsageLimitsPanel />

      <UrlModal
        open={urlOpen}
        onClose={() => setUrlOpen(false)}
        onAdd={async (title, text, url) => {
          await persistDoc(notebookId, { title, kind: "url", text, meta: { url } });
          onChanged();
          void refresh();
        }}
      />
      <PasteModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onAdd={async (title, text) => {
          await persistDoc(notebookId, { title, kind: "paste", text });
          onChanged();
          void refresh();
        }}
      />
      {viewing && (
        <SourceReader
          source={viewing.source}
          startChar={viewing.startChar}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

async function persistDoc(
  notebookId: string,
  doc: { title: string; kind: Source["kind"]; text: string; meta?: Source["meta"] },
) {
  const id = uid();
  const pieces = chunkText(doc.text);
  await addSourceWithChunks(
    {
      id,
      notebookId,
      title: doc.title || "Untitled",
      kind: doc.kind,
      content: doc.text,
      chars: doc.text.length,
      tokens: estTokens(doc.text),
      addedAt: Date.now(),
      meta: doc.meta,
    },
    pieces.map((text, idx) => ({
      id: `${id}:${idx}`,
      sourceId: id,
      notebookId,
      idx,
      text,
      tokens: estTokens(text),
    })),
  );
}

function UrlModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, text: string, url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const add = async () => {
    setErr("");
    setBusy(true);
    try {
      const doc = await extractUrl(url.trim());
      await onAdd(doc.title, doc.text, url.trim());
      setUrl("");
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that page.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add a web page">
      <div className="space-y-5">
        <Field label="URL" hint="Article or web document URL">
          <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>
        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void add()} loading={busy} disabled={!url.trim()}>
            Add source
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function PasteModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, text: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Paste source text">
      <div className="space-y-5">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lecture notes or chapter" />
        </Field>
        <Field label="Content">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste text or notes here…"
            className="resize-none leading-relaxed"
          />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await onAdd(title.trim() || "Pasted text", text);
              setText("");
              setTitle("");
              onClose();
            }}
            disabled={text.trim().length < 10}
          >
            Add source
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
