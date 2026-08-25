export const config = { runtime: "edge" };

import { runSearch } from "./_search-core";

export default async function handler(req: Request): Promise<Response> {
  const incoming = new URL(req.url);
  const query = (incoming.searchParams.get("q") ?? "").trim();
  if (!query) {
    return new Response(JSON.stringify({ error: "Missing search query parameter 'q'", results: [] }), {
      status: 400,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    });
  }

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
    return new Response(JSON.stringify({ error: "Failed to fetch search results", results: [] }), {
      status: 500,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    });
  }
}
