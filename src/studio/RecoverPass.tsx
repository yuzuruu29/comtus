import { useState } from "react";
import { inputCls } from "./ui";
import { trackEvent } from "../lib/analytics";

/** Restore a paid pass from its PayPal order id. The server holds the
 *  order-to-pass mapping; this only posts the id and activates the token
 *  it returns. */
export default function RecoverPass({ onPass }: { onPass: (code: string) => void }) {
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const restore = async () => {
    setErr("");
    setBusy(true);
    try {
      const origin = ((import.meta.env.VITE_API_ORIGIN as string) || window.location.origin).replace(/\/+$/, "");
      const res = await fetch(`${origin}/api/paypal/recover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { passToken?: string; error?: string };
      if (!res.ok || !data.passToken) throw new Error(data.error || "Could not restore that pass.");
      trackEvent("pass_activated", { source: "recover" });
      onPass(data.passToken);
      setOrderId("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not restore that pass.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="PayPal order id"
          className={inputCls + " font-mono text-small flex-1"}
          spellCheck={false}
        />
        <button
          type="button"
          disabled={busy || orderId.trim().length < 5}
          onClick={() => void restore()}
          className="rounded-[var(--radius-dialog)] bg-brass px-4 py-2 text-label font-semibold text-ground hover:bg-brass-deep transition-colors disabled:opacity-50"
        >
          {busy ? "Restoring…" : "Restore"}
        </button>
      </div>
      {err && <p className="text-small text-rust">{err}</p>}
    </div>
  );
}
