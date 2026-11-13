import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { budgetNanoForPrice, costNano, formatUsdFromNano, reserveNano } from "./credits";

describe("hosted credit cost", () => {
  it("prices cache writes, cache reads, and output separately", () => {
    expect(
      costNano(
        {
          input_tokens: 1000,
          output_tokens: 100,
          cache_creation_input_tokens: 4000,
          cache_read_input_tokens: 8000,
          cache_creation: { ephemeral_1h_input_tokens: 1000, ephemeral_5m_input_tokens: 3000 },
        },
        "claude-sonnet-5",
      ),
    ).toBe(1000 * 2000 + 3000 * 2500 + 1000 * 4000 + 8000 * 200 + 100 * 10000);
  });

  it("treats a combined cache-creation count as a 5-minute write", () => {
    expect(costNano({ cache_creation_input_tokens: 10 }, "claude-opus-5")).toBe(10 * 6250);
    expect(costNano({ cache_creation_input_tokens: 10 }, "claude-opus-5-5")).toBe(10 * 6250);
  });

  it("rejects a model with no rate", () => {
    expect(() => costNano({ input_tokens: 1 }, "claude-haiku-5")).toThrow(/No hosted rate/);
  });

  it("reserves input chars plus the full output cap", () => {
    expect(reserveNano(8, 2, "claude-sonnet-5")).toBe(2 * 2000 + 2 * 10000);
    expect(reserveNano(8, 2, "claude-sonnet-5-5")).toBe(2 * 2000 + 2 * 10000);
  });

  it("sells half the sticker price as included usage", () => {
    expect(budgetNanoForPrice("2.99")).toBe(1_495_000_000);
    expect(budgetNanoForPrice("6.99")).toBe(3_495_000_000);
    expect(budgetNanoForPrice("14.99")).toBe(7_495_000_000);
    expect(formatUsdFromNano(budgetNanoForPrice("6.99"))).toBe("$3.50");
  });

  it("matches the rate table copied into the edge proxy", () => {
    const edge = readFileSync("api/anthropic.ts", "utf8");
    const client = readFileSync("src/lib/credits.ts", "utf8");
    const table = (source: string) => {
      const start = source.indexOf("MODEL_RATES");
      const end = source.indexOf("} as const;", start);
      return source.slice(start, end).replace(/\r\n/g, "\n");
    };
    expect(table(edge)).toBe(table(client));
  });
});
