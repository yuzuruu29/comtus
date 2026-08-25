import { useEffect, useRef, useState } from "react";
import {
  CaretDown,
  Check,
  Copy,
  Crown,
  PaperPlaneRight,
  Plug,
  SpinnerGap,
  Warning,
} from "@phosphor-icons/react";
import { inputCls } from "./ui";
import { useSettings } from "../lib/settings";
import { MODELS } from "../lib/llm";
import {
  startClaudeOAuth,
  completeClaudeOAuth,
  startCodexOAuth,
  completeCodexOAuth,
  startCodexDeviceAuth,
  openCodexDevicePage,
  pollCodexDeviceAuth,
  disconnectOAuth,
  type CodexDeviceSession,
} from "../lib/oauthProviders";
import type { OAuthAccount } from "../lib/types";

/**
 * "Use your subscription" cards — sign in with an existing Claude
 * (Pro/Max) or ChatGPT (Plus/Pro) account and Comtus routes chat through
 * it, no API key involved.
 *
 * Claude uses a manual hand-off (the code Claude's callback page displays,
 * pasted back). ChatGPT uses OpenAI's device flow: a short code the student
 * enters at auth.openai.com/codex/device — no redirect URI, nothing lands
 * on a dead localhost page. The old paste-a-redirect-URL flow stays as a
 * fallback link.
 */

type Stage = "idle" | "paste" | "code";

