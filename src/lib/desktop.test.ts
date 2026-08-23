import { afterEach, describe, expect, it } from "vitest";
import { isDeskShell, isTauri } from "./desktop";

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).isTauri;
  delete (window as unknown as Record<string, unknown>).__TAURI__;
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("desktop shell detection", () => {
  it("recognizes the current Tauri v2 runtime marker", () => {
    Object.defineProperty(window, "isTauri", {
      value: true,
      configurable: true,
    });
    expect(isTauri()).toBe(true);
    expect(isDeskShell()).toBe(true);
  });

  it("keeps compatibility with legacy Tauri globals", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
    });
    expect(isTauri()).toBe(true);
    expect(isDeskShell()).toBe(true);

    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    Object.defineProperty(window, "__TAURI__", { value: {}, configurable: true });
    expect(isTauri()).toBe(true);
  });

  it("does not mistake an ordinary test/browser page for Tauri", () => {
    expect(isTauri()).toBe(false);
    expect(isDeskShell()).toBe(false);
  });
});
