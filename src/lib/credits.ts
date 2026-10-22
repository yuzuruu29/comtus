/** Nano-USD (1e-9 USD) per token. Anthropic list prices as of 2026-10-13.
 *  The same table is copied in api/anthropic.ts. credits.test.ts fails if they diverge. */
export const CREDIT_MARKUP = 2;

export const MODEL_RATES = {
  "claude-opus-5": { input: 5000, cacheWrite5m: 6250, cacheWrite1h: 10000, cacheRead: 500, output: 25000 },
  "claude-sonnet-5": { input: 2000, cacheWrite5m: 2500, cacheWrite1h: 4000, cacheRead: 200, output: 10000 },
} as const;

export type HostedModelId = keyof typeof MODEL_RATES;

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
}

function whole(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Included Anthropic budget for a sticker price, in nano-USD. */
export function budgetNanoForPrice(priceUsd: string): number {
  const cents = Math.round(Number(priceUsd) * 100);
  if (!Number.isFinite(cents) || cents <= 0) throw new Error("bad price");
  return Math.floor((cents * 1_000_000_000) / (100 * CREDIT_MARKUP));
}

export function formatUsdFromNano(nano: number): string {
  const cents = Math.round(nano / 10_000_000);
  return `$${(cents / 100).toFixed(2)}`;
}

/** List-price cost of a reply. Throws on an unknown model. */
export function costNano(usage: TokenUsage, model: string): number {
  const rate = MODEL_RATES[model as HostedModelId];
  if (!rate) throw new Error(`No hosted rate for ${model}`);
  const hour = whole(usage.cache_creation?.ephemeral_1h_input_tokens);
  const fiveSplit = whole(usage.cache_creation?.ephemeral_5m_input_tokens);
  const creation = whole(usage.cache_creation_input_tokens);
  const five = fiveSplit > 0 || hour > 0 ? fiveSplit : Math.max(0, creation - hour);
  return (
    whole(usage.input_tokens) * rate.input +
    five * rate.cacheWrite5m +
    hour * rate.cacheWrite1h +
    whole(usage.cache_read_input_tokens) * rate.cacheRead +
    whole(usage.output_tokens) * rate.output
  );
}

/** Worst case before the reply: no cache discount, output at the cap. */
export function reserveNano(inputChars: number, maxTokens: number, model: string): number {
  const tokens = Math.ceil(Math.max(0, inputChars) / 4);
  return costNano(
    { input_tokens: tokens, output_tokens: Math.max(0, Math.floor(maxTokens)) },
    model,
  );
}
