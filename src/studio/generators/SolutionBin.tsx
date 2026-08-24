import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, ImageUp, RotateCcw, Trash2 } from "lucide-react";
import type { SolutionCheck, SolutionVerdict } from "../../lib/types";
import { SOFT } from "../fx";

/**
 * The submission bin — a handwritten solution goes in, a verdict comes
 * out. The student photographs their paper working (or drops a file),
 * the photo is downscaled/compressed for the vision model, and the AI
 * grades method and final answer. It can be wrong, so every verdict
 * ships with the standing caveat to double-check.
 */

export interface SolutionSubmission {
  dataUrl: string;
  mediaType: "image/jpeg" | "image/png";
}

/** Downscale + re-encode a photo for the grader: long edge ≤ 1024 px,
 *  JPEG for photographs; small clean PNGs (screenshots) stay lossless.
 *  `from-image` respects EXIF rotation so phone photos land upright. */
export async function compressSubmission(
  file: File,
  maxEdge = 1024,
): Promise<SolutionSubmission> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  if (file.type === "image/png" && file.size <= 400_000) {
    return { dataUrl: canvas.toDataURL("image/png"), mediaType: "image/png" };
  }
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), mediaType: "image/jpeg" };
}

/* ── The bin ──────────────────────────────────────────────── */

export function SolutionBin({
  submission,
  onChange,
  readOnly = false,
}: {
  submission: SolutionSubmission | null;
  onChange?: (s: SolutionSubmission | null) => void;
  readOnly?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | File[] | null) => {
    const file = files instanceof FileList ? files[0] : files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("That's not an image — photos and screenshots only.");
      return;
    }
    if (file.size > 15_000_000) {
      setError("That image is over 15 MB — a smaller photo will do.");
      return;
    }
    setBusy(true);
    try {
      onChange?.(await compressSubmission(file));
    } catch {
      setError("Couldn't read that image — try another photo.");
    } finally {
      setBusy(false);
    }
  };

  const pick = (ref: React.RefObject<HTMLInputElement | null>) => ref.current?.click();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label-mono !text-[10px]">Submission bin</span>
        {submission && !readOnly && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => pick(fileRef)}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
              title="Replace photo"
            >
              <RotateCcw size={13} />
              <span className="text-[11.5px] font-medium">Replace</span>
            </button>
            <button
              onClick={() => {
                onChange?.(null);
                setError("");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-rust/10 hover:text-rust"
              title="Remove photo"
              aria-label="Remove photo"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {submission ? (
        <div className="overflow-hidden rounded-xl border border-hairline bg-ground/60">
          <img
            src={submission.dataUrl}
            alt="Your handwritten solution"
            className="mx-auto max-h-[320px] w-auto max-w-full object-contain"
          />
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            if (readOnly) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (readOnly) return;
            e.preventDefault();
            setDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition-colors ${
            dragOver
              ? "border-brass/60 bg-brass/[0.05]"
              : "border-hairline-strong bg-ground/60"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brass/10 text-brass">
            <ImageUp size={19} />
          </span>
          <div>
            <p className="text-[13.5px] font-medium text-ink">
              Submit your handwritten solution
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Solve on paper, then photograph your working — whole page, decent light.
            </p>
          </div>
          {!readOnly && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => pick(cameraRef)}
                disabled={busy}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-[var(--radius-control)] grad-lamp px-4 py-2 text-[12.5px] font-semibold text-night transition-all hover:brightness-[1.06] active:scale-[0.97] disabled:opacity-40"
              >
                <Camera size={14} />
                Take photo
              </button>
              <button
                onClick={() => pick(fileRef)}
                disabled={busy}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-[var(--radius-control)] border border-hairline bg-ink/[0.03] px-4 py-2 text-[12.5px] font-medium text-ink/90 transition-all hover:border-hairline-strong hover:bg-ink/[0.07] active:scale-[0.97] disabled:opacity-40"
              >
                <ImageUp size={14} />
                Upload file
              </button>
            </div>
          )}
          {busy && (
            <p className="text-[11.5px] text-brasspale" role="status">
              Preparing your photo…
            </p>
          )}
          <p className="hidden text-[10.5px] text-muted/60 sm:block">
            or drop an image here
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[12px] leading-relaxed text-rust">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Verdict presentation ─────────────────────────────────── */

const VERDICT_META: Record<SolutionVerdict, { label: string; cls: string }> = {
  correct: { label: "Correct", cls: "border-sage/30 bg-sage/[0.07]" },
  partial: { label: "Partially correct", cls: "border-brass/35 bg-brass/[0.06]" },
  incorrect: { label: "Incorrect", cls: "border-rust/30 bg-rust/[0.07]" },
  unreadable: { label: "Couldn't read the photo", cls: "border-moon/25 bg-moon/[0.06]" },
};

const VERDICT_TEXT: Record<SolutionVerdict, string> = {
  correct: "text-sage",
  partial: "text-brasspale",
  incorrect: "text-rust",
  unreadable: "text-moon",
};

/** The standing caveat that ships with every AI check. */
export function AiCheckNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-muted ${className}`}>
      AI checks can make mistakes — double-check the result against your notes and answer key.
    </p>
  );
}

export function SolutionVerdictCard({ check }: { check: SolutionCheck }) {
  const meta = VERDICT_META[check.verdict];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SOFT}
      className={`rounded-xl border px-4 py-3.5 ${meta.cls}`}
    >
      <div className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] ${VERDICT_TEXT[check.verdict]}`}>
        {meta.label}
      </div>
      {check.transcribedAnswer && check.verdict !== "unreadable" && (
        <p className="mt-2 text-[12.5px] text-muted">
          Read on your photo: <span className="text-ink/90">{check.transcribedAnswer}</span>
          {check.finalAnswerOk ? (
            <span className={VERDICT_TEXT.correct}> — matches</span>
          ) : (
            <span> — doesn't match the key</span>
          )}
        </p>
      )}
      {check.errors.length > 0 && (
        <ul className="mt-2 space-y-1">
          {check.errors.map((e, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink/80">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
              {e}
            </li>
          ))}
        </ul>
      )}
      {check.feedback && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink/85">{check.feedback}</p>
      )}
      <AiCheckNote className="mt-3 border-t border-current/10 pt-2.5 opacity-90" />
    </motion.div>
  );
}
