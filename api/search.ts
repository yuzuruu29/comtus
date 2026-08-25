import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runSearch } from "./_search-core";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = String(req.query.q ?? "").trim();
  if (!query) {
    return res.status(400).json({ error: "Missing search query parameter 'q'", results: [] });
  }

  // The desktop app has no same-origin /api, so let it hit this relay directly.
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const { results, provider } = await runSearch(query);
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1800");
    return res.status(200).json({ results, provider });
  } catch (err) {
    console.error("Search relay error:", err);
    return res.status(500).json({ error: "Failed to fetch search results", results: [] });
  }
}
