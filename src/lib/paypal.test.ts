import { describe, expect, it } from "vitest";
import { decodePassInfo, passSummary, planTierForPass } from "./paypal";

function v2Token(budgetNano: number, expiresInDays: number): string {
  const payload = { v: 2, c: budgetNano, e: Math.floor(Date.now() / 1000) + expiresInDays * 86_400 };
  return `comtus-pass-v1.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.sig`;
}

describe("decodePassInfo", () => {
  it("reads a non-expiring credit pass", () => {
    const payload = btoa(JSON.stringify({ v: 3, c: 2_500_000_000 }));
    const info = decodePassInfo(`comtus-pass-v1.${payload}.sig`);
    expect(info).toEqual({ kind: "credits", budgetNano: 2_500_000_000, expiresAtMs: null });
    expect(info && passSummary(info)).toContain("no expiry");
  });
  it("reads the credit budget from a version-2 pass", () => {
    const info = decodePassInfo(v2Token(3_495_000_000, 120));
    expect(info).toEqual({ kind: "credits", budgetNano: 3_495_000_000, expiresAtMs: expect.any(Number) });
  });

  it("reads the request count from a legacy pass", () => {
    const payload = { q: 40, e: Math.floor(Date.now() / 1000) + 86_400 };
    const token = `comtus-pass-v1.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.sig`;
    expect(decodePassInfo(token)).toEqual({ kind: "requests", requests: 40, expiresAtMs: expect.any(Number) });
  });

  it("rejects anything that is not a pass", () => {
    expect(decodePassInfo("sk-ant-api03-k123")).toBeNull();
    expect(decodePassInfo("comtus-pass-v1.notbase64!.sig")).toBeNull();
  });
});

describe("passSummary", () => {
  it.each([[2_500_000_000, "sprint"], [10_000_000_000, "scholar"], [30_000_000_000, "mastery"], [3_495_000_000, "scholar"], [7_495_000_000, "mastery"]] as const)(
    "recognizes current and historical pass budgets",
    (budgetNano, tier) => expect(planTierForPass({ kind: "credits", budgetNano, expiresAtMs: 0 })).toBe(tier),
  );
  it("shows remaining days for credit passes without a dollar figure", () => {
    const info = decodePassInfo(v2Token(3_495_000_000, 120));
    expect(info && passSummary(info)).toBe("Active pass · 120d remaining");
  });

  it("keeps request wording for legacy passes", () => {
    expect(passSummary({ kind: "requests", requests: 40, expiresAtMs: Date.now() + 86_400_000 })).toBe(
      "40 hosted requests",
    );
  });
});
