// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { exchangeOpenRouterCode } from "./openrouterAuth";
import { useSettings } from "./settings";

const verifier = "v".repeat(64);
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  sessionStorage.clear();
  useSettings.getState().update({ compatKey: "existing-key" });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("shares one exchange when callback effects run twice", async () => {
  sessionStorage.setItem("comtus_or_verifier", verifier);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ key: "new-key" })));
  await expect(Promise.all([
    exchangeOpenRouterCode("one-code"),
    exchangeOpenRouterCode("one-code"),
  ])).resolves.toEqual(["new-key", "new-key"]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ code_verifier: verifier });
  expect(sessionStorage.getItem("comtus_or_verifier")).toBeNull();
  expect(useSettings.getState().compatKey).toBe("new-key");
});

it("rejects unsolicited callbacks without making a key exchange", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ key: "unwanted-key" })));
  await expect(exchangeOpenRouterCode("unsolicited-code")).rejects.toThrow(/start.*again/i);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(useSettings.getState().compatKey).toBe("existing-key");
});

it("does not save a malformed credential response", async () => {
  sessionStorage.setItem("comtus_or_verifier", verifier);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ key: { token: "wrong-shape" } })));
  await expect(exchangeOpenRouterCode("malformed-code")).rejects.toThrow(/API key/);
  expect(useSettings.getState().compatKey).toBe("existing-key");
});

it("does not include upstream response bodies in user-visible errors", async () => {
  sessionStorage.setItem("comtus_or_verifier", verifier);
  fetchMock.mockResolvedValue(new Response("sensitive-upstream-body", { status: 400 }));
  await expect(exchangeOpenRouterCode("failed-code")).rejects.toThrow("OpenRouter key exchange failed (400)");
});
