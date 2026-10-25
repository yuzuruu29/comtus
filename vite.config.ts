import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { runSearch } from "./api/_search-core";
import pkg from "./package.json";

// Server-side secrets (e.g. FIRECRAWL_API_KEY for /api/search) live in .env
// files; Vite loads those into import.meta.env for client code but never into
// process.env for the config itself. Local wins by loading second.
for (const envFile of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(resolve(import.meta.dirname ?? process.cwd(), envFile));
  } catch {
    // file absent — fine
  }
}

/** Dev-server mirror of the production /api/compat relay
 *  (api/compat.ts on Vercel): same route shape, same behavior —
 *  fetch upstream server-side and re-serve same-origin so
 *  CORS-hostile providers (OpenCode Zen, Mistral) work in `pnpm dev`. */
function compatRelay(): Plugin {
  const UPSTREAMS: Record<string, string> = {
    zen: "https://opencode.ai",
    mistral: "https://api.mistral.ai",
  };
  return {
    name: "compat-relay",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const m = url.pathname.match(/^\/api\/compat\/([^/]+)(\/.*)?$/);
        if (!m) return next();
        const upstreamOrigin = UPSTREAMS[m[1]];
        if (!upstreamOrigin) {
          res.statusCode = 404;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: `Unknown relay provider: ${m[1]}` }));
          return;
        }
        const subPath = m[2] || "/";
        try {
          const headers: Record<string, string> = {};
          if (req.headers["content-type"]) headers["content-type"] = String(req.headers["content-type"]);
          if (req.headers["authorization"]) headers["authorization"] = String(req.headers["authorization"]);
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const upstream = await fetch(`${upstreamOrigin}${subPath}${url.search}`, {
            method: req.method,
            headers,
            ...(body ? { body } : {}),
          });
          res.statusCode = upstream.status;
          res.setHeader(
            "content-type",
            upstream.headers.get("content-type") ?? "application/json",
          );
          if (upstream.body) {
            // Stream chunks through as they arrive — SSE chat must
            // token-flow, not buffer until completion.
            await pipeline(
              Readable.fromWeb(upstream.body as unknown as WebReadableStream<Uint8Array>),
              res,
            );
          } else {
            res.end();
          }
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              error: `Relay fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
            }),
          );
        }
      });

      // Local dev mirror for /api/search — same core as api/search.ts on Vercel.
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== "/api/search") return next();
        const query = url.searchParams.get("q")?.trim() ?? "";
        if (!query) {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "Missing query parameter 'q'", results: [] }));
          return;
        }

        try {
          const { results, provider } = await runSearch(query);
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ results, provider }));
        } catch {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "Search failed", results: [] }));
        }
      });
    },
  };
}

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
  plugins: [react(), tailwindcss(), compatRelay(), stampSwVersion()],
  server: {
    // Tauri's devUrl and the browser smoke suite both depend on this exact port.
    host: "127.0.0.1",
    port: 5199,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-motion": ["motion/react"],
          "vendor-ai": ["@anthropic-ai/sdk", "openai"],
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-icons": ["@phosphor-icons/react"],
        },
      },
    },
  },
});
