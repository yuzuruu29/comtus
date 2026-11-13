import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { FIRST_TOPUP_OFFER, STUDY_PLANS } from "../lib/paypal";
import PayPalCheckout from "../studio/PayPalCheckout";
import { usePageMeta } from "../lib/usePageMeta";
import { trackEvent } from "../lib/analytics";
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
  useEffect(() => {
    trackEvent("checkout_opened", { plan: requested?.id ?? "scholar" });
  }, [requested?.id]);

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
          className="field-label inline-flex items-baseline gap-2.5 rounded-[var(--radius-control)] py-2 text-brass hover:text-ink"
        >
          <span>Comtus</span>
          <span className="font-normal text-muted">Secure checkout</span>
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
                <span className="block text-small font-medium">{candidate.name}</span>
                <span className="mt-1 block text-label tabular-nums">${candidate.price} first top-up, then ${candidate.regularPrice}</span>
              </button>
            ))}
          </div>

          <div className="my-6 border-y border-hairline py-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-display text-title">{plan.name}</span>
              <span className="text-title tabular-nums text-brass">
                <s className="mr-2 text-body text-muted">${plan.regularPrice}</s>${plan.price}
              </span>
            </div>
            <p className="mt-1 text-small text-muted">{plan.desc} The pass never expires. One-time payment, no automatic renewal.</p>
            <p className="mt-3 text-body text-ink">{FIRST_TOPUP_OFFER}</p>          </div>

          <PayPalCheckout
            plan={plan}
            onSuccess={(token, paidOrderId) => {
              setPassToken(token);
              setOrderId(paidOrderId);
              setCopied(false);
              trackEvent("pass_purchased", { plan: plan.id });
            }}
          />

          {passToken && (
            <div className="mt-5 space-y-3 rounded-[var(--radius-control)] border border-sage/30 bg-sage/[0.08] p-4">
              <p className="text-small leading-relaxed text-sage">
                Payment confirmed — your Access Pass is ready. Copy it into Comtus Desktop →
                Settings → Models → Access Pass to activate hosted models.
              </p>
              <div className="flex items-stretch gap-2">
                <code
                  className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-[var(--radius-control)] border border-hairline bg-ink/[0.03] px-2.5 py-2 font-mono text-label text-ink"
                  title={passToken}
                >
                  {passToken}
                </code>
                <button
                  type="button"
                  onClick={() => void copyPass()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-brass/40 px-3 py-2 text-small font-medium text-brass transition-colors hover:bg-brass/10"
                >
                  {copied ? <Check size={ICON.sm} /> : <Copy size={ICON.sm} />}
                  {copied ? "Copied" : "Copy pass"}
                </button>
              </div>
              {orderId && (
                <p className="font-mono text-small text-ink">PayPal order id: {orderId}</p>
              )}
              <p className="text-label text-faint">
                This pass is shown only here. Keep the order id — it restores the pass if you lose the token.
              </p>
            </div>
          )}

          {!passToken && (
            <p className="mt-5 text-center text-label leading-relaxed text-faint">
              After payment, your Access Pass appears right here — copy it into Comtus Desktop →
              Settings → Models.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
