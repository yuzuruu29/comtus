import { type ReactNode } from "react";
import { Crown, GearSix, Plus, Sparkle } from "@phosphor-icons/react";

/**
 * Rich BYOK (Bring Your Own Key) Status Badge Component.
 * Multi-layer jewel badge with glowing cyan starlet and subtle hover illumination.
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
      className={`group flex items-center gap-1.5 rounded-full border border-[rgba(4,74,179,0.18)] bg-white/90 px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.06em] text-[#044AB3] hover:border-[#044AB3] hover:bg-[#044AB3]/10 hover:text-[#044AB3] transition-all shadow-sm ${className}`}
      title="BYOK Mode (Bring Your Own Key) — Click to configure API models & settings"
    >
      <span>BYOK</span>
      <Sparkle size={12} weight="fill" className="text-[#6FE3FF] group-hover:scale-110 transition-all" />
    </button>
  );
}

/**
 * Rich Pro Tier Status Badge Component.
 * Features an illuminated crown emblem, Royal Sapphire gradient border,
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
      className={`flex items-center gap-1.5 rounded-full border border-[#044AB3]/40 bg-gradient-to-r from-[#044AB3]/15 to-[#6FE3FF]/15 px-3 py-1 font-mono text-[11px] font-semibold text-[#044AB3] hover:bg-[#044AB3]/20 transition-all shadow-[0_0_14px_rgba(111,227,255,0.2)] ${className}`}
      title={`Pro Plan Active (${planTier.toUpperCase()}) ${remainingTokens !== undefined ? `· ${remainingTokens.toLocaleString()} hosted requests left` : ""}`}
    >
      <Crown size={12} weight="fill" className="text-[#044AB3] animate-[pulse_3s_ease-in-out_infinite]" />
      <span className="font-bold tracking-[0.04em]">{planTier.toUpperCase()}</span>
      {remainingTokens !== undefined && remainingTokens > 0 && (
        <span className="border-l border-[#044AB3]/30 pl-1.5 text-[10px] text-[#044AB3]/90 font-normal">
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
      className={`flex min-h-[34px] items-center gap-1.5 rounded-[var(--radius-control)] border border-[rgba(4,74,179,0.15)] bg-white/80 px-3.5 py-1.5 text-[12.5px] font-medium text-[#334155] hover:border-[#044AB3]/50 hover:bg-white hover:text-[#0B132B] transition-colors shadow-sm ${className}`}
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
      className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-[#044AB3]/15 to-[#6FE3FF]/10 border border-[#044AB3]/25 text-[#044AB3] shadow-[0_0_18px_rgba(111,227,255,0.2)] transition-all duration-300 group-hover:scale-110 group-hover:border-[#044AB3] group-hover:bg-[#044AB3]/20 group-hover:shadow-[0_0_24px_rgba(111,227,255,0.35)] ${className}`}
    >
      <Plus size={20} weight="bold" className="text-[#044AB3] transition-transform duration-200 group-hover:rotate-90" />
    </div>
  );
}
