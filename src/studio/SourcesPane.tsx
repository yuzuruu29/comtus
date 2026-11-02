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
  MagnifyingGlass,
  SidebarSimple,
  Square,
  Trash,
  VideoCamera,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { Button, Dialog, Field, IconButton, Input, Textarea } from "../ui";
import { loadFocus, pruneFocus, saveFocus, subscribeFocus } from "./focus";
import { db, deleteSource } from "../lib/db";
import type { Source } from "../lib/types";
import { importFiles, extractUrl, chunkText, type Transcriber, type VisionRequest } from "../lib/import";
import { modelLabelFor, transcribeImage } from "../lib/llm";
import { useCallSettings, useSettings } from "../lib/settings";
import VisionConsentDialog from "./VisionConsentDialog";
import { estTokens } from "../lib/retrieval";
import { uid } from "../lib/db";
import { addSourceWithChunks } from "../lib/db";
import { DRIFT_X, ENTER, EXIT, RISE_2, SOFT } from "./fx";
import { ErrorNote } from "./ui";
import AddSourceMenu from "./AddSourceMenu";
import SourceReader from "./SourceReader";
import { highlightCounts } from "../lib/highlights";
import { sourceSize } from "../lib/sourceSize";
import { isTauri } from "../lib/desktop";
import { ICON } from "../ui/iconScale";

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
function sourceFact(s: Source, highlights = 0): string {
  const size = sourceSize(s);
  return highlights ? `${size} · ${highlights} marked` : size;
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
  addRequest,
  onAddRequestConsumed,
  onAsk,
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
  /** Non-zero asks this pane to open its Add source menu. */
  addRequest?: number;
  onAddRequestConsumed?: () => void;
  /** Sends a quoted passage from the reader to the chat composer. */
  onAsk?: (prompt: string) => void;
}) {
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [marks, setMarks] = useState<Map<string, number>>(new Map());
  const [importing, setImporting] = useState<{ done: number; total: number; current: string } | null>(
    null,
  );
  const [flushed, setFlushed] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const cs = useCallSettings();
  const hasKey = useSettings((s) => s.hasKey());
  const [visionAsk, setVisionAsk] = useState<{
    request: VisionRequest;
    offerApplyToRest: boolean;
    resolve: (read: boolean, applyToRest: boolean) => void;
  } | null>(null);
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
    setSourcesLoaded(true);
    setMarks(await highlightCounts(notebookId).catch(() => new Map<string, number>()));
    const pruned = pruneFocus(notebookId, list.map((s) => s.id));
    setFocused(pruned);
  }, [notebookId]);

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      const selected = Array.from(files);
      setFailed([]);
      setImportNotes([]);
      setFlushed(false);
      setImporting({ done: 0, total: selected.length, current: selected[0].name });
      // Photos and scanned pages are read by the model only with consent,
      // asked per file unless the student answers for the whole import.
      let standing: boolean | null = null;
      const transcriber: Transcriber | undefined = hasKey
        ? {
            confirm: (request) =>
              standing !== null
                ? Promise.resolve(standing)
                : new Promise<boolean>((resolve) =>
                    setVisionAsk({
                      request,
                      offerApplyToRest: selected.length > 1,
                      resolve: (read, applyToRest) => {
                        if (applyToRest) standing = read;
                        setVisionAsk(null);
                        resolve(read);
                      },
                    }),
                  ),
            transcribe: (image, label) => transcribeImage({ ...cs, image, label }),
          }
        : undefined;
      const outcome = await importFiles(
        selected,
        notebookId,
        (done, total, current) => {
          setImporting({ done, total, current });
          if (done >= total) setFlushed(true);
        },
        transcriber,
      );
      if (outcome.failed.length) {
        setFailed(outcome.failed.map((failure) => `${failure.name}: ${failure.reason}`));
      }
      if (outcome.notes.length) {
        setImportNotes(outcome.notes.map((note) => `${note.name} was ${note.reason}`));
      }
      onChanged();
      void refresh();
    },
    [cs, hasKey, notebookId, onChanged, refresh],
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

  // A request from elsewhere on the desk (the chat's "Add your first source") opens this pane's menu once.
  // It waits for the first load: before it, `sources` is empty, so the empty-state menu would open and then
  // unmount when the toolbar menu replaces it.
  const [menuRequest, setMenuRequest] = useState(0);
  useEffect(() => {
    if (!addRequest || !sourcesLoaded) return;
    setMenuRequest((value) => value + 1);
    onAddRequestConsumed?.();
  }, [addRequest, sourcesLoaded, onAddRequestConsumed]);

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

