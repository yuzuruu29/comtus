import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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

/** Dev-server mirrors of the OAuth relays (api/claude-auth.ts and
 *  api/codex.ts on Vercel): Claude's token endpoint sends no CORS headers
 *  to third-party origins and the Codex backend blocks cross-origin reads
 *  entirely, so both sign-in paths are relayed same-origin in production —
 *  these middlewares keep `pnpm dev` behaving identically. */
function oauthRelay(): Plugin {
  const CODEX_UPSTREAM = "https://chatgpt.com";
  return {
    name: "oauth-relay",
    configureServer(server) {
      // Claude OAuth token exchange/refresh → platform.claude.com.
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== "/api/claude-auth") return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "POST only" }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        try {
          const upstream = await fetch("https://platform.claude.com/v1/oauth/token", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: Buffer.concat(chunks).toString("utf8") || "{}",
          });
          res.statusCode = upstream.status;
          res.setHeader(
            "content-type",
            upstream.headers.get("content-type") ?? "application/json",
          );
          res.end(await upstream.text());
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: `Claude auth relay failed: ${err instanceof Error ? err.message : "unknown"}` }));
        }
      });

      // Codex inference relay → chatgpt.com/backend-api/codex (SSE streams
      // through chunk-by-chunk, same as the compat mirror).
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const m = url.pathname.match(/^\/api\/codex(\/.*)?$/);
        if (!m) return next();
        if (req.method !== "GET" && req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "GET or POST only" }));
          return;
        }
        const authorization = req.headers["authorization"];
        if (!authorization || !String(authorization).startsWith("Bearer ")) {
          res.statusCode = 401;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "Sign in with your ChatGPT account in Comtus Settings first." }));
          return;
        }
        const subPath = m[1] || "/";
        const headers: Record<string, string> = {
          authorization: String(authorization),
          accept: String(req.headers["accept"] ?? "text/event-stream"),
        };
        if (req.method === "POST") {
          headers["content-type"] = String(req.headers["content-type"] ?? "application/json");
        }
        for (const name of ["chatgpt-account-id", "openai-beta", "session_id", "conversation_id", "originator", "version"]) {
          const value = req.headers[name];
          if (value) headers[name] = Array.isArray(value) ? value[0] : value;
        }
        const bodyChunks: Buffer[] = [];
        for await (const chunk of req) bodyChunks.push(chunk as Buffer);
        try {
          const upstream = await fetch(`${CODEX_UPSTREAM}/backend-api/codex${subPath}${url.search}`, {
            method: req.method,
            headers,
            ...(bodyChunks.length ? { body: Buffer.concat(bodyChunks) } : {}),
          });
          res.statusCode = upstream.status;
          res.setHeader(
            "content-type",
            upstream.headers.get("content-type") ?? "application/json",
          );
          for (const name of ["x-codex-primary-used-percent", "x-codex-primary-window-minutes", "x-codex-primary-reset-at"]) {
            const v = upstream.headers.get(name);
            if (v) res.setHeader(name, v);
          }
          if (req.method === "GET") {
            res.end(await upstream.text());
            return;
          }
          if (upstream.body) {
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
          res.end(JSON.stringify({ error: `Codex relay failed: ${err instanceof Error ? err.message : "unknown"}` }));
        }
      });
    },
  };
}

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

/** Desktop installers are release artifacts, not app assets — they live in
 *  desktop-releases/ (outside public/) so Tauri never bakes them into the
 *  app binary; site builds copy them into dist/desktop. Tauri builds run
 *  `vite build --mode tauri`, which skips this plugin. */
function copyDesktopReleases(): Plugin {
  return {
    name: "copy-desktop-releases",
    apply: (_, env) => env.mode !== "tauri" && !process.env.TAURI_ENV_PLATFORM,
    closeBundle() {
      const root = import.meta.dirname ?? process.cwd();
      const src = resolve(root, "desktop-releases");
      if (!existsSync(src)) return;
      cpSync(src, resolve(root, "dist", "desktop"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), compatRelay(), oauthRelay(), stampSwVersion(), copyDesktopReleases()],
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
          "vendor-motion": ["motion/react", "gsap"],
          "vendor-ai": ["@anthropic-ai/sdk", "openai"],
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-icons": ["lucide-react", "@phosphor-icons/react"],
        },
      },
    },
  },
});
