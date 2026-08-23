import { useEffect, useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { deleteNotebook } from "../lib/db";
import { exportBackup, importBackup, importBackupNative } from "../lib/backup";
import { isTauri } from "../lib/desktop";
import { useSettings } from "../lib/settings";
import { formatBytes, getStorageStats, type StorageStats } from "../lib/storageStats";
import { ComtusEmblem } from "../components/brand/ComtusLogo";
import { btnGhost, timeAgo } from "./ui";

function formatBackupAt(ts: number): string {
  if (!ts) return "No backup on this device yet";
  return `Last backup ${timeAgo(ts)}`;
}

/** Storage transparency + backup/export. Lives in Settings. */
export default function DataTrustPanel({ open }: { open: boolean }) {
  const lastBackupAt = useSettings((s) => s.lastBackupAt) ?? 0;
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = () => {
    void getStorageStats().then(setStats);
  };

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open]);

  const handleExport = async () => {
    setBusy(true);
    setErr(false);
    setMsg("");
    try {
      const saved = await exportBackup();
      if (saved) setMsg(isTauri() ? "Backup saved." : "Backup saved to your downloads.");
    } catch {
      setErr(true);
      setMsg("Export failed. Please retry.");
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy(true);
    setErr(false);
    setMsg("");
    try {
      const count = await importBackup(file);
      setMsg(`Restored ${count.toLocaleString()} records.`);
      refresh();
    } catch (e) {
      setErr(true);
      setMsg(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleImportNative = async () => {
    setBusy(true);
    setErr(false);
    setMsg("");
    try {
      const count = await importBackupNative();
      if (count === null) return;
      setMsg(`Restored ${count.toLocaleString()} records.`);
      refresh();
    } catch (e) {
      setErr(true);
      setMsg(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await deleteNotebook(id);
    setConfirmId(null);
    refresh();
  };

  const quota =
    stats?.quotaBytes != null && stats.usageBytes != null
      ? `${formatBytes(stats.usageBytes)} of ${formatBytes(stats.quotaBytes)} on this device`
      : stats
        ? formatBytes(stats.totalBytes)
        : null;

  return (
    <div className="rounded-xl border border-hairline bg-ink/[0.02] px-4 py-3.5">
      <div className="flex items-center gap-2 text-body text-ink/85">
        <ComtusEmblem size={16} />
        Your data
      </div>
      <p className="mt-1.5 text-label leading-relaxed text-muted">
        Notebooks, sources, and history are stored on this device. Relevant source
        text is sent only when you ask the model you selected; backups leave the
        app only when you export them.
      </p>
      {quota && (
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
          {quota}
        </p>
      )}

      {stats && stats.notebooks.length > 0 && (
        <ul className="mt-3 space-y-1">
          {stats.notebooks.map((nb) => (
            <li
              key={nb.id}
              className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-ink/[0.03]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink/90">{nb.name}</span>
                <span className="block font-mono text-[10px] text-muted">
                  {nb.sources} sources · {formatBytes(nb.bytes)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => (confirmId === nb.id ? void remove(nb.id) : setConfirmId(nb.id))}
                onBlur={() => setConfirmId(null)}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] ${
                  confirmId === nb.id ? "bg-rust/15 text-rust" : "text-muted/60 hover:text-rust"
                }`}
                aria-label={confirmId === nb.id ? `Confirm delete ${nb.name}` : `Delete ${nb.name}`}
              >
                <Trash size={13} weight="light" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={busy}
          className={btnGhost + " !px-3 !py-1.5 text-label"}
        >
          {busy ? "Working…" : "Export backup"}
        </button>
        {isTauri() ? (
          <button
            type="button"
            onClick={() => void handleImportNative()}
            disabled={busy}
            className={btnGhost + " !px-3 !py-1.5 text-label"}
          >
            Import backup
          </button>
        ) : (
          <label
            className={
              btnGhost +
              " cursor-pointer !px-3 !py-1.5 text-label" +
              (busy ? " pointer-events-none opacity-50" : "")
            }
          >
            Import backup
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {msg && (
          <span
            role={err ? "alert" : "status"}
            aria-live={err ? "assertive" : "polite"}
            className={`text-label ${err ? "text-rust" : "text-sage"}`}
          >
            {msg}
          </span>
        )}
      </div>
      <p className="mt-2 font-mono text-[10.5px] text-muted">{formatBackupAt(lastBackupAt)}</p>
    </div>
  );
}
