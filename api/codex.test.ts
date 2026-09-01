import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codexSubPath } from "./codex";

describe("codexSubPath", () => {
  it("reads the current rewrite query `path`", () => {
    expect(codexSubPath(new URL("https://comtus.local/api/codex?path=models"))).toBe("/models");
    expect(codexSubPath(new URL("https://comtus.local/api/codex?path=responses"))).toBe("/responses");
  });

  it("still accepts the old rewrite query `p`", () => {
    expect(codexSubPath(new URL("https://comtus.local/api/codex?p=models"))).toBe("/models");
  });

  it("maps a direct /api/codex/... hit onto the subpath", () => {
    expect(codexSubPath(new URL("https://comtus.local/api/codex/models"))).toBe("/models");
  });

  it("maps a bare /api/codex hit onto /", () => {
    expect(codexSubPath(new URL("https://comtus.local/api/codex"))).toBe("/");
  });
});

describe("vercel Codex rewrite", () => {
  it("passes the subpath as path, matching api/codex.ts", () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      rewrites: { source: string; destination: string }[];
    };
    const dest = raw.rewrites.find((row) => row.source === "/api/codex/:path*")?.destination;
    expect(dest).toBe("/api/codex?path=:path*");
  });
});
