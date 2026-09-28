import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cards, DownloadSimple, FileCsv, FilePdf, FilePpt, Warning } from "@phosphor-icons/react";
import { db } from "../lib/db";
import {
  exportFormatsFor,
  exportGeneration,
  type ExportFormat,
} from "../lib/exportDocs";
import type { Generation } from "../lib/types";

const FORMAT_META: Record<ExportFormat, { icon: typeof FilePdf; label: string; hint: string }> = {
  pdf: { icon: FilePdf, label: "PDF — print", hint: "Crisp Letter pages" },
  pptx: { icon: FilePpt, label: "PowerPoint", hint: "Brand-styled deck" },
  anki: { icon: Cards, label: "Anki deck", hint: "In Anki: File → Import" },
  csv: { icon: FileCsv, label: "Spreadsheet (CSV)", hint: "Excel, Sheets, Quizlet" },
};

/** Download control for a saved artifact — lives in the viewer modal header. */
export default function ExportMenu({ gen }: { gen: Generation }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const formats = exportFormatsFor(gen.kind);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (formats.length === 0) return null;

  const run = async (format: ExportFormat) => {
    setOpen(false);
    setBusy(true);
    setErr("");
    try {
      const nb = await db.notebooks.get(gen.notebookId);
      await exportGeneration(gen, nb?.name ?? "Comtus", format);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-full border border-hairline bg-ink/[0.03] px-3 py-1.5 text-[12px] text-ink/85 transition-colors hover:border-hairline-strong hover:text-ink disabled:opacity-50"
        aria-label="Download artifact"
        aria-expanded={open}
      >
        <DownloadSimple size={13} weight="light" />
        {busy ? "Preparing…" : "Download"}
      </button>

      {err && (
        <div className="absolute right-0 top-full z-10 mt-1.5 flex w-56 items-start gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-[11.5px] text-rust">
          <Warning size={13} className="mt-0.5 shrink-0" />
          {err}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-10 mt-1.5 w-56 overflow-hidden rounded-xl border border-hairline bg-surface py-1 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.7)]"
          >
            {formats.map((f) => {
              const meta = FORMAT_META[f];
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => void run(f)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink/5"
                >
                  <meta.icon size={16} weight="light" className="shrink-0 text-brasspale/85" />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] text-ink/90">{meta.label}</span>
                    <span className="block text-[10.5px] text-muted">{meta.hint}</span>
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