const visibleSources = sources.filter((source) => source.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

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
    <div className="source-index">
      <div className="pane-head">
        <div className="pane-head-title">
          <span className="pane-index" aria-hidden="true">01</span>
          <h2>Sources</h2>
        </div>
        <div className="pane-head-actions">
          {onCollapse && (
            <IconButton size="sm" aria-label="Collapse sources pane" title="Collapse sources" onClick={onCollapse}>
              <SidebarSimple size={ICON.lg} weight="light" />
            </IconButton>
          )}
        </div>
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
        <div className="source-index-toolbar">
          <AddSourceMenu
            disabled={!!importing}
            onPickFiles={openPicker}
            onPasteText={() => setPasteOpen(true)}
            onWebAddress={() => setUrlOpen(true)}
            openRequest={menuRequest}
          />
          <label className="source-index-search">
            <MagnifyingGlass size={ICON.md} aria-hidden="true" />
            <input type="search" aria-label="Find a source" placeholder="Find a source…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
      )}

      <div className="px-3.5 pb-2">
        <AnimatePresence>
          {importing && (
            <motion.div
              key="import-progress"
              role="status"
              aria-live="polite"
              initial={ENTER.initial}
              animate={ENTER.animate}
              exit={{ ...ENTER.exit, transition: EXIT }}
              transition={SOFT}
              className="rounded-[var(--radius-dialog)] border border-hairline bg-ink/[0.02] px-3.5 py-3"
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
                  className={`h-full grad-lamp transition-all duration-slow${flushed ? " lamp-flush" : ""}`}
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
        {importNotes.length > 0 && (
          <div role="status" className="mt-3 space-y-1.5">
            {importNotes.map((note) => (
              <p key={note} className="rounded-[var(--radius-dialog)] border border-hairline bg-surface px-3.5 py-2.5 text-label leading-relaxed text-muted">
                {note}
              </p>
            ))}
          </div>
        )}
      </div>

      {sources.length > 0 && (
        <div className="source-index-selection">
          <span>{selectedCount} of {sources.length} in this conversation</span>
          <button
            onClick={toggleSelectAll}
            className="source-index-select"
            aria-pressed={isAllSelected}
            aria-label={isAllSelected ? "Deselect all sources" : "Select all sources"}
          >
            {isAllSelected ? (
              <CheckSquare size={ICON.md} weight="fill" />
            ) : (
              <Square size={ICON.md} weight="light" />
            )}
          </button>
        </div>
      )}

      <div className="source-index-list scroll-thin">
        <AnimatePresence initial={false}>
          {visibleSources.map((s, i) => {
            const isUrl = s.kind === "url";
            const isYoutube = isUrl && (s.meta?.url?.includes("youtube.com") || s.meta?.url?.includes("youtu.be"));
            const Icon = isYoutube ? YoutubeLogo : (KIND_ICON[s.kind] ?? FileText);
            const isSelected = focused === null || focused.includes(s.id);

            return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: -RISE_2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -DRIFT_X, transition: EXIT }}
                  transition={i < 10 ? { ...SOFT, delay: i * 0.03 } : SOFT}
                  className="source-index-row group rule-bookmark"
                  data-selected={isSelected}
                >
                  <button
                    onClick={() => setViewing({ source: s })}
                    className="source-index-open"
                  >
                    <span className="source-index-icon">
                      <Icon size={ICON.xl} weight={isYoutube ? "fill" : "light"} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="source-index-title">
                        {s.title}
                      </span>
                      <span className="source-index-fact">
                        {sourceFact(s, marks.get(s.id))}
                      </span>
                    </span>
                  </button>

                  <div className="source-index-actions">
                    <button
                      onClick={() => toggleSourceSelection(s.id)}
                      className="source-index-select"
                      aria-pressed={isSelected}
                      aria-label={`Toggle inclusion of ${s.title}`}
                    >
                      {isSelected ? <CheckSquare size={ICON.lg} weight="fill" /> : <Square size={ICON.lg} weight="light" />}
                    </button>
                    <IconButton
                      variant="danger"
                      size="sm"
                      className="source-index-delete"
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
                      <Trash size={ICON.sm} weight="light" />
                    </IconButton>

                  </div>
                </motion.div>
            );
          })}
        </AnimatePresence>

        {sources.length === 0 && !importing && (
          <section className="source-index-empty" aria-label="Start your source collection">
            <FileText size={ICON.xxxl} weight="light" aria-hidden="true" />
            <h3>Your reading starts here.</h3>
            <p>Add a chapter, your notes, or a link. Keep the material behind your questions within reach.</p>
              <AddSourceMenu
                onPickFiles={openPicker}
                onPasteText={() => setPasteOpen(true)}
                onWebAddress={() => setUrlOpen(true)}
                openRequest={menuRequest}
              />
            <span className="source-index-format">PDF, documents, images & text</span>
          </section>
        )}
        {sources.length > 0 && visibleSources.length === 0 && <p role="status" className="source-index-no-results">No sources match “{query.trim()}”.</p>}
      </div>

{/* A plain count, no token telemetry. BRAND.md 3 gives brass to action
          and sage/rust/candle to state; a developer metric in the footer of a
          study tool spends the reader's attention on nothing they can act on. */}
      {sources.length > 0 && (
        <div className="source-index-footer">
          <span>{sources.length} {sources.length === 1 ? "source" : "sources"} · saved on this device</span>
        </div>
      )}
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
      <VisionConsentDialog
        request={visionAsk?.request ?? null}
        modelLabel={modelLabelFor(cs.provider, cs.model)}
        offerApplyToRest={visionAsk?.offerApplyToRest ?? false}
        onAnswer={(read, applyToRest) => visionAsk?.resolve(read, applyToRest)}
      />
      {viewing && (
        <SourceReader
          source={viewing.source}
          startChar={viewing.startChar}
          onClose={() => setViewing(null)}
          onAsk={onAsk}
          // Through the shared version, so every mounted sources list
          // (the workspace keeps a desktop and a mobile one) recounts.
          onHighlightsChanged={onChanged}
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
          <Input data-autofocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
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
