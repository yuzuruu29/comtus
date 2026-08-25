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
  Plus,
  SidebarSimple,
  Square,
  Trash,
  VideoCamera,
  X,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { ComtusEmblem } from "../components/brand/ComtusLogo";
import { loadFocus, saveFocus } from "./focus";
import { db, deleteSource } from "../lib/db";
import type { Source } from "../lib/types";
import { importFiles, extractUrl, chunkText } from "../lib/import";
import { estTokens } from "../lib/retrieval";
import { uid } from "../lib/db";
import { addSourceWithChunks } from "../lib/db";
import { SOFT, Spotlight } from "./fx";
import { Modal, Field, inputCls, btnLamp, btnGhost, ErrorNote } from "./ui";
import ExternalLink from "./ExternalLink";
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
  const [failed, setFailed] = useState<string[]>([]);
  const [urlOpen, setUrlOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [viewing, setViewing] = useState<{ source: Source; startChar?: number } | null>(null);
  const [focused, setFocused] = useState<string[] | null>(() => loadFocus(notebookId));
  const fileRef = useRef<HTMLInputElement>(null);
  const seenImportTick = useRef<number | null>(null);
  const seenDropSignal = useRef<number | FileList | null>(null);

  const refresh = useCallback(async () => {
    setSources(await db.sources.where("notebookId").equals(notebookId).sortBy("addedAt"));
  }, [notebookId]);

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      const selected = Array.from(files);
      setFailed([]);
      setImporting({ done: 0, total: selected.length, current: selected[0].name });
      const outcome = await importFiles(selected, notebookId, (done, total, current) =>
        setImporting({ done, total, current }),
      );
      setImporting(null);
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
  const isAllSelected = focused === null || (sources.length > 0 && focused.length === sources.length);
  const selectedCount = focused === null ? sources.length : focused.length;

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

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface/40">
      {/* Header matching Screenshot 2 */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3.5">
        <h2 className="font-display text-[15.5px] font-[450] text-ink">Sources</h2>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="rounded-[var(--radius-control)] p-1 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Collapse sources pane"
            title="Collapse sources"
          >
            <SidebarSimple size={17} weight="light" />
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-3.5 pb-2">
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

        {/* + Add Source Button (Screenshot 2 primary style) */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!importing}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline-strong bg-surface px-4 py-2.5 text-[13px] font-medium text-ink shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/50 hover:bg-raised hover:shadow-[0_4px_16px_-2px_rgba(227,176,75,0.18)] active:scale-[0.98] disabled:opacity-50"
        >
          <Plus size={15} weight="bold" className="text-brass" />
          <span>{importing ? "Importing…" : "Add source"}</span>
        </button>

        {/* Quick import pills */}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setUrlOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-hairline bg-surface/50 py-1.5 text-[11.5px] font-medium text-muted transition-all duration-200 hover:border-brass/35 hover:bg-surface hover:text-ink active:scale-[0.98]"
          >
            <Globe size={13} weight="light" /> Web / URL
          </button>
          <button
            onClick={() => setPasteOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-hairline bg-surface/50 py-1.5 text-[11.5px] font-medium text-muted transition-all duration-200 hover:border-brass/35 hover:bg-surface hover:text-ink active:scale-[0.98]"
          >
            <ClipboardText size={13} weight="light" /> Paste text
          </button>
        </div>

        {importing && (
          <div role="status" aria-live="polite" className="mt-3 rounded-xl border border-hairline bg-ink/[0.02] px-3.5 py-3">
            <div className="text-[11.5px] text-muted">
              {importing.current || "Processing…"} ({importing.done}/{importing.total})
            </div>
            <div className="relative mt-2 h-1 overflow-hidden rounded bg-ink/[0.07]">
              <div
                role="progressbar"
                aria-label="Import progress"
                aria-valuemin={0}
                aria-valuemax={importing.total}
                aria-valuenow={importing.done}
                className="h-full grad-lamp transition-all duration-300"
                style={{ width: `${(importing.done / Math.max(1, importing.total)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {failed.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {failed.map((f) => (
              <ErrorNote key={f}>{f}</ErrorNote>
            ))}
          </div>
        )}
      </div>

      {/* "Select all sources" subheader matching Screenshot 2 */}
      {sources.length > 0 && (
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2 text-[12px] text-muted">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 hover:text-ink transition-colors"
          >
            <span>Select all sources</span>
            <span className="font-mono text-[10px] text-muted/70">({selectedCount}/{sources.length})</span>
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

      {/* Sources List */}
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
                  exit={{ opacity: 0, x: -12, scale: 0.96, transition: { duration: 0.16 } }}
                  transition={i < 10 ? { ...SOFT, delay: i * 0.03 } : SOFT}
                  className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/40 hover:bg-surface hover:shadow-[0_4px_16px_-2px_rgba(0,0,0,0.35),0_0_12px_-3px_rgba(227,176,75,0.12)] ${
                    isSelected ? "bg-surface/80 border border-hairline/60" : "opacity-60 hover:opacity-100 bg-surface/40 border border-transparent"
                  }`}
                >
                  {/* Source Kind Icon */}
                  <button
                    onClick={() => setViewing({ source: s })}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isYoutube ? "bg-red-500/10 text-red-400" : "bg-ink/[0.04] text-muted group-hover:text-brasspale"
                    }`}>
                      <Icon size={15} weight={isYoutube ? "fill" : "light"} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-[450] text-ink/90 group-hover:text-ink">
                        {s.title}
                      </span>
                      <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted/60">
                        {(s.tokens / 1000).toFixed(1)}k tok
                      </span>
                    </span>
                  </button>

                  {/* Actions & Checkbox on the Right */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteSource(s.id);
                        onChanged();
                        void refresh();
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted/0 transition-all hover:bg-rust/15 hover:text-rust group-hover:text-muted/60"
                      aria-label={`Delete ${s.title}`}
                      title="Delete source"
                    >
                      <Trash size={13} weight="light" />
                    </button>

                    {/* Right-aligned Checkbox matching Screenshot 2 */}
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
          <div className="px-4 py-12 text-center">
            <ComtusEmblem size={24} breathe className="mx-auto mb-3" />
            <h3 className="font-display text-[14.5px] font-[450] text-ink">No sources added yet</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Add PDFs, notes, documents, or links. Your questions and study aids ground directly in your materials.
            </p>
          </div>
        )}
      </div>

      {sources.length > 0 && (
        <div className="border-t border-hairline px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted/70 flex items-center justify-between">
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
        <SourceViewer
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
    <Modal open={open} onClose={onClose} title="Add a web page">
      <div className="space-y-5">
        <Field label="URL" hint="Article or web document URL">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
        </Field>
        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="flex justify-end gap-3">
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button className={btnLamp} onClick={add} disabled={busy || !url.trim()}>
            {busy ? "Reading…" : "Add source"}
          </button>
        </div>
      </div>
    </Modal>
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
    <Modal open={open} onClose={onClose} title="Paste source text">
      <div className="space-y-5">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lecture notes or chapter"
            className={inputCls}
          />
        </Field>
        <Field label="Content">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste text or notes here…"
            className={inputCls + " resize-none leading-relaxed"}
          />
        </Field>
        <div className="flex justify-end gap-3">
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btnLamp}
            onClick={async () => {
              await onAdd(title.trim() || "Pasted text", text);
              setText("");
              setTitle("");
              onClose();
            }}
            disabled={text.trim().length < 10}
          >
            Add source
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SourceViewer({
  source,
  startChar,
  onClose,
}: {
  source: Source;
  startChar?: number;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startChar === undefined || !bodyRef.current) return;
    const el = bodyRef.current.querySelector(`[data-char="${Math.floor(startChar / 500) * 500}"]`);
    el?.scrollIntoView({ block: "center" });
  }, [startChar]);

  const blocks: { at: number; text: string }[] = [];
  for (let i = 0; i < source.content.length; i += 500)
    blocks.push({ at: i, text: source.content.slice(i, i + 500) });

  return (
    <Modal open onClose={onClose} title={source.title} wide>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {source.kind} · {source.tokens.toLocaleString()} tokens
        {source.meta?.url && (
          <>
            {" · "}
            <ExternalLink href={source.meta.url} className="text-moon underline-offset-2 hover:underline">
              Original link
            </ExternalLink>
          </>
        )}
      </div>
      <div ref={bodyRef} className="space-y-2 text-[14px] leading-[1.75] text-ink/85 max-h-[60vh] overflow-y-auto pr-2">
        {blocks.map((b) => (
          <p
            key={b.at}
            data-char={b.at}
            className={
              startChar !== undefined &&
              startChar >= b.at &&
              startChar < b.at + 500
                ? "rounded bg-brass/[0.14] px-1.5 -mx-1.5 ring-1 ring-brass/30"
                : undefined
            }
          >
            {b.text}
          </p>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <button onClick={onClose} className={btnGhost}>
          <X size={13} weight="light" className="mr-1.5 inline" />
          Close
        </button>
      </div>
    </Modal>
  );
}
