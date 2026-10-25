export const config = { runtime: "edge" };

const MAX_BYTES = 4 * 1024;
const HOURLY_LIMIT = 30;

/** Client error sink. Logs to the function log and drops anything that looks like a secret.
 *  Rate-limited per IP so it cannot be used as a free log faucet; if Redis is
 *  down the report still logs — error visibility beats strictness here. */
async function withinReportBudget(req: Request): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;
  const ip =
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  const bucket = Math.floor(Date.now() / 3_600_000);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}:${bucket}`));
  const key = `reportbudget:${[...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  try {
    const res = await fetch(`${url}/incr/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    const { result, error } = (await res.json()) as { result?: number; error?: unknown };
    if (!res.ok || error || typeof result !== "number" || !Number.isSafeInteger(result) || result < 1) {
      return true;
    }
    if (result === 1) {
      await fetch(`${url}/expire/${key}/3600`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    }
    return result <= HOURLY_LIMIT;
  } catch {
    return true;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST,OPTIONS" },
    });
  }
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (!(await withinReportBudget(req))) return new Response(null, { status: 429 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 });
  if (/sk-|comtus-pass-|Bearer /i.test(text)) {
    console.error("client error: redacted");
  } else {
    console.error("client error:", text);
  }
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
}
