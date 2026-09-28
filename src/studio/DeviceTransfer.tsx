import { useEffect, useMemo, useRef, useState } from "react";
import { encode } from "uqr";
import { Check, Copy, DeviceMobile, LockKey } from "@phosphor-icons/react";
import { Button, Dialog, Field, Input } from "../ui";
import { ErrorNote, LampPulse } from "./ui";
import {
  TransferError,
  forgetTransfer,
  formatCode,
  parseTransferCode,
  receiveNotebook,
  relayOrigin,
  sendNotebook,
  transferLink,
  type SentNotebook,
} from "../lib/transfer";
import type { MergeResult } from "../lib/notebookMerge";
import "./device-transfer.css";

const reason = (err: unknown) =>
  err instanceof TransferError || err instanceof Error ? err.message : "Something went wrong. Try again.";

/** A QR code as SVG: dark modules on a light plate in either theme. */
function QrCode({ text, label }: { text: string; label: string }) {
  const qr = useMemo(() => encode(text, { ecc: "M", border: 2 }), [text]);
  const path = useMemo(() => {
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return d;
  }, [qr]);
  return (
    <svg className="qr-plate" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

/**
 * Sends a notebook to another device: sealed here, relayed for an hour,
 * opened there with the code. The code never goes to the server.
 */
export function SendToDeviceDialog({
  notebook,
  onClose,
}: {
  notebook: { id: string; name: string };
  onClose: () => void;
}) {
  const [sent, setSent] = useState<SentNotebook | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setSent(null);
    setError("");
    setProgress(null);
    sendNotebook(notebook.id, (done, total) => {
      if (current) setProgress({ done, total });
    })
      .then((result) => {
        // A send that finished after the dialog moved on is withdrawn.
        if (current) setSent(result);
        else void forgetTransfer(result.code);
      })
      .catch((err: unknown) => {
        if (current) setError(reason(err));
      });
    return () => {
      current = false;
    };
  }, [notebook.id, attempt]);

  const link = sent ? transferLink(sent.code, relayOrigin()) : "";
  const minutes = sent ? Math.max(1, Math.round((sent.expiresAt - Date.now()) / 60_000)) : 0;

  return (
    <Dialog open onClose={onClose} title="Send to another device">
      {error ? (
        <div className="space-y-4">
          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          </div>
        </div>
      ) : !sent ? (
        <div className="transfer-busy" role="status">
          <LampPulse
            label={
              progress && progress.total > 1
                ? `Sending part ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
                : `Sealing “${notebook.name}”…`
            }
          />
        </div>
      ) : (
        <div className="transfer-ready">
          <QrCode text={link} label={`QR code that opens “${notebook.name}” on another device`} />
          <div className="transfer-copy">
            <p>
              Scan this with your other device, or open Comtus there, choose <strong>Open → From another device</strong>,
              and enter:
            </p>
            <p className="transfer-code" aria-label={`Transfer code ${formatCode(sent.code).split("").join(" ")}`}>
              {formatCode(sent.code)}
            </p>
            <div className="transfer-actions">
              <CopyButton text={formatCode(sent.code)} label="Copy code" />
              <CopyButton text={link} label="Copy link" />
            </div>
            <p className="transfer-note">
              Works once, for the next {minutes} minutes. If that device already has this notebook, the two are merged.
            </p>
            <p className="transfer-note transfer-private">
              <LockKey size={15} aria-hidden="true" />
              Sealed on this device. The code is the key and never reaches our server, so the relay can't read your
              notebook.
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Receives a notebook sent from another device, by code or link. */
export function ReceiveFromDeviceDialog({
  initialCode = "",
  onClose,
  onReceived,
}: {
  initialCode?: string;
  onClose: () => void;
  onReceived: (result: MergeResult) => void;
}) {
  const [input, setInput] = useState(initialCode ? formatCode(parseTransferCode(initialCode) ?? initialCode) : "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  const receive = async (value = input) => {
    if (busy) return;
    setError("");
    setBusy("Opening…");
    try {
      const result = await receiveNotebook(value, (done, total) =>
        setBusy(total > 1 ? `Receiving part ${Math.min(done + 1, total)} of ${total}…` : "Opening…"),
      );
      onReceived(result);
    } catch (err) {
      setError(reason(err));
      setBusy(null);
    }
  };

  // A scanned link carries its code: start straight away.
  useEffect(() => {
    if (!initialCode || started.current || !parseTransferCode(initialCode)) return;
    started.current = true;
    void receive(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the link that opened this
  }, [initialCode]);

  return (
    <Dialog open onClose={onClose} title="From another device">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void receive();
        }}
      >
        <p className="flex gap-3 text-body leading-relaxed text-muted">
          <DeviceMobile size={20} className="mt-0.5 shrink-0 text-brass" aria-hidden="true" />
          <span>
            On the other device, open the notebook's menu and choose <strong className="text-ink">Send to another device</strong>
            . Then enter the code it shows.
          </span>
        </p>
        <Field label="Transfer code">
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="transfer-input"
          />
        </Field>
        {busy && <LampPulse label={busy} />}
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={!!busy} disabled={!parseTransferCode(input)}>
            Receive
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** The code in a "#receive=…" link this page was opened with, if any. */
export function receiveCodeFromHash(hash: string): string | null {
  const match = /^#receive=([0-9A-Za-z-]+)$/.exec(hash);
  return match ? parseTransferCode(match[1]) : null;
}
