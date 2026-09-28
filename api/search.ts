export const config = { runtime: "edge" };

import { runSearch } from "./_search-core";

/** The client condenses questions to ≤200 chars; leave headroom, no more. */
const MAX_QUERY_CHARS = 400;

function error(status: number, message: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: message, results: [] }), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      ...extra,
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS" },
    });
  }
  if (req.method !== "GET") return error(405, "GET only", { allow: "GET, OPTIONS" });

  const incoming = new URL(req.url);
  const query = (incoming.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (!query) return error(400, "Missing search query parameter 'q'");
  if (query.length > MAX_QUERY_CHARS) return error(414, "Search query is too long");

  try {
    const { results, provider } = await runSearch(query);
    return new Response(JSON.stringify({ results, provider }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("Search relay error:", err);
    return error(500, "Failed to fetch search results");
  }
}
