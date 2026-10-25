import { describe, expect, it } from "vitest";
import { decodePassInfo, passSummary } from "./paypal";

function v2Token(budgetNano: number, expiresInDays: number): string {
  const payload = { v: 2, c: budgetNano, e: Math.floor(Date.now() / 1000) + expiresInDays * 86_400 };
  return `comtus-pass-v1.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.sig`;
}

describe("decodePassInfo", () => {
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
  it("names the included budget and remaining days for credit passes", () => {
    const info = decodePassInfo(v2Token(3_495_000_000, 120));
    expect(info && passSummary(info)).toBe("Active pass · $3.50 hosted usage · 120d remaining");
  });

  it("keeps request wording for legacy passes", () => {
    expect(passSummary({ kind: "requests", requests: 40, expiresAtMs: Date.now() + 86_400_000 })).toBe(
      "40 hosted requests",
    );
  });
});
