import { type ReactNode } from "react";
import { Crown, GearSix, Plus, Sparkle } from "@phosphor-icons/react";

/**
 * Rich BYOK (Bring Your Own Key) Status Badge Component.
 * Multi-layer jewel badge with glowing starlet and subtle hover illumination.
 */
export function ByokBadge({
  onClick,
  className = "",
}: {
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-1.5 rounded-full border border-hairline bg-surface/70 px-2.5 py-1 font-mono text-[10.5px] font-medium tracking-[0.08em] text-muted hover:border-brass/40 hover:bg-brass/[0.06] hover:text-brasspale transition-all shadow-sm ${className}`}
      title="BYOK Mode (Bring Your Own Key) — Click to configure API models & settings"
    >
      <span className="group-hover:text-brasspale transition-colors">BYOK</span>
      <Sparkle size={11} className="text-muted/60 group-hover:text-brass group-hover:scale-110 transition-all" />
    </button>
  );
}

/**
 * Rich Pro Tier Status Badge Component.
 * Features an illuminated crown emblem, polished brass gradient border,
 * glowing halo, and token balance pill.
 */
export function ProBadge({
  planTier = "PRO",
  remainingTokens,
  onClick,
  className = "",
}: {
  planTier?: string;
  remainingTokens?: number;
  onClick?: () => void;
  className?: string;
}) {
  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return n.toLocaleString();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border border-brass/45 bg-gradient-to-r from-brass/[0.16] to-brass/[0.08] px-3 py-1 font-mono text-[10.5px] font-medium text-brasspale hover:bg-brass/25 transition-all shadow-[0_0_14px_rgba(227,176,75,0.18)] ${className}`}
      title={`Pro Plan Active (${planTier.toUpperCase()}) ${remainingTokens !== undefined ? `· ${remainingTokens.toLocaleString()} hosted requests left` : ""}`}
    >
      <Crown size={12} weight="fill" className="text-brass animate-[pulse_3s_ease-in-out_infinite]" />
      <span className="font-semibold tracking-[0.04em]">{planTier.toUpperCase()}</span>
      {remainingTokens !== undefined && remainingTokens > 0 && (
        <span className="border-l border-brass/35 pl-1.5 text-[9.5px] text-brasspale/85 font-normal">
          {formatTokens(remainingTokens)} req
        </span>
      )}
    </button>
  );
}

/**
 * Rich Settings Trigger Button Component.
 */
export function SettingsButton({
  onClick,
  children,
  className = "",
}: {
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[34px] items-center gap-1.5 rounded-[var(--radius-control)] border border-hairline bg-surface/60 px-3.5 py-1.5 text-[12.5px] font-medium text-muted hover:border-hairline-strong hover:bg-surface hover:text-ink transition-colors ${className}`}
      aria-label="Settings"
    >
      <GearSix size={14} weight="light" className="transition-transform duration-300 group-hover:rotate-45" />
      {children || "Settings"}
    </button>
  );
}

/**
 * Illuminated "Create New Notebook" Card Emblem.
 * Sits inside the dashed creation card with breathing radial glow.
 */
export function CreateNotebookEmblem({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-brass/20 to-brass/5 border border-brass/30 text-brass shadow-[0_0_18px_rgba(227,176,75,0.16)] transition-all duration-300 group-hover:scale-110 group-hover:border-brass/50 group-hover:bg-brass/25 group-hover:shadow-[0_0_24px_rgba(227,176,75,0.28)] ${className}`}
    >
      <Plus size={20} weight="bold" className="text-brass transition-transform duration-200 group-hover:rotate-90" />
    </div>
  );
}
