import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./compat";

const ORIGIN = "http://localhost:5173";

function req(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:3000${path}`, {
    ...init,
    headers: { origin: ORIGIN, ...((init.headers as Record<string, string>) ?? {}) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("compat relay", () => {
  it("answers preflights with 204 + CORS for allowed origins", async () => {
    const res = await handler(req("/api/compat/zen/v1/models", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("allows the isolated Tauri development origin", async () => {
    const origin = "http://127.0.0.1:5199";
    const res = await handler(
      new Request("http://localhost:3000/api/compat/zen/v1/models", {
        method: "OPTIONS",
        headers: { origin },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it("allows the custom production domain", async () => {
    const origin = "https://www.comtus-ai.xyz";
    const res = await handler(
      new Request("http://localhost:3000/api/compat/zen/v1/models", {
        method: "OPTIONS",
        headers: { origin },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it("preflight allows every header the installed SDK sends", async () => {
    const sent = new Set<string>();
    const client = new OpenAI({
      apiKey: "sk-test",
      baseURL: `${ORIGIN}/api/compat/mistral/v1`,
      dangerouslyAllowBrowser: true,
      maxRetries: 0,
      defaultHeaders: { "X-Title": "Comtus" },
      fetch: async (_url: unknown, init?: RequestInit) => {
        new Headers(init?.headers).forEach((_value, name) => sent.add(name));
        return new Response("{}", { status: 500 });
      },
    });
    const params = { model: "m", messages: [{ role: "user" as const, content: "hi" }] };
    await client.chat.completions.create(params).catch(() => undefined);
    await client.chat.completions.create({ ...params, stream: true }).catch(() => undefined);
    await client.models.list().catch(() => undefined);
    // Browsers send these without asking (or refuse to let scripts set them).
    for (const free of ["accept", "user-agent"]) sent.delete(free);
    expect(sent.size).toBeGreaterThan(3);

    const res = await handler(req("/api/compat/mistral/v1/models", { method: "OPTIONS" }));
    const allowed = res.headers.get("access-control-allow-headers")?.split(",") ?? [];
    expect([...sent].filter((name) => !allowed.includes(name))).toEqual([]);
  });

  it("404s unknown providers", async () => {
    const res = await handler(req("/api/compat/nope/v1/models"));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toHaveProperty("error");
  });

  it("maps direct-hit paths onto the upstream origin", async () => {
    const spy = vi.fn(
      async () =>
        new Response('{"object":"list","data":[]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", spy);

    const res = await handler(req("/api/compat/zen/zen/v1/models"));
    expect(spy).toHaveBeenCalledWith(
      "https://opencode.ai/zen/v1/models",
      expect.objectContaining({ method: "GET" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.text()).resolves.toBe('{"object":"list","data":[]}');
  });

  it("honours rewrite params and strips control params from the forwarded query", async () => {
    const spy = vi.fn(async () => new Response("{}" , { status: 200 }));
    vi.stubGlobal("fetch", spy);

    await handler(req("/api/compat?p=zen&path=v1/models&limit=5"));
    expect(spy).toHaveBeenCalledWith(
      "https://opencode.ai/v1/models?limit=5",
      expect.anything(),
    );
  });

  it("forwards POST method, authorization header, and body", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);

    await handler(
      req("/api/compat/mistral/v1/chat/completions", {
        method: "POST",
        headers: { authorization: "Bearer sk-test", "content-type": "application/json" },
        body: '{"model":"x"}',
      }),
    );
    const [url, call] = spy.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
    expect(call.method).toBe("POST");
    expect(call.headers.authorization).toBe("Bearer sk-test");
    expect(call.body).toBe('{"model":"x"}');
  });

  it("answers 502 with CORS when the provider is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const res = await handler(req("/api/compat/zen/v1/chat/completions", { method: "POST", body: "{}" }));
    expect(res.status).toBe(502);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    await expect(res.json()).resolves.toHaveProperty("error");
  });

  it("refuses oversized request bodies", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await handler(
      req("/api/compat/zen/v1/chat/completions", { method: "POST", body: "x".repeat(8 * 1024 * 1024 + 1) }),
    );
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses non-API and path-normalization bypasses without forwarding credentials", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    for (const path of ["redirect", "v1/%2e%2e/account", "v1/models%3Fnext=https://evil.example", "v1/chat/completions/../../account"]) {
      const response = await handler(req(`/api/compat?p=zen&path=${encodeURIComponent(path)}`, { headers: { authorization: "Bearer private-key" } }));
      expect(response.status).toBe(404);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("disallows upstream redirects and preserves multipart audio bytes", async () => {
    const spy = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("{}"));
    vi.stubGlobal("fetch", spy);
    const bytes = new Uint8Array([0, 255, 128, 13, 10]);
    const response = await handler(req("/api/compat/mistral/v1/audio/transcriptions", {
      method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" }, body: bytes,
    }));
    expect(response.status).toBe(200);
    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe("error");
    expect(new Uint8Array(init?.body as ArrayBuffer)).toEqual(bytes);
  });
});
