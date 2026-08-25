import { describe, it, expect, vi, afterEach } from "vitest";
import {
  decodeEntities,
  firecrawlSearch,
  parseDdgHtml,
  parseDdgLite,
  runSearch,
} from "./_search-core";

const DDG_HTML_BLOCK = `<div class="links_main links_deep result__body">
<h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fvitejs.dev%2Fguide%2F&amp;rut=abc">Vite <b>Guide</b></a></h2>
<a class="result__snippet" href="//duckduckgo.com/l/?uddg=x&amp;rut=y">Native-ESM powered web dev.</a>
</div>`;

const DDG_LITE = `<html><body><table>
<tr><td>1.</td><td><a rel="nofollow" href="https://example.com/a" class='result-link'>Example A</a></td></tr>
<tr><td class="result-snippet">Snippet <b>A</b> text.</td></tr>
</table></body></html>`;

const WIKI_JSON = JSON.stringify({
  query: { search: [{ title: "Module", snippet: "A <b>module</b> is a self-contained unit." }] },
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Tom &amp; Jerry &#39;x&#x27; &nbsp; &#x2713;")).toBe(
      "Tom & Jerry 'x'   ✓",
    );
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeEntities("&frobnicate;")).toBe("&frobnicate;");
  });
});

describe("parseDdgHtml", () => {
  it("matches real multi-class markup, strips uddg wrappers and tags", () => {
    const hits = parseDdgHtml(DDG_HTML_BLOCK);
    expect(hits).toHaveLength(1);
    expect(hits[0].url).toBe("https://vitejs.dev/guide/");
    expect(hits[0].title).toBe("Vite Guide");
    expect(hits[0].snippet).toBe("Native-ESM powered web dev.");
  });
});

describe("parseDdgLite", () => {
  it("pairs links with their snippet rows", () => {
    const hits = parseDdgLite(DDG_LITE);
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe("Example A");
    expect(hits[0].snippet).toBe("Snippet A text.");
  });
});

describe("runSearch provider chain", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("serves DuckDuckGo first and keeps its results at the front", async () => {
    global.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (String(input).includes("html.duckduckgo.com")) {
        return { ok: true, text: async () => DDG_HTML_BLOCK };
      }
      return { ok: false };
    });

    const { results, provider } = await runSearch("es modules");
    expect(provider).toBe("duckduckgo");
    expect(results[0].url).toBe("https://vitejs.dev/guide/");
  });

  it("retries the html endpoint when DDG soft-walls with an interstitial", async () => {
    let htmlAttempts = 0;
    global.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (String(input).includes("html.duckduckgo.com")) {
        htmlAttempts += 1;
        return {
          ok: true,
          text: async () =>
            htmlAttempts === 1 ? "<html>unusual traffic anomaly</html>" : DDG_HTML_BLOCK,
        };
      }
      return { ok: false };
    });

    const { provider } = await runSearch("es modules");
    expect(htmlAttempts).toBe(2);
    expect(provider).toBe("duckduckgo");
  });

  it("skips bot-walls and lands on Wikipedia rather than returning nothing", async () => {
    global.fetch = vi.fn().mockImplementation(async (input: string) => {
      const url = String(input);
      if (url.includes("duckduckgo.com")) {
        return { ok: true, text: async () => "<html>Sorry, unusual traffic anomaly detected</html>" };
      }
      if (url.includes("wikipedia.org")) {
        return { ok: true, text: async () => WIKI_JSON };
      }
      return { ok: false };
    });

    const { results, provider } = await runSearch("module pattern javascript");
    expect(provider).toBe("wikipedia");
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toContain("module is a self-contained unit");
  });

  it("drops adult hits from the merge instead of grounding chats with them", async () => {
    const dirtyBlock = `${DDG_HTML_BLOCK}<div class="links_main links_deep result__body">
<a rel="nofollow" class="result__a" href="https://www.xhamster.com/something">Dirty hit</a>
<a class="result__snippet">Adult junk.</a>
</div>`;
    global.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (String(input).includes("html.duckduckgo.com")) {
        return { ok: true, text: async () => dirtyBlock };
      }
      return { ok: false };
    });

    const { results } = await runSearch("es modules");
    expect(results.some((r) => /xhamster/.test(r.url))).toBe(false);
    expect(results[0].url).toBe("https://vitejs.dev/guide/");
  });
});
