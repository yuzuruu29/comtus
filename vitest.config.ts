import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-native": resolve(__dirname, "mobile/src/test/react-native-mock.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    teardownTimeout: 8_000,
    exclude: [...configDefaults.exclude, "promo/**"],
  },
});

