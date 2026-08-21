import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, FileText, Globe, ClipboardType, Trash2, PanelLeftClose, X, FileJson, FileType2, Flame, Image as ImageIcon } from "lucide-react";
import { db, deleteSource } from "../lib/db";
import type { Source } from "../lib/types";
import { importFiles, extractUrl, chunkText } from "../lib/import";
import { estTokens } from "../lib/retrieval";
import { uid } from "../lib/db";
import { addSourceWithChunks } from "../lib/db";
import { SOFT } from "./fx";
import { Modal, Field, inputCls, btnLamp, btnGhost, ErrorNote, timeAgo } from "./ui";

const KIND_ICON = {
  pdf: FileType2,
  docx: FileText,
  txt: FileText,
  md: FileText,
  json: FileJson,
  url: Globe,
  paste: ClipboardType,
  img: ImageIcon,
} as const;

export default function SourcesPane({
  notebookId,
  version,
  onCollapse,
  onChanged,
  pendingView,
  onPendingConsumed,
}: {
  notebookId: string;
  version: number;
  onCollapse?: () => void;
  onChanged: () => void;
  pendingView?: { sourceId: string; startChar?: number } | null;
  onPendingConsumed?: () => void;
}) {
  const [sources, setSources] = useState<Source[]>([]);
  const [importing, setImporting] = useState<{ done: number; total: number; current: string } | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [urlOpen, setUrlOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [viewing, setViewing] = useState<{ source: Source; startChar?: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setSources(
      await db.sources.where("notebookId").equals(notebookId).sortBy("addedAt"),
    );
  }, [notebookId]);

  useEffect(() => {
    void refresh();
  }, [refresh, version]);

  // Citation chips elsewhere in the app queue a request through the
  // Workspace (this pane may mount *after* the click); consume it here.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingView]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFailed([]);
    setImporting({ done: 0, total: files.length, current: files[0].name });
    const outcome = await importFiles(Array.from(files), notebookId, (done, total, current) =>
      setImporting({ done, total, current }),
    );
    setImporting(null);
    if (outcome.failed.length)
      setFailed(outcome.failed.map((f) => `${f.name}: ${f.reason}`));
    onChanged();
    void refresh();
  };

  const totalTokens = sources.reduce((s, x) => s + x.tokens, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <div className="label-mono">Sources · {sources.length}</div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="rounded p-1 text-faded transition-colors hover:text-parchment lg:block"
            aria-label="Collapse sources"
          >
            <PanelLeftClose size={14} />
          </button>
        )}
      </div>

      <div className="px-5">
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
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!importing}
          className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-[13px] font-medium text-faded transition-colors duration-200 hover:border-brass/40 hover:text-brasspale disabled:opacity-50"
        >
          <Plus size={15} className="transition-transform duration-300 group-hover:rotate-90" />
          {importing ? "Importing…" : "Add PDFs, DOCX, Images, Notes"}
        </button>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={() => setUrlOpen(true)}
            className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[12px] text-faded transition-colors hover:text-parchment active:scale-95 sm:rounded-lg sm:py-1.5 sm:text-[11.5px]"
          >
            <Globe size={13} /> Web page
          </button>
          <button
            onClick={() => setPasteOpen(true)}
            className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[12px] text-faded transition-colors hover:text-parchment active:scale-95 sm:rounded-lg sm:py-1.5 sm:text-[11.5px]"
          >
            <ClipboardType size={13} /> Paste text
          </button>
        </div>
        {importing && (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
            <div className="text-[11.5px] text-faded">
              {importing.current || "Finishing…"} ({importing.done}/{importing.total})
            </div>
            <div className="relative mt-2 h-1 overflow-hidden rounded bg-white/[0.07]">
              <div
                className="h-full grad-lamp transition-all duration-300"
                style={{ width: `${(importing.done / Math.max(1, importing.total)) * 100}%` }}
              />
              <span className="bar-sheen" />
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

      <div className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        <AnimatePresence initial={false}>
          {sources.map((s, i) => {
            const Icon = KIND_ICON[s.kind] ?? FileText;
            return (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -14, scale: 0.96, transition: { duration: 0.18 } }}
                transition={i < 10 ? { ...SOFT, delay: i * 0.045 } : SOFT}
                className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.04] sm:py-2"
              >
              <button
                onClick={() => setViewing({ source: s })}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-transform duration-200 group-hover:translate-x-0.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-faded transition-colors duration-200 group-hover:border-brass/30 group-hover:text-brasspale sm:h-7 sm:w-7">
                  <Icon size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-parchment/90">{s.title}</span>
                  <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-faded/70">
                    {(s.tokens / 1000).toFixed(1)}k tok · {timeAgo(s.addedAt)}
                  </span>
                </span>
              </button>
              <button
                onClick={async () => {
                  await deleteSource(s.id);
                  onChanged();
                  void refresh();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faded/60 transition-all duration-200 hover:!bg-rust/10 hover:!text-rust active:scale-90 sm:h-auto sm:w-auto sm:p-1.5 sm:text-faded/0 sm:group-hover:text-faded"
                aria-label={`Delete ${s.title}`}
              >
                <Trash2 size={14} />
              </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {sources.length === 0 && !importing && (
          <div className="anim-fade px-3 py-10 text-center" style={{ "--d": "200ms" } as React.CSSProperties}>
            <Flame size={18} className="breathe mx-auto mb-3 text-brass/60" />
            <p className="text-[13px] leading-relaxed text-faded">
              No sources yet. Every answer traces back to a source you added.
            </p>
          </div>
        )}
      </div>

      {sources.length > 0 && (
        <div className="border-t border-white/[0.06] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faded/70">
          {totalTokens.toLocaleString()} tokens grounded
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
        <Field label="URL" hint="Fetched in reader mode; only the text is kept.">
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
    <Modal open={open} onClose={onClose} title="Paste a source">
      <div className="space-y-5">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lecture notes — Feb 12"
            className={inputCls}
          />
        </Field>
        <Field label="Text">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder="Paste notes, transcripts, or chapters here…"
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
              await onAdd(title.trim() || "Pasted note", text);
              setText("");
              setTitle("");
              onClose();
            }}
            disabled={text.trim().length < 20}
          >
            Add source
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Read-only source text; jumps to a char offset when opened from a citation. */
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

  // Slice the text into 500-char blocks so citations can be scrolled to.
  const blocks: { at: number; text: string }[] = [];
  for (let i = 0; i < source.content.length; i += 500)
    blocks.push({ at: i, text: source.content.slice(i, i + 500) });

  return (
    <Modal open onClose={onClose} title={source.title} wide>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faded">
        {source.kind} · {source.tokens.toLocaleString()} tokens
        {source.meta?.url && (
          <>
            {" · "}
            <a href={source.meta.url} target="_blank" rel="noreferrer" className="text-moon underline-offset-2 hover:underline">
              original
            </a>
          </>
        )}
      </div>
      <div ref={bodyRef} className="space-y-2 font-[15px] leading-[1.75] text-parchment/85">
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
      <div className="pointer-events-none sticky bottom-0 -mx-6 mt-4 flex justify-end bg-gradient-to-t from-study via-study/90 to-transparent px-6 pb-1 pt-8">
        <button onClick={onClose} className={`pointer-events-auto ${btnGhost} !bg-study`}>
          <X size={13} className="mr-1.5 inline" />
          Close
        </button>
      </div>
    </Modal>
  );
}
