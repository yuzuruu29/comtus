import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { STUDY_PLANS } from "../lib/paypal";
import PayPalCheckout from "../studio/PayPalCheckout";
import { usePageMeta } from "../lib/usePageMeta";
import { Check, Copy, ShieldCheck } from "@phosphor-icons/react";
import { ICON } from "../ui/iconScale";

export default function HostedCheckout() {
  const [params] = useSearchParams();
  const requested = STUDY_PLANS.find((plan) => plan.id === params.get("plan"));
  const [planId, setPlanId] = useState(requested?.id ?? "scholar");
  const plan = STUDY_PLANS.find((candidate) => candidate.id === planId) ?? STUDY_PLANS[1];
  const [passToken, setPassToken] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  usePageMeta(
    "Smarter Models checkout — Comtus",
    "Top up hosted Claude Opus 5.5 and Sonnet 5.5 access with a one-time PayPal pass.",
  );

  async function copyPass(): Promise<void> {
    if (!passToken) return;
    try {
      await navigator.clipboard.writeText(passToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (http) — the raw token stays selectable below */
    }
  }

  return (
    <main className="min-h-[100svh] bg-ground px-5 py-10 text-ink sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link
          to="/"
          className="field-label inline-flex rounded-[var(--radius-control)] py-2 text-brass hover:text-ink"
        >
          COMTUS · SECURE CHECKOUT
        </Link>

        <section className="mt-8 rounded-[var(--radius-dialog)] border border-hairline bg-surface p-6 shadow-modal sm:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-1 rounded-[var(--radius-pill)] bg-sage/10 p-2 text-sage">
              <ShieldCheck size={ICON.xl} />
            </span>
            <div>
              <h1 className="font-display text-[clamp(1.8rem,5vw,2.6rem)] font-[450] leading-tight">
                Smarter Models access
              </h1>
              <p className="mt-2 text-body leading-relaxed text-muted">
                Complete payment in this browser window. Your desktop notebooks and provider keys
                never leave the app.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-2 sm:grid-cols-3" aria-label="Choose an access plan">
            {STUDY_PLANS.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={candidate.id === plan.id}
                onClick={() => setPlanId(candidate.id)}
                className={`rounded-[var(--radius-control)] border px-3 py-3 text-left transition-colors ${
                  candidate.id === plan.id
                    ? "border-brass/50 bg-brass/10 text-ink"
                    : "border-hairline text-muted hover:border-hairline-strong hover:text-ink"
                }`}
              >
                <span className="block text-[12px] font-medium">{candidate.name}</span>
                <span className="mt-1 block font-mono text-[11px]">${candidate.price}</span>
              </button>
            ))}
          </div>

          <div className="my-6 border-y border-hairline py-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-display text-title">{plan.name}</span>
              <span className="font-mono text-title text-brass">${plan.price}</span>
            </div>
            <p className="mt-1 text-[12px] text-muted">{plan.desc} · {plan.days} days</p>
          </div>

          <PayPalCheckout
            plan={plan}
            onSuccess={(token, paidOrderId) => {
              setPassToken(token);
              setOrderId(paidOrderId);
              setCopied(false);
            }}
          />

          {passToken && (
            <div className="mt-5 space-y-3 rounded-[var(--radius-control)] border border-sage/30 bg-sage/[0.08] p-4">
              <p className="text-[12px] leading-relaxed text-sage">
                Payment confirmed — your Access Pass is ready. Copy it into Comtus Desktop →
                Settings → Models → Access Pass to activate hosted models.
              </p>
              <div className="flex items-stretch gap-2">
                <code
                  className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-[var(--radius-control)] border border-hairline bg-ink/[0.03] px-2.5 py-2 font-mono text-[11px] text-ink"
                  title={passToken}
                >
                  {passToken}
                </code>
                <button
                  type="button"
                  onClick={() => void copyPass()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-brass/40 px-3 py-2 text-[12px] font-medium text-brass transition-colors hover:bg-brass/10"
                >
                  {copied ? <Check size={ICON.sm} /> : <Copy size={ICON.sm} />}
                  {copied ? "Copied" : "Copy pass"}
                </button>
              </div>
              {orderId && (
                <p className="font-mono text-[12px] text-ink">PayPal order id: {orderId}</p>
              )}
              <p className="text-[11px] text-faint">
                This pass is shown only here. Keep the order id — it restores the pass if you lose the token.
              </p>
            </div>
          )}

          {!passToken && (
            <p className="mt-5 text-center text-[11px] leading-relaxed text-faint">
              After payment, your Access Pass appears right here — copy it into Comtus Desktop →
              Settings → Models.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
