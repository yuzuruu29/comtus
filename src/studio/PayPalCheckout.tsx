import { useEffect, useRef, useState } from "react";

import { PAYPAL_CLIENT_ID, type StudyPlan } from "../lib/paypal";
import { formatUsdFromNano } from "../lib/credits";
import { isTauri } from "../lib/desktop";
import ExternalLink from "./ExternalLink";
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { ICON } from "../ui/iconScale";

type ApprovedOrder = { orderId: string; planId: string; planName: string; budgetNano: number };
type ReviewedOrder = ApprovedOrder & { price: string; discounted: boolean; reviewToken: string };
const CHECKOUT_STORAGE_KEY = "comtus-pending-checkout";

function readPendingCheckout(): { approved: ApprovedOrder; review: ReviewedOrder | null } | null {
  try {
    const data = JSON.parse(sessionStorage.getItem(CHECKOUT_STORAGE_KEY) ?? "null");
    const approved = data?.approved;
    if (!approved || typeof approved.orderId !== "string" || typeof approved.planId !== "string" || typeof approved.planName !== "string" || typeof approved.budgetNano !== "number") return null;
    const review = data.review;
    if (review && (typeof review.price !== "string" || typeof review.discounted !== "boolean" || typeof review.reviewToken !== "string")) return { approved, review: null };
    return { approved, review: review ? { ...approved, price: review.price, discounted: review.discounted, reviewToken: review.reviewToken } : null };
  } catch {
    return null;
  }
}

function savePendingCheckout(approved: ApprovedOrder | null, review: ReviewedOrder | null): void {
  try {
    if (approved) sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({ approved, review }));
    else sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
  } catch {
    // The order ID remains visible even when browser storage is unavailable.
  }
}

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

class CheckoutError extends Error {
  constructor(message: string, readonly restartCheckout: boolean) { super(message); }
}

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; restartCheckout?: boolean };
    if (!res.ok) throw new CheckoutError(data.error || "Something went wrong. Please try again.", data.restartCheckout === true);
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
  const [pending] = useState(readPendingCheckout);
  const [approved, setApproved] = useState<ApprovedOrder | null>(pending?.approved ?? null);
  const [review, setReview] = useState<ReviewedOrder | null>(pending?.review ?? null);

  async function prepareOrder(order: ApprovedOrder): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const prepared = await postJson<{ price: string; discounted: boolean; reviewToken: string }>("/api/paypal/prepare-order", order);
      const next = { ...prepared, ...order };
      savePendingCheckout(order, next);
      setReview(next);
    } catch (err) {
      if (err instanceof CheckoutError && err.restartCheckout) {
        savePendingCheckout(null, null);
        setApproved(null);
        setReview(null);
      }
      setError(err instanceof Error ? err.message : "Could not prepare the final price.");
    } finally {
      setLoading(false);
    }
  }

  // Load PayPal SDK script
  useEffect(() => {
    if (native) return;
    if (!PAYPAL_CLIENT_ID) {
      setError("Checkout is temporarily unavailable. Please try again later.");
      return;
    }
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
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture&commit=false`;
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
            const order = { orderId: data.orderID, planId: plan.id, planName: plan.name, budgetNano: plan.budgetNano };
            savePendingCheckout(order, null);
            setApproved(order);
            await prepareOrder(order);
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

  async function confirmPayment(): Promise<void> {
    if (!review || loading) return;
    setLoading(true);
    setError("");
    try {
      const { passToken } = await postJson<{ passToken: string }>("/api/paypal/capture-order", review);
      setSuccess(review.orderId);
      onSuccess(passToken, review.orderId);
      savePendingCheckout(null, null);
      setApproved(null);
      setReview(null);
    } catch (err) {
      if (err instanceof CheckoutError && err.restartCheckout) {
        savePendingCheckout(null, null);
        setApproved(null);
        setReview(null);
      }
      setError(err instanceof Error ? err.message : "Payment capture failed.");
    } finally {
      setLoading(false);
    }
  }

  if (native) {
    const website = import.meta.env.VITE_API_ORIGIN || "https://comtus-ai.vercel.app";
    return (
      <div className="space-y-3 rounded-[var(--radius-control)] border border-hairline bg-ink/[0.02] p-4 text-small leading-relaxed text-muted">
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
        <div key="error" className="anim-fade anim-fade--fast flex items-center gap-2 rounded-[var(--radius-field)] border border-rust/30 bg-rust/[0.08] p-2.5 text-small text-rust">
          <WarningCircle size={ICON.sm} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div key="success" className="anim-fade anim-fade--fast flex items-start gap-2 rounded-[var(--radius-field)] border border-sage/30 bg-sage/[0.08] p-2.5 text-left text-small leading-relaxed text-sage">
          <CheckCircle size={ICON.sm} className="mt-0.5 shrink-0" />
          <span>
            Payment confirmed. Order {success}. Your Access Pass has been issued. Keep this order id — it restores the pass.
          </span>
        </div>
      )}

      {!sdkReady && !error && (
        <div key="sdk-loading" className="anim-fade anim-fade--fast flex items-center justify-center gap-2 rounded-[var(--radius-field)] border border-hairline bg-ink/[0.02] py-3 text-small text-muted">
          <CircleNotch size={ICON.sm} className="animate-spin text-brass" />
          <span>Loading secure PayPal checkout…</span>
        </div>
      )}

      {loading && (
        <div key="confirming" className="anim-fade anim-fade--fast flex items-center justify-center gap-2 rounded-[var(--radius-field)] border border-brass/30 bg-brass/[0.06] py-3 text-small text-brass">
          <CircleNotch size={ICON.sm} className="animate-spin text-brass" />
          <span>Confirming payment & activating your pass…</span>
        </div>
      )}

      {approved && (
        <div className="rounded-[var(--radius-field)] border border-brass/30 p-3 text-body text-ink">
          <p>PayPal order ID: {approved.orderId}. Keep this ID to restore your pass if payment is interrupted.</p>
          {review && <p>{review.planName} final price: <strong>${review.price} USD</strong>{review.discounted ? "; first-purchase offer applied" : "; regular price"}.</p>}
          {review && <p>{formatUsdFromNano(review.budgetNano)} hosted usage included. Usage does not expire.</p>}
          <button type="button" disabled={loading} onClick={() => void (review ? confirmPayment() : prepareOrder(approved))} className="mt-2 rounded-[var(--radius-control)] border border-brass/40 px-3 py-2 text-brass disabled:opacity-50">
            {review ? "Confirm payment" : "Retry price review"}
          </button>
        </div>
      )}
      <div ref={containerRef} className={`min-h-[38px] w-full ${approved ? "hidden" : ""}`} />
    </div>
  );
}
