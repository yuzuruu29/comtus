import { useShallow } from "zustand/react/shallow";
import { useSettings } from "../lib/settings";
import { usageLimitRows } from "../lib/codexUsage";

export function UsageLimitsPanel() {
  const snapshot = useSettings(
    useShallow((s) => ({
      provider: s.provider,
      codexUsage: s.codexUsage,
      isPro: Boolean(s.isPro && s.planTier !== "free"),
      tokenBalance: s.tokenBalance || 0,
      tokensUsed: s.tokensUsed || 0,
    })),
  );
  const rows = usageLimitRows(snapshot);
  if (rows.length === 0) return null;

  return (
    <section className="usage-limits-panel" aria-label="Usage limits">
      <div className="usage-limits-kicker">Usage limits</div>
      {rows.map((row) => (
        <div key={row.id} className="usage-limit-row" data-tone={row.tone}>
          <div className="usage-limit-head">
            <span>{row.label}</span>
            <span className="usage-pct">{row.usedPercent}%</span>
          </div>
          <div
            role="meter"
            aria-label={row.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={row.usedPercent}
            aria-valuetext={`${row.usedPercent}% used, ${row.caption}`}
            className="usage-limit-track"
          >
            <span className="usage-fill" style={{ width: `${row.usedPercent}%` }} />
          </div>
          <div className="usage-caption">{row.caption}</div>
        </div>
      ))}
    </section>
  );
}
