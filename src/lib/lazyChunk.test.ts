import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isStaleChunkError, loadChunk } from "./lazyChunk";

const reload = vi.fn();

beforeEach(() => {
  vi.stubGlobal("location", { ...window.location, reload });
  reload.mockClear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isStaleChunkError", () => {
  it("recognizes the browser phrasings for a vanished chunk", () => {
    expect(
      isStaleChunkError(new Error("Failed to fetch dynamically imported module: https://x/y.js")),
    ).toBe(true);
    expect(isStaleChunkError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(isStaleChunkError(new Error("Importing a module script failed."))).toBe(true);
  });

  it("ignores unrelated failures", () => {
    expect(isStaleChunkError(new Error("Network request failed"))).toBe(false);
    expect(isStaleChunkError("dynamically imported module" as unknown as Error)).toBe(true);
  });
});

describe("loadChunk", () => {
  it("passes successful imports straight through", async () => {
    await expect(loadChunk(async () => 42)).resolves.toBe(42);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when a chunk vanished under an open tab", async () => {
    // The held-forever promise is intentional: loadChunk parks callers
    // until the reload navigation lands.
    void loadChunk(() =>
      Promise.reject(new Error("Failed to fetch dynamically imported module: /assets/x.js")),
    );
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("rethrows instead of reload-looping within the guard window", async () => {
    sessionStorage.setItem("comtus:chunk-reload-at", String(Date.now()));
    await expect(
      loadChunk(() => Promise.reject(new Error("Failed to fetch dynamically imported module: /assets/x.js"))),
    ).rejects.toThrow("dynamically imported module");
    expect(reload).not.toHaveBeenCalled();
  });

  it("rethrows non-chunk failures untouched", async () => {
    await expect(loadChunk(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(reload).not.toHaveBeenCalled();
  });
});
