/**
 * Small runtime polyfills for library code that runs ahead of browsers.
 *
 * pdfjs-dist 6 renders pages with Map.prototype.getOrInsertComputed (the
 * TC39 "upsert" proposal), which many browsers students use don't have
 * yet; without it every page render throws. Text extraction doesn't need
 * it, which is why this only surfaced when rendering scanned pages.
 */

type Upsert<K, V> = {
  getOrInsert(key: K, value: V): V;
  getOrInsertComputed(key: K, compute: (key: K) => V): V;
};

function install(proto: Map<unknown, unknown> | WeakMap<object, unknown>): void {
  const target = proto as unknown as Partial<Upsert<unknown, unknown>> & {
    has(key: unknown): boolean;
    get(key: unknown): unknown;
    set(key: unknown, value: unknown): unknown;
  };
  if (typeof target.getOrInsert !== "function") {
    Object.defineProperty(proto, "getOrInsert", {
      configurable: true,
      writable: true,
      value(this: typeof target, key: unknown, value: unknown) {
        if (!this.has(key)) this.set(key, value);
        return this.get(key);
      },
    });
  }
  if (typeof target.getOrInsertComputed !== "function") {
    Object.defineProperty(proto, "getOrInsertComputed", {
      configurable: true,
      writable: true,
      value(this: typeof target, key: unknown, compute: (key: unknown) => unknown) {
        if (this.has(key)) return this.get(key);
        const value = compute(key);
        this.set(key, value);
        return value;
      },
    });
  }
}

export function installPolyfills(): void {
  install(Map.prototype);
  install(WeakMap.prototype);
}

installPolyfills();