export default function SubscriptionConnect() {
  const s = useSettings();
  const [claudeStage, setClaudeStage] = useState<Stage>("idle");
  const [claudeCode, setClaudeCode] = useState("");
  const [codexStage, setCodexStage] = useState<Stage>("idle");
  const [codexCode, setCodexCode] = useState("");
  const [deviceSession, setDeviceSession] = useState<CodexDeviceSession | null>(null);
  const [deviceWaiting, setDeviceWaiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"" | "claude" | "codex">("");
  const [err, setErr] = useState("");
  const pollAbort = useRef<AbortController | null>(null);

  // Stop polling when the settings sheet closes (component unmounts).
  useEffect(() => () => pollAbort.current?.abort(), []);

  const fail = (who: "claude" | "codex", e: unknown) => {
    setErr(`${who === "claude" ? "Claude" : "ChatGPT"}: ${e instanceof Error ? e.message : "sign-in failed"}`);
    setBusy("");
  };

  const openClaude = async () => {
    setErr("");
    setBusy("claude");
    try {
      await startClaudeOAuth();
      setClaudeStage("paste");
    } catch (e) {
      fail("claude", e);
      return;
    }
    setBusy("");
  };

  const finishClaude = async () => {
    setErr("");
    setBusy("claude");
    try {
      await completeClaudeOAuth(claudeCode);
    } catch (e) {
      fail("claude", e);
      return;
    }
    setBusy("");
    setClaudeStage("idle");
    setClaudeCode("");
  };

  /** Device flow: the OpenAI page opens first (while the click still
   *  counts as a user gesture), then the code is minted and shown. */
  const openCodex = async () => {
    setErr("");
    setBusy("codex");
    pollAbort.current?.abort();
    const controller = new AbortController();
    pollAbort.current = controller;
    try {
      await openCodexDevicePage();
      const session = await startCodexDeviceAuth();
      if (controller.signal.aborted) return;
      setDeviceSession(session);
      setCodexStage("code");
      setBusy("");
      setDeviceWaiting(true);
      try {
        await pollCodexDeviceAuth(session, controller.signal);
      } catch (e) {
        if (!controller.signal.aborted) fail("codex", e);
      } finally {
        if (!controller.signal.aborted) setDeviceWaiting(false);
      }
    } catch (e) {
      if (!controller.signal.aborted) fail("codex", e);
    }
  };

  const finishCodex = async () => {
    setErr("");
    setBusy("codex");
    try {
      await completeCodexOAuth(codexCode);
    } catch (e) {
      fail("codex", e);
      return;
    }
    setBusy("");
    setCodexStage("idle");
    setCodexCode("");
  };

  const cancelCodex = () => {
    pollAbort.current?.abort();
    setDeviceSession(null);
    setDeviceWaiting(false);
    setCodexStage("idle");
    setCodexCode("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display text-[15px] font-[450] text-ink">
            Or Use a Subscription You Already Have
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted">No API keys</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <SubscriptionCard
          tone="claude"
          title="Claude Pro / Max"
          desc="Sign in at claude.ai, then paste the verification code Claude shows you."
          account={s.claudeOAuth}
          isActive={s.provider === "claude-oauth"}
          stage={claudeStage}
          code={claudeCode}
          setCode={setClaudeCode}
          busy={busy === "claude"}
          pasteHint="e.g. 8f3a…#9c21… — the code#state pair from the authorization page"
          onOpen={() => void openClaude()}
          onFinish={() => void finishClaude()}
          onCancel={() => {
            setClaudeStage("idle");
            setClaudeCode("");
          }}
          onUse={() => s.update({ provider: "claude-oauth" })}
          onModel={(id) => s.update({ provider: "claude-oauth", claudeOauthModel: id as never })}
          activeModel={s.claudeOauthModel}
          models={MODELS.map((m) => ({ id: m.id, label: m.label, note: m.note }))}
          onDisconnect={() => {
            disconnectOAuth("claude-oauth");
            if (s.provider === "claude-oauth") s.update({ provider: "openai-compatible" });
          }}
        />

        <SubscriptionCard
          tone="codex"
          title="ChatGPT Plus / Pro"
          desc="Sign in with ChatGPT — we show a short code, you enter it on OpenAI's device page. Done."
          account={s.codexOAuth}
          isActive={s.provider === "codex"}
          stage={codexStage}
          code={codexCode}
          setCode={setCodexCode}
          busy={busy === "codex"}
          pasteHint="paste the whole address bar URL — it starts with http://localhost:1455/auth/callback?code=…"
          onOpen={() => void openCodex()}
          onFinish={() => void finishCodex()}
          onCancel={cancelCodex}
          onUse={() => s.update({ provider: "codex" })}
          onModel={(id) => s.update({ provider: "codex", codexModel: id })}
          activeModel={s.codexModel}
          models={s.codexModels.map((m) => ({
            id: m.id,
            label: m.label,
            note: m.ctx ? `${m.ctx} context` : "",
          }))}
          onDisconnect={() => {
            disconnectOAuth("codex");
            if (s.provider === "codex") s.update({ provider: "openai-compatible" });
          }}
          device={
            codexStage === "code"
              ? {
                  session: deviceSession,
                  waiting: deviceWaiting,
                  copied,
                  onCopy: () => {
                    if (deviceSession) {
                      void navigator.clipboard.writeText(deviceSession.userCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  },
                  onFallback: () => {
                    pollAbort.current?.abort();
                    setDeviceWaiting(false);
                    setCodexStage("paste");
                    void startCodexOAuth();
                  },
                }
              : undefined
          }
        />
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-xl border border-rust/30 bg-rust/[0.06] px-3.5 py-2.5 text-[12px] text-rust">
          <Warning size={14} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted/70">
        Subscription sign-ins use the providers' own login flows; their plan limits and fair-use
        rules apply. Tokens stay in this browser and refresh automatically.
      </p>
    </div>
  );
}

function SubscriptionCard({
  tone,
  title,
  desc,
  account,
  isActive,
  stage,
  code,
  setCode,
  busy,
  pasteHint,
  onOpen,
  onFinish,
  onCancel,
  onUse,
  onModel,
  activeModel,
  models,
  onDisconnect,
  device,
}: {
  tone: "claude" | "codex";
  title: string;
  desc: string;
  account: OAuthAccount | null;
  isActive: boolean;
  stage: Stage;
  code: string;
  setCode: (v: string) => void;
  busy: boolean;
  pasteHint: string;
  onOpen: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onUse: () => void;
  onModel: (id: string) => void;
  activeModel: string;
  models: { id: string; label: string; note: string }[];
  onDisconnect: () => void;
  device?: {
    session: CodexDeviceSession | null;
    waiting: boolean;
    copied: boolean;
    onCopy: () => void;
    onFallback: () => void;
  };
}) {
  const connected = Boolean(account?.accessToken);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${
        isActive
          ? "border-brass/70 bg-brass/[0.12] shadow-[0_0_24px_rgba(227,176,75,0.16)] ring-1 ring-brass/50"
          : "border-hairline bg-ground/50 hover:border-hairline-strong"
      }`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-3 top-0 z-[1] h-[2px] origin-left rounded-full grad-lamp transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] ${
          isActive ? "scale-x-100" : "scale-x-0"
        }`}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
              isActive
                ? "border-brass/50 bg-brass/25 text-brasspale"
                : "border-hairline bg-white/[0.04] text-muted"
            }`}
          >
            {tone === "claude" ? <Crown size={16} weight={isActive ? "fill" : "regular"} /> : <Plug size={16} />}
          </span>
          <div>
            <div className="font-display text-[14px] font-[500] text-ink leading-tight">{title}</div>
            <div className="font-mono text-[10px] text-muted/80 mt-0.5">
              {account?.email || (connected ? "account connected" : "OAuth sign-in")}
            </div>
          </div>
        </div>
        {connected ? (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold ${
              isActive
                ? "bg-brass/25 border border-brass/40 text-brasspale"
                : "bg-sage/15 border border-sage/30 text-sage"
            }`}
          >
            {isActive ? (
              <>
                <Check size={10} weight="bold" /> Active
              </>
            ) : (
              "Connected"
            )}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-ink/[0.04] border border-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
            Optional
          </span>
        )}
      </div>

      {!connected && stage === "idle" && (
        <>
          <p className="mt-2.5 text-[11.5px] leading-snug text-muted">{desc}</p>
          <button
            type="button"
            onClick={onOpen}
            disabled={busy}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-brass px-4 py-2 font-mono text-[11.5px] font-semibold text-night shadow-[0_2px_14px_rgba(227,176,75,0.25)] hover:bg-brasspale active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {busy ? "Opening sign-in…" : "Sign in →"}
          </button>
        </>
      )}

      {!connected && stage === "code" && device?.session && (
        <div className="mt-3 space-y-2.5">
          <p className="text-[11.5px] leading-snug text-muted">
            Enter this code on the OpenAI page that just opened
            <span className="font-mono text-muted/70"> (auth.openai.com/codex/device)</span>, then approve access.
          </p>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-brass/40 bg-brass/[0.08] px-3 py-2.5">
            <span className="font-mono text-[19px] font-bold tracking-[0.18em] text-brasspale select-all">
              {device.session.userCode}
            </span>
            <button
              type="button"
              onClick={device.onCopy}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-hairline bg-ink/[0.03] px-2.5 py-1.5 font-mono text-[10.5px] text-muted hover:text-ink transition-colors"
            >
              {device.copied ? <Check size={12} className="text-sage" /> : <Copy size={12} />}
              {device.copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
              {device.waiting ? (
                <>
                  <SpinnerGap size={13} className="animate-spin text-brass" />
                  Waiting for your approval…
                </>
              ) : (
                "Starting…"
              )}
            </span>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={device.onFallback}
                className="font-mono text-[10px] text-muted/60 hover:text-ink transition-colors underline underline-offset-2"
              >
                Paste a redirect URL instead
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="shrink-0 rounded-xl border border-hairline px-3 py-1.5 font-mono text-[10.5px] text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!connected && stage === "paste" && (
        <div className="mt-3 space-y-2">
          <p className="text-[11.5px] leading-snug text-muted">
            Approve access in the sign-in window, copy what it gives you, and paste it here.
          </p>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={pasteHint}
            rows={2}
            spellCheck={false}
            className={inputCls + " w-full font-mono text-[11.5px] resize-none"}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFinish}
              disabled={!code.trim() || busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brass px-3.5 py-2 font-mono text-[11px] font-semibold text-night hover:bg-brasspale active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <PaperPlaneRight size={12} />
              {busy ? "Connecting…" : "Connect"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-hairline px-3 py-2 font-mono text-[11px] text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {connected && (
        <div className="mt-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.note}
                onClick={() => {
                  onModel(m.id);
                  onUse();
                }}
                className={`rounded-lg border px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
                  isActive && activeModel === m.id
                    ? "border-brass/60 bg-brass/20 text-brasspale font-semibold"
                    : "border-hairline bg-ink/[0.02] text-muted hover:border-brass/40 hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-hairline/60 pt-2">
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted/70">
              Session auto-refreshes
              <CaretDown size={9} className="opacity-0" aria-hidden />
            </span>
            {!isActive && (
              <button
                type="button"
                onClick={onUse}
                className="font-mono text-[10.5px] text-moon hover:underline"
              >
                Use this account →
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onDisconnect}
            className="font-mono text-[10px] text-muted/60 hover:text-rust transition-colors underline underline-offset-2"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
