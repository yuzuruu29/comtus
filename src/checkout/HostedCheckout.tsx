import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "@phosphor-icons/react";
import { STUDY_PLANS } from "../lib/paypal";
import PayPalCheckout from "../studio/PayPalCheckout";

export default function HostedCheckout() {
  const [params] = useSearchParams();
  const requested = STUDY_PLANS.find((plan) => plan.id === params.get("plan"));
  const [planId, setPlanId] = useState(requested?.id ?? "scholar");
  const plan = STUDY_PLANS.find((candidate) => candidate.id === planId) ?? STUDY_PLANS[1];

  return (
    <main className="min-h-[100svh] bg-ground px-5 py-10 text-ink sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link
          to="/"
          className="label-mono inline-flex rounded-[var(--radius-control)] py-2 text-brasspale hover:text-ink"
        >
          COMTUS · SECURE CHECKOUT
        </Link>

        <section className="mt-8 rounded-[var(--radius-dialog)] border border-hairline bg-surface p-6 shadow-modal sm:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-1 rounded-full bg-sage/10 p-2 text-sage">
              <ShieldCheck size={20} weight="light" />
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
              <span className="font-mono text-title text-brasspale">${plan.price}</span>
            </div>
            <p className="mt-1 text-[12px] text-muted">{plan.requests} hosted requests · {plan.days} days · {plan.desc}</p>
          </div>

          <PayPalCheckout plan={plan} onSuccess={() => undefined} />

          <p className="mt-5 text-center text-[11px] leading-relaxed text-faint">
            After payment, return to Comtus Desktop → Settings → Models and paste the Access Pass
            sent to your email.
          </p>
        </section>
      </div>
    </main>
  );
}
