import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

/** public/ files skip the bundle pipeline, so stamp the service worker's
 *  cache version post-build — each deploy rotates the shell cache. */
function stampSwVersion(): Plugin {
  return {
    name: "stamp-sw-version",
    closeBundle() {
      try {
        const p = resolve(import.meta.dirname ?? process.cwd(), "dist/sw.js");
        const stamped = readFileSync(p, "utf8").replace(
          "__SW_VERSION__",
          `comtus-shell-${Date.now().toString(36)}`,
        );
        writeFileSync(p, stamped);
      } catch {
        // no dist/sw.js — nothing to stamp
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stampSwVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-motion": ["motion/react", "gsap"],
          "vendor-ai": ["@anthropic-ai/sdk", "openai"],
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-icons": ["lucide-react", "@phosphor-icons/react"],
        },
      },
    },
  },
});
