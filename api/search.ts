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

/** Paid search must never run without a working budget counter. */
async function withinSearchBudget(req: Request): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.FIRECRAWL_API_KEY) throw new Error("search budget unavailable");
    return true;
  }
  const ip =
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  const bucket = Math.floor(Date.now() / 3_600_000);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}:${bucket}`));
  const key = `searchbudget:${[...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  try {
    const res = await fetch(`${url}/incr/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    const { result, error } = (await res.json()) as { result?: number; error?: unknown };
    if (!res.ok || error || typeof result !== "number" || !Number.isSafeInteger(result) || result < 1) {
      throw new Error("search budget unreadable");
    }
    if (result === 1) {
      await fetch(`${url}/expire/${key}/3600`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    }
    return result <= 60;
  } catch {
    throw new Error("search budget unavailable");
  }
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
    if (!(await withinSearchBudget(req))) return error(429, "Too many searches from this network. Try again later.");
  } catch {
    return error(503, "Search usage tracking is unavailable. Try again later.");
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
    return error(500, "Failed to fetch search results");
  }
}
