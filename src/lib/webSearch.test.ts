import { describe, it, expect, vi } from "vitest";
import { buildSearchQuery, hostedSearchOrigin, searchWeb } from "./webSearch";

describe("buildSearchQuery", () => {
  it("strips conversational filler and keeps content words", () => {
    expect(buildSearchQuery("Can you explain how module bundling works in Vite?")).toBe(
      "module bundling works vite",
    );
  });

  it("leaves terse queries unchanged", () => {
    expect(buildSearchQuery("krebs cycle")).toBe("krebs cycle");
  });

  it("falls back to the raw question when only stopwords remain", () => {
    expect(buildSearchQuery("Why?")).toBe("Why?");
  });
});

describe("hostedSearchOrigin", () => {
  it("returns a production https origin", () => {
    expect(hostedSearchOrigin()).toMatch(/^https:\/\/(comtus-ai\.vercel\.app|www\.comtus-ai\.xyz)$/);
  });
});

describe("searchWeb", () => {
  it("returns empty array for blank query", async () => {
    const results = await searchWeb("   ");
    expect(results).toEqual([]);
  });

  it("sends the condensed query to the relay", async () => {
    const originalFetch = global.fetch;
    let requestedUrl = "";
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/search")) {
        requestedUrl = String(url);
        return { ok: true, json: async () => ({ results: [] }) };
      }
      return { ok: false };
    });

    try {
      await searchWeb("Can you explain how module bundling works in Vite?");
      expect(requestedUrl).toContain("q=module%20bundling%20works%20vite");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("fetches results from Wikipedia fallback when API relay is mocked", async () => {
    // Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/search")) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                title: "Krebs Cycle",
                url: "https://en.wikipedia.org/wiki/Citric_acid_cycle",
                snippet: "The citric acid cycle is a series of chemical reactions used by all aerobic organisms.",
              },
            ],
          }),
        };
      }
      return { ok: false };
    });

    try {
      const results = await searchWeb("Krebs Cycle");
      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Krebs Cycle");
      expect(results[0].snippet).toContain("citric acid cycle");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("falls back to direct Wikipedia CORS search if relay errors", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/search")) {
        throw new Error("Network error");
      }
      if (url.includes("wikipedia.org")) {
        return {
          ok: true,
          json: async () => ({
            query: {
              search: [
                {
                  title: "Mitochondria",
                  snippet: "The <span>mitochondrion</span> is a double-membrane-bound organelle.",
                },
              ],
            },
          }),
        };
      }
      return { ok: false };
    });

    try {
      const results = await searchWeb("Mitochondria");
      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Mitochondria");
      expect(results[0].snippet).toContain("mitochondrion is a double-membrane");
      expect(results[0].url).toBe("https://en.wikipedia.org/wiki/Mitochondria");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("rethrows abort instead of falling through to Wikipedia", async () => {
    const originalFetch = global.fetch;
    const err = new Error("Aborted");
    err.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValue(err);

    try {
      await expect(searchWeb("Krebs Cycle")).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
