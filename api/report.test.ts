import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The client error sink: secrets are redacted, oversized payloads dropped,
 * and a per-IP budget turns away floods. Budget failures fail open — an
 * unreachable counter must not swallow error reports.
 */

vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

const calls: { path: string; init: RequestInit | undefined }[] = [];
let nextRedisResult: number | "reject" = 1;
vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ path: String(url), init });
    if (nextRedisResult === "reject") throw new Error("redis down");
    return { ok: true, json: async () => ({ result: nextRedisResult }) } as Response;
  }),
);

const handler = (await import("./report")).default;

function request(body?: string, ip = "203.0.113.7"): Request {
  return new Request("https://site.test/api/report", {
    method: "POST",
    body,
    headers: { "x-real-ip": ip },
  });
}

describe("client error report sink", () => {
  afterEach(() => {
    calls.length = 0;
    nextRedisResult = 1;
  });

  it("logs a clean report", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await handler(request('{"message":"boom"}'));
      expect(res.status).toBe(204);
      expect(error).toHaveBeenCalledWith("client error:", '{"message":"boom"}');
    } finally {
      error.mockRestore();
    }
  });

  it("redacts payloads that look like secrets", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await handler(request('{"message":"sk-ant-api03-k…"}'));
      expect(error).toHaveBeenCalledWith("client error: redacted");
    } finally {
      error.mockRestore();
    }
  });

  it("drops oversized payloads without logging", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await handler(request("x".repeat(4 * 1024 + 1)));
      expect(res.status).toBe(413);
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("turns away a caller past the hourly budget", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    nextRedisResult = 31;
    try {
      const res = await handler(request('{"message":"flood"}'));
      expect(res.status).toBe(429);
      expect(calls[0]?.path).toContain("/incr/reportbudget:");
    } finally {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    }
  });

  it("fails open when the counter is unreachable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    nextRedisResult = "reject";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await handler(request('{"message":"still useful"}'));
      expect(res.status).toBe(204);
      expect(error).toHaveBeenCalledWith("client error:", '{"message":"still useful"}');
    } finally {
      error.mockRestore();
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    }
  });
});
