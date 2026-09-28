/**
 * Shared web-search core used by BOTH the production relay
 * (api/search.ts on Vercel) and the dev mirror (vite.config.ts).
 *
 * Provider chain, best real-web-results first:
 *   0. Firecrawl     — keyed search API (FIRECRAWL_API_KEY env); primary when set.
 *   1. DuckDuckGo    — html endpoint then "lite" layout, via POST form submits
 *                      (one retry each; DDG soft-walls a fraction of requests).
 *   2. Wikipedia     — encyclopedic anchors so grounding never comes back empty.
 *
 * (A Bing RSS fallback was tried and removed: its keyless endpoint repeatedly
 * served unrelated trending/adult junk regardless of the query.)
 *
 * Underscore prefix keeps this file out of Vercel's /api routing.
 */

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/* ── Text helpers ─────────────────────────────────────────── */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (raw, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : raw;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? raw;
  });
}

export function stripTags(html: string): string {
  // Feeds often entity-encode embedded markup (&lt;b&gt;), so strip both
  // before and after decoding or the tags resurface as literal text.
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "").toLowerCase()}`;
  } catch {
    return url.toLowerCase();
  }
}

async function fetchText(url: string, init?: RequestInit, ms = 7000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(ms),
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9", ...init?.headers },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Bot-wall pages still answer 200 — sniff for them before parsing. */
function looksBlocked(body: string): boolean {
  return /anomaly|unusual traffic|captcha|challenge-platform|verify you are/i.test(body);
}

/* ── Provider 0: Firecrawl (keyed search API) ─────────────── */

interface FirecrawlResult {
  url?: string;
  title?: string;
  description?: string;
}

export async function firecrawlSearch(query: string, apiKey: string, limit = 8): Promise<SearchHit[]> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: FirecrawlResult[] };
    const items = Array.isArray(body.data) ? body.data : [];
    return items
      .filter((it) => it.url && /^https?:\/\//i.test(it.url))
      .map((it) => ({
        title: stripTags(it.title ?? it.url!),
        url: it.url!,
        snippet: stripTags(it.description ?? ""),
      }))
      .filter((h) => h.title);
  } catch {
    return [];
  }
}

/* ── Provider 1: DuckDuckGo (html + lite layouts) ─────────── */

export function parseDdgHtml(html: string): SearchHit[] {
  // Real markup scatters classes ("links_main links_deep result__body") and
  // attributes (<a rel="nofollow" class="result__a" href=...>), so match
  // loosely by class substring and pull href out of the attribute blob.
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter((m) =>
    /class="[^"]*\bresult__a\b/.test(m[1]),
  );
  const snippets = [...html.matchAll(/<a\b[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map(
    (m) => stripTags(m[1]),
  );
  return anchors
    .map((m, i) => ({
      title: stripTags(m[2]),
      url: unwrapUddg(decodeEntities((m[1].match(/href="([^"]+)"/)?.[1] ?? "").trim())),
      snippet: snippets[i] ?? "",
    }))
    .filter((h) => h.title && h.url.startsWith("http"));
}

function unwrapUddg(href: string): string {
  const match = href.match(/[?&]uddg=([^&]+)/);
  if (!match) return href;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return href;
  }
}

export function parseDdgLite(html: string): SearchHit[] {
  const links: { title: string; url: string }[] = [];
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
  let anchor;
  while ((anchor = anchorRegex.exec(html)) !== null) {
    const attrs = anchor[1];
    if (!/class=["']?result-link/i.test(attrs)) continue;
    const href = attrs.match(/href=["']?([^"'\s>]+)/i)?.[1] ?? "";
    links.push({ title: stripTags(anchor[2]), url: unwrapUddg(decodeEntities(href).trim()) });
  }
  const snippets = [...html.matchAll(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
    stripTags(m[1]),
  );
  return links.map((l, i) => ({ ...l, snippet: snippets[i] ?? "" })).filter(
    (h) => h.title && h.url.startsWith("http"),
  );
}

/* ── Provider 2: Wikipedia anchors ────────────────────────── */

export async function wikipediaSearch(query: string, limit = 4): Promise<SearchHit[]> {
  const body = await fetchText(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${limit}&utf8=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!body) return [];
  try {
    const items = JSON.parse(body)?.query?.search ?? [];
    return items.map((it: { title: string; snippet: string }) => ({
      title: it.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(it.title.replace(/ /g, "_"))}`,
      snippet: stripTags(it.snippet),
    }));
  } catch {
    return [];
  }
}

/* ── Orchestration ────────────────────────────────────────── */

/**
 * Comtus is a study app — keyless engines can serve adult junk, so drop
 * obviously-adult hits before they ground a chat.
 */
const ADULT_URL_PATTERN =
  /(porn|xhamster|xvideos|xnxx|redtube|youporn|pornhub|stripchat|chaturbate|onlyfans|nsfw|hookup|escort|fleshlight)/i;

function isFamilySafe(hit: SearchHit): boolean {
  return !ADULT_URL_PATTERN.test(hit.url) && !ADULT_URL_PATTERN.test(hit.title);
}

export async function runSearch(query: string): Promise<{ results: SearchHit[]; provider: string }> {
  const merged: SearchHit[] = [];
  const seen = new Set<string>();
  let provider = "";

  const push = (hits: SearchHit[], source: string, cap = 8) => {
    for (const hit of hits) {
      const key = normalizeUrlKey(hit.url);
      if (seen.has(key) || !isFamilySafe(hit)) continue;
      seen.add(key);
      merged.push(hit);
      provider ||= source;
      if (merged.length >= cap) break;
    }
  };

  // DuckDuckGo soft-walls a fraction of requests with a 202/interstitial,
  // so give each endpoint one quick retry before moving on.
  const ddgPost = async (endpoint: string): Promise<string | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
      const body = await fetchText(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "text/html",
            Referer: endpoint,
          },
          body: new URLSearchParams({ q: query }).toString(),
        },
        attempt === 0 ? 7000 : 9000,
      );
      if (body && !looksBlocked(body)) return body;
    }
    return null;
  };

  // Wikipedia is the last resort; once the chain looks thin, start it early
  // so it lands while DuckDuckGo retries instead of after. It never rejects.
  let wiki: Promise<SearchHit[]> | null = null;
  const wikipedia = () => (wiki ??= wikipediaSearch(query));

  // 0. Firecrawl — keyed search API; cleanest results when a key is set.
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) push(await firecrawlSearch(query, firecrawlKey), "firecrawl");

  // 1. DuckDuckGo — best result quality of the keyless providers.
  //    Both endpoints demand POST form submits (plain GETs get anomaly-walled).
  if (merged.length < 5) {
    const ddgHtml = await ddgPost("https://html.duckduckgo.com/html/");
    if (ddgHtml) push(parseDdgHtml(ddgHtml), "duckduckgo");

    if (merged.length < 4) {
      void wikipedia();
      const liteHtml = await ddgPost("https://lite.duckduckgo.com/lite/");
      if (liteHtml) push(parseDdgLite(liteHtml), "duckduckgo-lite");
    }
  }

  // 2. Wikipedia — encyclopedic anchor results. Vague one-word queries often
  //    draw sparse web hits, so keep these unless the web providers delivered.
  if (merged.length < 5) push(await wikipedia(), "wikipedia");

  return { results: merged.slice(0, 8), provider: provider || "none" };
}
