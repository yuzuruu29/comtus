import { useShallow } from "zustand/react/shallow";
import { useSettings } from "../lib/settings";
import { usageLimitRows, type UsageLimitRow } from "../lib/codexUsage";
import { useCountUp } from "./fx";

function UsageRow({ row }: { row: UsageLimitRow }) {
  // Count-up is display-only: aria-valuenow/valuetext and the fill width stay
  // bound to the raw percent so assistive tech never sees an animated value.
  const pct = useCountUp(row.usedPercent);
  return (
    <div className="usage-limit-row" data-tone={row.tone}>
      <div className="usage-limit-head">
        <span>{row.label}</span>
        <span className="usage-pct">{pct}%</span>
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
  );
}

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
        <UsageRow key={row.id} row={row} />
      ))}
    </section>
  );
}
