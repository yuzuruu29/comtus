import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkle, CheckCircle, Warning, ArrowRight } from "@phosphor-icons/react";
import { exchangeOpenRouterCode } from "../lib/openrouterAuth";

export default function OpenRouterCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"connecting" | "success" | "error">("connecting");
  const [errorMsg, setErrorMsg] = useState("");

  const code = searchParams.get("code");

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setErrorMsg("No authorization code found in the callback URL.");
      return;
    }

    let cancelled = false;

    async function handleExchange() {
      try {
        await exchangeOpenRouterCode(code as string);
        if (!cancelled) {
          setStatus("success");
          // Short delay for visual confirmation before navigating to studio
          setTimeout(() => {
            navigate("/studio?connected=openrouter", { replace: true });
          }, 1200);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : "Failed to connect with OpenRouter.");
        }
      }
    }

    void handleExchange();

    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center bg-night px-6 text-parchment">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-brass/40 bg-ground/80 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl text-center">
        {status === "connecting" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brass/40 bg-brass/10 shadow-[0_0_24px_rgba(227,176,75,0.2)]">
              <Sparkle size={32} className="text-brass animate-spin" />
            </div>
            <h2 className="font-display text-[1.6rem] font-[450] text-parchment">
              Connecting Free AI Models…
            </h2>
            <p className="text-[13px] text-faded leading-relaxed">
              Exchanging authorization code and securely configuring your zero-setup study workspace.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-sage/40 bg-sage/15 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
              <CheckCircle size={32} className="text-sage" weight="fill" />
            </div>
            <h2 className="font-display text-[1.6rem] font-[450] text-sage">
              Connected Successfully!
            </h2>
            <p className="text-[13px] text-faded leading-relaxed">
              Your free models are active and ready. Entering your study room now…
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rust/40 bg-rust/15 shadow-[0_0_24px_rgba(239,68,68,0.2)]">
              <Warning size={32} className="text-rust" weight="fill" />
            </div>
            <h2 className="font-display text-[1.6rem] font-[450] text-rust">
              Connection Failed
            </h2>
            <p className="text-[13px] text-faded leading-relaxed">
              {errorMsg}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/studio")}
                className="inline-flex items-center gap-2 rounded-xl bg-brass px-5 py-2.5 font-mono text-[12px] font-semibold text-night hover:bg-brasspale transition-colors"
              >
                <span>Continue to Studio</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
