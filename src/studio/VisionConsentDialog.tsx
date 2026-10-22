import { useId, useState } from "react";
import { Eye } from "@phosphor-icons/react";
import type { VisionRequest } from "../lib/import";
import { Button, Dialog } from "../ui";
import { ICON } from "../ui/iconScale";

const pagesLabel = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;

/**
 * Asked before a photo or scanned page leaves the device: which file, how
 * many pages, which model, what it costs. Closing the dialog declines.
 */
export default function VisionConsentDialog({
  request,
  modelLabel,
  offerApplyToRest,
  onAnswer,
}: {
  request: VisionRequest | null;
  modelLabel: string;
  /** More files remain in this import. */
  offerApplyToRest: boolean;
  onAnswer: (read: boolean, applyToRest: boolean) => void;
}) {
  const [applyToRest, setApplyToRest] = useState(false);
  const checkboxId = useId();
  if (!request) return null;

  const isPhoto = request.kind === "image";
  const capped = request.pages < request.scannedPages;
  const single = request.scannedPages === 1;
  const answer = (read: boolean) => {
    onAnswer(read, applyToRest);
    setApplyToRest(false);
  };

  return (
    <Dialog
      open
      onClose={() => answer(false)}
      title={isPhoto ? "Read this photo?" : request.scannedPages === 1 ? "Read the scanned page?" : "Read the scanned pages?"}
    >
      <div className="space-y-4 text-body leading-relaxed">
        <p className="flex gap-3 text-ink">
          <Eye size={ICON.xl} className="mt-0.5 shrink-0 text-brass" aria-hidden="true" />
          <span>
            {isPhoto ? (
              <>“{request.fileName}” is a photo, so it has no text to search or cite.</>
            ) : single ? (
              <>“{request.fileName}” has a page with no text layer — a scan or a photo.</>
            ) : (
              <>
                “{request.fileName}” has {pagesLabel(request.scannedPages)} with no text layer — scanned or
                photographed pages.
              </>
            )}{" "}
            Your model, {modelLabel}, can transcribe{" "}
            {isPhoto || single ? "it" : capped ? `the first ${request.pages}` : "them"}, handwriting, tables and
            equations included.
          </span>
        </p>
        <p className="text-muted">
          This sends {request.pages === 1 ? "the image" : `${request.pages} page images`} to your model provider and
          uses {request.pages === 1 ? "one request" : `about ${request.pages} requests`}. The transcription becomes the
          source’s text, marked as read by AI.
          {capped && ` Split longer scans to read the remaining ${pagesLabel(request.scannedPages - request.pages)}.`}
        </p>
        {offerApplyToRest && (
          <label htmlFor={checkboxId} className="flex items-center gap-2.5 text-muted">
            <input
              id={checkboxId}
              type="checkbox"
              checked={applyToRest}
              onChange={(e) => setApplyToRest(e.target.checked)}
              className="h-4 w-4 accent-[var(--brass)]"
            />
            Do the same for other photos and scans in this import
          </label>
        )}
        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <Button variant="ghost" onClick={() => answer(false)}>
            Keep without text
          </Button>
          <Button data-autofocus onClick={() => answer(true)}>
            {isPhoto ? "Read the photo" : `Read ${pagesLabel(request.pages)}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
