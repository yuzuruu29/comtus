import { describe, expect, it } from "vitest";
import handler from "./anthropic";

describe("hosted Anthropic proxy CORS", () => {
  it("allows the isolated Tauri development origin", async () => {
    const origin = "http://127.0.0.1:5199";
    const response = await handler(
      new Request("http://localhost:3000/api/anthropic/v1/messages", {
        method: "OPTIONS",
        headers: { origin },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
  });
});
