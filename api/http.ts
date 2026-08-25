/** Shared HTTP plumbing for the /api edge functions. */

/* Origins allowed to call Comtus APIs: the web app, the Tauri desktop
   shells, and local dev servers. */
export const ALLOWED_ORIGINS = new Set([
  "https://comtus-ai.vercel.app",
  "https://www.comtus-ai.xyz",
  "http://tauri.localhost",
  "tauri://localhost",
  "http://localhost:5173",
  "http://localhost:5199",
  "http://127.0.0.1:5199",
  "http://localhost:4173",
]);

export function corsHeaders(origin?: string | null): HeadersInit {
  return origin && ALLOWED_ORIGINS.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type,x-api-key,anthropic-version",
        "access-control-allow-methods": "POST,OPTIONS",
      }
    : {};
}

export function json(status: number, body: Record<string, unknown>, origin?: string | null): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

/** Best-effort per-IP hourly throttle backed by Upstash (no-op if unconfigured). */
export async function withinIpThrottle(
  req: Request,
  secret: string,
  limitPerHour: number,
): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !secret) return true;
  const ip =
    req.headers.get("x-real-ip") ??
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ??
    "unknown";
  const bucket = Math.floor(Date.now() / 3600_000);
  const key = `ipthrottle:${await hmacHex(`${ip}:${bucket}`, secret)}`;
  try {
    const res = await fetch(`${url}/incr/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    const { result } = (await res.json()) as { result?: number };
    if (typeof result !== "number") return true;
    if (result === 1) {
      await fetch(`${url}/expire/${key}/3600`, { headers: { Authorization: `Bearer ${token}` } });
    }
    return result <= limitPerHour;
  } catch {
    return true; // throttle backend unavailable — don't lock everyone out of checkout
  }
}

async function hmacHex(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return hex.slice(0, 24);
}
