/**
 * Lightweight web search helper for Comtus.
 * Retrieves real-time web + encyclopedic summaries to ground model answers
 * with rich, high-fidelity content rather than superficial search fragments.
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Hosted relay lives on the production site; the desktop app has no same-origin /api. */
const PROD_SEARCH_ORIGIN = "https://www.comtus-ai.xyz";

/* Words that turn a conversational question into a poor search query. */
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "done", "can", "could", "should", "would", "will", "shall",
  "may", "might", "must", "have", "has", "had",
  "i", "you", "he", "she", "it", "we", "they", "me", "my", "your", "our",
  "his", "her", "its", "their", "this", "that", "these", "those",
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
  "of", "for", "to", "in", "on", "at", "by", "with", "from", "about",
  "into", "over", "after", "before", "between", "under", "above",
  "and", "or", "but", "if", "then", "than", "so", "as", "not", "no", "yes",
  "please", "tell", "say", "explain", "describe", "give", "show", "list",
  "help", "need", "want", "know", "understand", "get", "make", "there", "here",
]);

/**
 * Chat questions ("Can you explain how module bundling works in vite?")
 * make terrible search queries. Strip the filler and keep the content words.
 */
export function buildSearchQuery(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'+#.-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
  const condensed = words.slice(0, 14).join(" ").slice(0, 200).trim();
  return condensed || question.trim().slice(0, 200);
}

function isAbortError(err: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

async function fetchRelay(origin: string, query: string, signal?: AbortSignal) {
  const res = await fetch(`${origin}/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: WebSearchResult[] };
  return Array.isArray(data.results) && data.results.length > 0 ? data.results : null;
}

export async function searchWeb(question: string, signal?: AbortSignal): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  const cleanQuery = buildSearchQuery(question);
  if (!cleanQuery) return results;

  // 1. Same-origin server relay (/api/search) — works on the deployed site.
  if (typeof window !== "undefined" && window.location?.protocol?.startsWith("http")) {
    try {
      const hits = await fetchRelay(window.location.origin, cleanQuery, signal);
      if (hits) return hits;
    } catch (err) {
      if (isAbortError(err)) throw err;
      // Fall through.
    }

    // 2. Hosted relay — desktop builds have no /api of their own.
    if (window.location.origin !== PROD_SEARCH_ORIGIN) {
      try {
        const hits = await fetchRelay(PROD_SEARCH_ORIGIN, cleanQuery, signal);
        if (hits) return hits;
      } catch (err) {
        if (isAbortError(err)) throw err;
        // Fall through.
      }
    }
  }

  // 3. Direct Wikipedia CORS search & full extracts (works from any origin).
  try {
    const listUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*&utf8=1`;
    const listRes = await fetch(listUrl, { signal });
    if (listRes.ok) {
      const listData = await listRes.json();
      const items = listData?.query?.search || [];
      const topTitles = items.slice(0, 3).map((it: { title: string }) => it.title);

      if (topTitles.length > 0) {
        // Fetch rich introductory extracts for all top matching articles
        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(topTitles.join("|"))}&format=json&origin=*`;
        const extractRes = await fetch(extractUrl, { signal });
        if (extractRes.ok) {
          const extractData = await extractRes.json();
          const pages = extractData?.query?.pages || {};
          for (const pageId in pages) {
            const page = pages[pageId];
            if (page && page.title && page.extract) {
              const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
              results.push({
                title: page.title,
                url,
                snippet: page.extract.slice(0, 1200), // Rich substantive paragraphs
              });
            }
          }
        }
      }

      // Fallback to basic search snippets if extracts were empty
      if (results.length === 0) {
        for (const item of items.slice(0, 3)) {
          results.push({
            title: item.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
            snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, "").trim(),
          });
        }
      }
    }
  } catch (err) {
    if (isAbortError(err)) throw err;
    console.warn("Direct Wikipedia search error:", err);
  }

  return results;
}
