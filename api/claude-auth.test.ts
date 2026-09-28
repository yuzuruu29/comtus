import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./claude-auth";

const ORIGIN = "https://www.comtus-ai.xyz";

function post(body: string): Request {
  return new Request("http://localhost:3000/api/claude-auth", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Claude sign-in relay", () => {
  it("forwards code exchanges and refreshes verbatim", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: "a" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    for (const grant of ["authorization_code", "refresh_token"]) {
      const body = JSON.stringify({ grant_type: grant, code: "c" });
      const res = await handler(post(body));
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses anything that isn't a token grant", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await handler(post("not json"))).status).toBe(400);
    expect((await handler(post(JSON.stringify({ grant_type: "client_credentials" })))).status).toBe(400);
    expect((await handler(post(JSON.stringify({ grant_type: "refresh_token", pad: "x".repeat(17_000) })))).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is POST only", async () => {
    const res = await handler(new Request("http://localhost:3000/api/claude-auth", { headers: { origin: ORIGIN } }));
    expect(res.status).toBe(405);
  });
});
