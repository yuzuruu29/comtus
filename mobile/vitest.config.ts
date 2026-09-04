import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Mobile owns its own config so the react-native alias stops leaking into every
// root test. Run with: pnpm test:mobile
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "react-native": resolve(__dirname, "src/test/react-native-mock.ts") },
  },
  // Without an explicit root, `include` resolves against the repo root and this
  // config runs the whole web suite as well.
  root: __dirname,
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: [resolve(__dirname, "../src/test/setup.ts")],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
