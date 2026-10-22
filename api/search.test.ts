import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_search-core", () => ({
  runSearch: vi.fn(async (q: string) => ({ results: [{ title: q, url: "https://example.org", snippet: "" }], provider: "test" })),
}));

import handler from "./search";
import { runSearch } from "./_search-core";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("search relay", () => {
  it("serves cached results for a query", async () => {
    const res = await handler(new Request("http://localhost/api/search?q=%20krebs%20%20cycle%20"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage");
    expect(runSearch).toHaveBeenCalledWith("krebs cycle");
  });

  it("rejects empty, oversized, and non-GET requests before searching", async () => {
    expect((await handler(new Request("http://localhost/api/search?q=%20"))).status).toBe(400);
    expect((await handler(new Request(`http://localhost/api/search?q=${"a".repeat(401)}`))).status).toBe(414);
    expect((await handler(new Request("http://localhost/api/search?q=x", { method: "POST" }))).status).toBe(405);
    expect(runSearch).not.toHaveBeenCalled();
  });

  it("returns 429 after 60 searches from one network", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: 61 }), { status: 200 })));
    const res = await handler(new Request("http://localhost/api/search?q=krebs", { headers: { "x-real-ip": "203.0.113.8" } }));
    expect(res.status).toBe(429);
    expect(runSearch).not.toHaveBeenCalled();
  });
});
