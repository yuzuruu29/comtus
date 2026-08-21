# Comtus — Rough thought, polished.

A thinking study companion: grounded chat with visible reasoning and citations,
mock board exams, rubric-graded essays, flashcards, and study aids — all built
on your own sources, local-first, bring-your-own-key.

See `BRAND.md` for the design system.

## Stack

- **Vite + React 19 + TypeScript + Tailwind v4** — one codebase for web & desktop
- **Claude API** (`@anthropic-ai/sdk`) — adaptive thinking, streaming, citations; BYOK, browser-direct
- **Dexie/IndexedDB** — notebooks, sources, chunks, history; nothing uploads
- **GSAP + ScrollTrigger + Lenis** — landing-page motion (reduced-motion honored)
- **Tauri v2** — desktop wrapper (`src-tauri/`)

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

## Desktop

```bash
pnpm tauri dev            # dev shell
pnpm tauri build          # NSIS installer in src-tauri/target/release/bundle
```

## Structure

```
src/landing/     Landing page (preloader, lamp canvas, scroll choreography)
src/studio/      The app: notebooks, sources, chat, generators
src/lib/         db, retrieval, llm client, import pipeline, settings
src-tauri/       Desktop wrapper
```
