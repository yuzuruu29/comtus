import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
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
  },
});

