import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { PAYPAL_CLIENT_ID, type StudyPlan } from "../lib/paypal";

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
        createOrder: (data: unknown, actions: {
          order: {
            create: (orderPayload: {
              purchase_units: {
                description: string;
                amount: { currency_code: string; value: string };
              }[];
            }) => Promise<string>;
          };
        }) => Promise<string>;
        onApprove: (
          data: { orderID: string },
          actions: { order: { capture: () => Promise<unknown> } },
        ) => Promise<void>;
        onError: (err: unknown) => void;
      }) => {
        render: (container: HTMLElement) => Promise<void>;
      };
    };
  }
}

export default function PayPalCheckout({
  plan,
  onSuccess,
}: {
  plan: StudyPlan;
  onSuccess: (passToken: string, orderId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  // Load PayPal SDK script
  useEffect(() => {
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
  }, []);

  // Render PayPal Buttons when SDK is ready & plan is selected
  useEffect(() => {
    if (!sdkReady || !containerRef.current || !window.paypal) return;

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
          createOrder: (_data, actions) => {
            setError("");
            return actions.order.create({
              purchase_units: [
                {
                  description: `Comtus Smarter Models — ${plan.name} (${plan.tokens})`,
                  amount: {
                    currency_code: "USD",
                    value: plan.price,
                  },
                },
              ],
            });
          },
          onApprove: async (data, actions) => {
            setLoading(true);
            try {
              await actions.order.capture();
              setSuccess(data.orderID);
              // The pass is issued server-side after payment verification
              // and emailed to the buyer — never generated in the browser.
              onSuccess("", data.orderID);
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
  }, [sdkReady, plan, onSuccess]);

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rust/30 bg-rust/[0.08] p-2.5 text-[12px] text-rust">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-sage/30 bg-sage/[0.08] p-2.5 text-left text-[12px] leading-relaxed text-sage">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>
            Payment confirmed (Order #{success.slice(-8)}). Your personal Access Pass will be
            emailed to you shortly — paste it below to activate.
          </span>
        </div>
      )}

      {!sdkReady && !error && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-hairline bg-ink/[0.02] py-3 text-[12px] text-muted">
          <Loader2 size={14} className="animate-spin text-brass" />
          <span>Loading secure PayPal checkout…</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-brass/30 bg-brass/[0.06] py-3 text-[12px] text-brasspale">
          <Loader2 size={14} className="animate-spin text-brass" />
          <span>Confirming order & issuing pass token…</span>
        </div>
      )}

      <div ref={containerRef} className="min-h-[38px] w-full" />
    </div>
  );
}
