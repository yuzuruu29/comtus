import { describe, expect, it } from "vitest";
import { installPolyfills } from "./polyfills";

describe("upsert polyfill", () => {
  it("adds getOrInsert and getOrInsertComputed to Map and WeakMap", () => {
    installPolyfills();
    const map = new Map<string, number>([["a", 1]]) as Map<string, number> & {
      getOrInsert(k: string, v: number): number;
      getOrInsertComputed(k: string, f: (k: string) => number): number;
    };
    expect(map.getOrInsert("a", 9)).toBe(1);
    expect(map.getOrInsert("b", 2)).toBe(2);
    let calls = 0;
    expect(map.getOrInsertComputed("c", (k) => (calls++, k.length))).toBe(1);
    expect(map.getOrInsertComputed("c", () => (calls++, 99))).toBe(1);
    expect(calls).toBe(1);

    const key = {};
    const weak = new WeakMap<object, string>() as WeakMap<object, string> & {
      getOrInsertComputed(k: object, f: () => string): string;
    };
    expect(weak.getOrInsertComputed(key, () => "x")).toBe("x");
    expect(weak.get(key)).toBe("x");
  });
});
