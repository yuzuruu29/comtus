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
});
