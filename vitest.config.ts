import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// Tests that need a browser. Everything else under src/lib, api and src/styles
// is pure logic and runs in node, where a file costs about 2.6s instead of 18s:
// jsdom boot, not the assertions, is what makes the suite slow.
const DOM_LIB_TESTS = [
  "compatRoute",
  "desktop",
  "lazyChunk",
  "pixelMotion",
  "soundEngine",
  "theme",
  "useBreakpoint",
  "useSmoothText",
  "voice",
  "webSearch",
];
const DOM_LIB_GLOB = `src/lib/{${DOM_LIB_TESTS.join(",")}}.test.ts`;

const shared = {
  globals: false,
  setupFiles: ["./src/test/setup.ts"],
  testTimeout: 15_000,
  hookTimeout: 15_000,
  teardownTimeout: 8_000,
  pool: "threads" as const,
  exclude: [...configDefaults.exclude, "promo/**", "mobile/**"],
};

export default defineConfig({
  plugins: [react()],
  // vite.config.ts defines this for the app build; without it here, any test
  // that renders SettingsModal dies on an undefined global.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    ...shared,
    projects: [
      {
        extends: true,
        test: {
          ...shared,
          name: "node",
          environment: "node",
          include: ["src/lib/**/*.test.ts", "api/**/*.test.ts", "src/styles/**/*.test.ts"],
          exclude: [...shared.exclude, DOM_LIB_GLOB],
        },
      },
      {
        extends: true,
        test: {
          ...shared,
          name: "dom",
          environment: "jsdom",
          include: [
            "src/**/*.test.tsx",
            "src/studio/**/*.test.ts",
            "src/landing/**/*.test.ts",
            DOM_LIB_GLOB,
          ],
        },
      },
    ],
  },
});
