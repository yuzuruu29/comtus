import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-motion": ["motion/react", "gsap"],
          "vendor-ai": ["@anthropic-ai/sdk", "openai"],
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
});
