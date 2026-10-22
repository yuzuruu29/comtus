/**
 * Device-to-device relay for notebooks — single file, no cross-module
 * imports.
 *
 * The sending device encrypts a notebook before it leaves (AES-GCM, key
 * derived from a code only the two devices see) and uploads the sealed
 * text in parts. This relay stores those parts in Upstash for an hour,
 * hands them to whoever presents the transfer id, and forgets them when
 * the receiver is done. It never sees a key and cannot read what it holds.
 *
 * Routes (all /api/relay):
 *   POST   ?id=&parts=&size=   reserve a transfer
 *   PUT    ?id=&part=          upload one sealed part (text body)
 *   GET    ?id=                transfer status
 *   GET    ?id=&part=          download one part
 *   DELETE ?id=                forget a transfer
 */

export const config = { runtime: "edge" };

const ALLOWED_ORIGINS = new Set([
  "https://comtus-ai.vercel.app",
  "https://www.comtus-ai.xyz",
  "http://tauri.localhost",
  "tauri://localhost",
  "http://localhost:5173",
  "http://localhost:5199",
  "http://127.0.0.1:5199",
  "http://localhost:4173",
]);

/** Transfers last an hour: long enough to walk to the other device. */
export const TTL_S = 3600;
/** Base64url characters per part — 512 KB of sealed bytes, under every
 *  request-size limit between here and Upstash. */
export const PART_CHARS = 700_000;
export const MAX_PARTS = 32;
const CREATES_PER_HOUR = 20;
const READS_PER_HOUR = 600;
/** Twenty notebooks, each at the part cap. Uploads were otherwise unlimited. */
const UPLOADS_PER_HOUR = CREATES_PER_HOUR * MAX_PARTS;

/** Crockford base32, the first 8 characters of a transfer code. */
const ID = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

interface Meta {
  parts: number;
  size: number;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return origin && ALLOWED_ORIGINS.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
        vary: "origin",
      }
    : {};
}

function reply(status: number, body: unknown, origin: string | null, type = "application/json"): Response {
  return new Response(status === 204 ? null : type === "application/json" ? JSON.stringify(body) : String(body), {
    status,
    headers: { "content-type": type, "cache-control": "no-store", ...corsHeaders(origin) },
  });
}

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? `redis ${res.status}`);
  return body.result;
}

/** Per-IP hourly budget; the IP is hashed before it is used as a key. */
async function withinBudget(req: Request, kind: string, limit: number): Promise<boolean> {
  const ip =
    req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const bucket = Math.floor(Date.now() / 3_600_000);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`relay:${kind}:${ip}:${bucket}`));
  const key = `relaybudget:${[...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  const count = Number(await redis(["INCR", key]));
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("relay budget unreadable");
  if (count === 1) await redis(["EXPIRE", key, 3600]);
  return count <= limit;
}

const metaKey = (id: string) => `relay:${id}:meta`;
const doneKey = (id: string) => `relay:${id}:done`;
const partKey = (id: string, part: number) => `relay:${id}:${part}`;

async function readMeta(id: string): Promise<Meta | null> {
  const raw = await redis(["GET", metaKey(id)]);
  return typeof raw === "string" ? (JSON.parse(raw) as Meta) : null;
}

const intParam = (value: string | null) => (value !== null && /^\d{1,9}$/.test(value) ? Number(value) : NaN);

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return reply(204, null, origin);
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return reply(503, { error: "Sending between devices isn't set up on this server." }, origin);
  }

  const params = new URL(req.url).searchParams;
  const id = params.get("id") ?? "";
  if (!ID.test(id)) return reply(400, { error: "That transfer id isn't valid." }, origin);

  try {
    switch (req.method) {
      case "POST": {
        const parts = intParam(params.get("parts"));
        const size = intParam(params.get("size"));
        if (!(parts >= 1 && parts <= MAX_PARTS) || !(size >= 1 && size <= parts * PART_CHARS)) {
          return reply(413, { error: "That notebook is too large to send this way." }, origin);
        }
        if (!(await withinBudget(req, "create", CREATES_PER_HOUR))) {
          return reply(429, { error: "Too many transfers from this network. Try again within the hour." }, origin);
        }
        const meta: Meta = { parts, size };
        const created = await redis(["SET", metaKey(id), JSON.stringify(meta), "EX", TTL_S, "NX"]);
        if (created !== "OK") return reply(409, { error: "That transfer id is taken." }, origin);
        return reply(201, { expiresAt: Date.now() + TTL_S * 1000 }, origin);
      }

      case "PUT": {
        const part = intParam(params.get("part"));
        const meta = await readMeta(id);
        if (!meta) return reply(404, { error: "This transfer has expired." }, origin);
        if (!(part >= 0 && part < meta.parts)) return reply(400, { error: "No such part." }, origin);
        if (Number(req.headers.get("content-length") ?? 0) > PART_CHARS) {
          return reply(413, { error: "That part is too large." }, origin);
        }
        if (!(await withinBudget(req, "upload", UPLOADS_PER_HOUR))) {
          return reply(429, { error: "Too many uploads from this network. Try again within the hour." }, origin);
        }
        const text = await req.text();
        if (text.length > PART_CHARS) return reply(413, { error: "That part is too large." }, origin);
        if (!BASE64URL.test(text)) return reply(400, { error: "Parts are sealed text." }, origin);
        const stored = await redis(["SET", partKey(id, part), text, "EX", TTL_S, "NX"]);
        if (stored !== "OK") return reply(409, { error: "That part was already sent." }, origin);
        const done = Number(await redis(["INCR", doneKey(id)]));
        if (done === 1) await redis(["EXPIRE", doneKey(id), TTL_S]);
        return reply(200, { received: done, parts: meta.parts }, origin);
      }

      case "GET": {
        if (!(await withinBudget(req, "read", READS_PER_HOUR))) {
          return reply(429, { error: "Too many requests from this network. Try again within the hour." }, origin);
        }
        const meta = await readMeta(id);
        if (!meta) return reply(404, { error: "This code has expired or was already used." }, origin);
        const partParam = params.get("part");
        if (partParam === null) {
          const done = Number((await redis(["GET", doneKey(id)])) ?? 0);
          return reply(200, { parts: meta.parts, size: meta.size, ready: done >= meta.parts }, origin);
        }
        const part = intParam(partParam);
        if (!(part >= 0 && part < meta.parts)) return reply(400, { error: "No such part." }, origin);
        const text = await redis(["GET", partKey(id, part)]);
        if (typeof text !== "string") return reply(404, { error: "That part hasn't arrived yet." }, origin);
        return reply(200, text, origin, "text/plain; charset=utf-8");
      }

      case "DELETE": {
        const meta = await readMeta(id);
        const parts = Array.from({ length: meta?.parts ?? 0 }, (_, i) => partKey(id, i));
        await redis(["DEL", metaKey(id), doneKey(id), ...parts]);
        return reply(204, null, origin);
      }

      default:
        return reply(405, { error: "Method not allowed" }, origin);
    }
  } catch (err) {
    console.error("Relay error:", err);
    return reply(502, { error: "The relay couldn't be reached. Try again." }, origin);
  }
}
