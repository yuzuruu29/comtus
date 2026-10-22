import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { MAX_PARTS, PART_CHARS, TTL_S } from "./relay";

const UPSTASH = "https://relay-upstash.example";

/** Just enough Redis for the relay: SET (EX, NX), GET, INCR, EXPIRE, DEL. */
function fakeRedis() {
  const store = new Map<string, string>();
  const ttl = new Map<string, number>();
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const [cmd, key, ...args] = JSON.parse(String(init.body)) as string[];
    let result: unknown = null;
    switch (cmd) {
      case "SET": {
        const [value, ...opts] = args;
        if (opts.includes("NX") && store.has(key)) break;
        store.set(key, value);
        const ex = opts.indexOf("EX");
        if (ex >= 0) ttl.set(key, Number(opts[ex + 1]));
        result = "OK";
        break;
      }
      case "GET":
        result = store.get(key) ?? null;
        break;
      case "INCR":
        result = Number(store.get(key) ?? 0) + 1;
        store.set(key, String(result));
        break;
      case "EXPIRE":
        ttl.set(key, Number(args[0]));
        result = 1;
        break;
      case "DEL":
        result = [key, ...args].filter((k) => store.delete(k)).length;
        break;
    }
    return new Response(JSON.stringify({ result }), { status: 200 });
  });
  return { store, ttl, fetchMock };
}

let redis: ReturnType<typeof fakeRedis>;

beforeEach(() => {
  redis = fakeRedis();
  vi.stubGlobal("fetch", redis.fetchMock);
  process.env.UPSTASH_REDIS_REST_URL = UPSTASH;
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

const call = (
  method: string,
  query: string,
  body?: string,
  origin = "https://comtus-ai.vercel.app",
  headers: Record<string, string> = {},
) =>
  handler(new Request(`https://comtus-ai.vercel.app/api/relay?${query}`, { method, body, headers: { origin, ...headers } }));

describe("relay", () => {
  it("carries sealed parts from one device to another, then forgets them", async () => {
    const created = await call("POST", "id=7K3FQX9P&parts=2&size=10");
    expect(created.status).toBe(201);
    expect(created.headers.get("access-control-allow-origin")).toBe("https://comtus-ai.vercel.app");
    expect(redis.ttl.get("relay:7K3FQX9P:meta")).toBe(TTL_S);

    expect(await (await call("GET", "id=7K3FQX9P")).json()).toEqual({ parts: 2, size: 10, ready: false });
    expect((await call("PUT", "id=7K3FQX9P&part=0", "abc_-")).status).toBe(200);
    expect((await call("PUT", "id=7K3FQX9P&part=0", "again")).status).toBe(409);
    expect((await call("PUT", "id=7K3FQX9P&part=1", "de")).status).toBe(200);
    expect(await (await call("GET", "id=7K3FQX9P")).json()).toMatchObject({ ready: true });

    const part = await call("GET", "id=7K3FQX9P&part=0");
    expect(await part.text()).toBe("abc_-");
    expect(part.headers.get("cache-control")).toBe("no-store");

    expect((await call("DELETE", "id=7K3FQX9P")).status).toBe(204);
    expect([...redis.store.keys()].filter((k) => k.startsWith("relay:"))).toEqual([]);
    expect((await call("GET", "id=7K3FQX9P")).status).toBe(404);
  });

  it("never lets a second sender take a transfer id", async () => {
    expect((await call("POST", "id=7K3FQX9P&parts=1&size=5")).status).toBe(201);
    expect((await call("POST", "id=7K3FQX9P&parts=1&size=5")).status).toBe(409);
  });

  it("refuses bad ids, oversized transfers and anything that isn't sealed text", async () => {
    expect((await call("POST", "id=short&parts=1&size=5")).status).toBe(400);
    expect((await call("POST", "id=7K3FQX9O&parts=1&size=5")).status).toBe(400); // O isn't Crockford
    expect((await call("POST", `id=7K3FQX9P&parts=${MAX_PARTS + 1}&size=5`)).status).toBe(413);
    expect((await call("POST", `id=7K3FQX9P&parts=1&size=${PART_CHARS + 1}`)).status).toBe(413);
    await call("POST", "id=7K3FQX9P&parts=1&size=5");
    expect((await call("PUT", "id=7K3FQX9P&part=0", "not base64!")).status).toBe(400);
    expect((await call("PUT", "id=7K3FQX9P&part=0", "a".repeat(PART_CHARS + 1))).status).toBe(413);
    expect((await call("PUT", "id=7K3FQX9P&part=3", "abc")).status).toBe(400);
    expect((await call("PUT", "id=ZZZZZZZZ&part=0", "abc")).status).toBe(404);
  });

  it("limits how many transfers one network can start in an hour", async () => {
    for (let i = 0; i < 20; i++) {
      const id = `7K3FQX${String(i).padStart(2, "0")}`;
      expect((await call("POST", `id=${id}&parts=1&size=5`)).status).toBe(201);
    }
    expect((await call("POST", "id=7K3FQXZZ&parts=1&size=5")).status).toBe(429);
    // The network's address is only ever stored hashed.
    expect([...redis.store.keys()].some((k) => k.includes("unknown") || k.includes("127.0.0.1"))).toBe(false);
  });

  it("does not store a part when usage tracking or the size limit fails", async () => {
    await call("POST", "id=7K3FQX9P&parts=1&size=5");
    const oversized = await call("PUT", "id=7K3FQX9P&part=0", "abc", "https://comtus-ai.vercel.app", { "content-length": String(PART_CHARS + 1) });
    expect(oversized.status).toBe(413);
    expect(redis.store.has("relay:7K3FQX9P:0")).toBe(false);

    const original = redis.fetchMock.getMockImplementation();
    redis.fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const [cmd] = JSON.parse(String(init.body)) as string[];
      if (cmd === "INCR") return new Response(JSON.stringify({ result: null }), { status: 200 });
      return original?.(url, init) ?? new Response(JSON.stringify({ result: null }), { status: 200 });
    });
    expect((await call("PUT", "id=7K3FQX9P&part=0", "abc")).status).toBe(502);
    expect(redis.store.has("relay:7K3FQX9P:0")).toBe(false);
  });

  it("says plainly when it isn't configured or can't reach Redis", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    expect((await call("GET", "id=7K3FQX9P")).status).toBe(503);
    process.env.UPSTASH_REDIS_REST_URL = UPSTASH;
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect((await call("GET", "id=7K3FQX9P")).status).toBe(502);
  });

  it("answers CORS only for Comtus origins", async () => {
    const res = await call("OPTIONS", "id=7K3FQX9P", undefined, "https://evil.example");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const tauri = await call("OPTIONS", "id=7K3FQX9P", undefined, "tauri://localhost");
    expect(tauri.headers.get("access-control-allow-methods")).toContain("PUT");
  });
});
