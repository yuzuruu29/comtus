import { useEffect, useRef, useState } from "react";

import { PAYPAL_CLIENT_ID, type StudyPlan } from "../lib/paypal";
import { isTauri } from "../lib/desktop";
import ExternalLink from "./ExternalLink";
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { ICON } from "../ui/iconScale";

/**
 * PayPal checkout. Money logic lives server-side: order creation uses
 * server-owned prices (api/paypal/create-order) and capture + pass issuance
 * happen on the server after buyer approval (api/paypal/capture-order).
 * The browser SDK only renders the button and collects approval.
 */

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        style?: {
          layout?: "vertical" | "horizontal";
          color?: "gold" | "blue" | "silver" | "white" | "black";
          shape?: "rect" | "pill";
          label?: "paypal" | "checkout" | "buynow" | "pay";
          height?: number;
        };
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError: (err: unknown) => void;
      }) => {
        render: (container: HTMLElement) => Promise<void>;
      };
    };
  }
}

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }

export default function PayPalCheckout({
  plan,
  onSuccess,
}: {
  plan: StudyPlan;
  onSuccess: (passToken: string, orderId: string) => void;
}) {
  const native = isTauri();
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  // Load PayPal SDK script
  useEffect(() => {
    if (native) return;
    if (window.paypal) {
      setSdkReady(true);
      return;
    }

    const scriptId = "paypal-sdk-script";
    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.addEventListener("load", () => setSdkReady(true));
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("Failed to load PayPal checkout SDK. Check internet connection.");
    document.body.appendChild(script);
  }, [native]);

  // Render PayPal Buttons when SDK is ready & plan is selected
  useEffect(() => {
    if (native || !sdkReady || !containerRef.current || !window.paypal) return;

    // Clear previous button render
    containerRef.current.innerHTML = "";

    try {
      window.paypal
        .Buttons({
          style: {
            layout: "horizontal",
            color: "gold",
            shape: "rect",
            label: "paypal",
            height: 38,
          },
          createOrder: async () => {
            setError("");
            // Server owns the price — the browser only names the plan.
            const { orderId } = await postJson<{ orderId: string }>("/api/paypal/create-order", {
              planId: plan.id,
            });
            return orderId;
          },
          onApprove: async (data) => {
            setLoading(true);
            try {
              // Capture happens on the server, which verifies the amount
              // against PayPal's records and issues the pass instantly.
              const { passToken } = await postJson<{ passToken: string }>(
                "/api/paypal/capture-order",
                { orderId: data.orderID, planId: plan.id },
              );
              setSuccess(data.orderID);
              onSuccess(passToken, data.orderID);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Payment capture failed.");
            } finally {
              setLoading(false);
            }
          },
          onError: (err) => {
            setError(err instanceof Error ? err.message : "PayPal transaction error.");
          },
        })
        .render(containerRef.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize PayPal button.");
    }
  }, [native, sdkReady, plan, onSuccess]);

  if (native) {
    const website = import.meta.env.VITE_API_ORIGIN || "https://comtus-ai.vercel.app";
    return (
      <div className="space-y-3 rounded-[var(--radius-control)] border border-hairline bg-ink/[0.02] p-4 text-[12px] leading-relaxed text-muted">
        <p>
          Checkout opens on the Comtus website so payment code never runs inside the privileged
          desktop workspace. Your Access Pass activates automatically right after payment.
        </p>
        <ExternalLink
          href={`${website}/checkout?plan=${plan.id}`}
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] border border-brass/40 px-4 py-2 font-medium text-brass hover:bg-brass/10"
        >
          Continue securely in browser · {plan.name}
        </ExternalLink>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div key="error" className="anim-fade anim-fade--fast flex items-center gap-2 rounded-[var(--radius-field)] border border-rust/30 bg-rust/[0.08] p-2.5 text-[12px] text-rust">
          <WarningCircle size={ICON.sm} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div key="success" className="anim-fade anim-fade--fast flex items-start gap-2 rounded-[var(--radius-field)] border border-sage/30 bg-sage/[0.08] p-2.5 text-left text-[12px] leading-relaxed text-sage">
          <CheckCircle size={ICON.sm} className="mt-0.5 shrink-0" />
          <span>
            Payment confirmed. Order {success}. Your Access Pass has been issued. Keep this order id — it restores the pass.
          </span>
        </div>
      )}

      {!sdkReady && !error && (
        <div key="sdk-loading" className="anim-fade anim-fade--fast flex items-center justify-center gap-2 rounded-[var(--radius-field)] border border-hairline bg-ink/[0.02] py-3 text-[12px] text-muted">
          <CircleNotch size={ICON.sm} className="animate-spin text-brass" />
          <span>Loading secure PayPal checkout…</span>
        </div>
      )}

      {loading && (
        <div key="confirming" className="anim-fade anim-fade--fast flex items-center justify-center gap-2 rounded-[var(--radius-field)] border border-brass/30 bg-brass/[0.06] py-3 text-[12px] text-brass">
          <CircleNotch size={ICON.sm} className="animate-spin text-brass" />
          <span>Confirming payment & activating your pass…</span>
        </div>
      )}

      <div ref={containerRef} className="min-h-[38px] w-full" />
    </div>
  );
}
