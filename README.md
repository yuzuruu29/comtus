# Comtus — Rough thought, polished.

A thinking study companion: grounded chat with visible reasoning and citations,
mock board exams, rubric-graded essays, flashcards, and study aids — all built
on your own sources, local-first, bring-your-own-key.

What a notebook holds:

- **Sources** — PDFs, Word files, web pages, notes and photos. Scanned pages
  and photos are read by your own model, only when you say yes. The reader
  keeps each source's paragraphs and pages; highlight passages, write margin
  notes, ask about a passage, or turn a sentence into a cloze card.
- **Chat** — answers grounded in your sources, with citations that open the
  reader at the passage.
- **Practice** — quizzes, timed mock exams and essay feedback. Results are
  kept, weak topics surface in "Where you stand", and misses become cards.
- **Flashcards** — spaced repetition, cloze cards, and Anki/CSV import and
  export.
- **An exam date** — a short plan for each day, and reviews that all land
  before the exam.
- **Cmd/Ctrl-K** — search inside every notebook.
- **Send to another device** — no account: the notebook is encrypted before
  it leaves, relayed for up to an hour, and merged on the other side.

See `BRAND.md` for the design system.

## Using a model

- **Local and free (desktop)** — install [Ollama](https://ollama.com/download);
  Comtus's first-run guide detects it, suggests one model pull, and every
  answer then runs on your machine.
- **Free web models** — OpenRouter's free router, connectable in one click.
- **Bring your own key** — Anthropic, OpenRouter, Groq, DeepSeek, Together,
  LM Studio and other OpenAI-compatible endpoints, stored on-device.
- **Smarter Models (hosted)** — one-time PayPal passes for Claude Opus 5.5 /
  Sonnet 5.5 through the Comtus proxy (`src/checkout/`, `api/paypal.ts`);
  usage is metered by token cost and the pass is restore by PayPal order id.

## Desktop app

Windows and macOS installers are published by CI to the public releases repo
(`yuzuruu29/comtus-releases`) on every `v*` tag; the site's download links and
the auto-updater manifest (`public/desktop/latest.json`) are produced by the
same run (`.github/workflows/desktop-release.yml`). The desk surface lives in
`src/desk/` and shares the studio's panes, settings and generators.

## Stack

- **Vite + React 19 + TypeScript + Tailwind v4** — one codebase for web & desktop
- **Models** — `@anthropic-ai/sdk` + `openai` SDKs (BYOK, browser-direct) or the
  hosted pass proxy (`api/anthropic.ts`); local Ollama via OpenAI-compatible
  endpoints
- **Dexie/IndexedDB** — notebooks, sources, chunks, history; nothing uploads
- **Native scroll timelines + Lenis** — landing-page motion (reduced-motion honored)
- **Tauri v2** — desktop wrapper (`src-tauri/`), auto-update via the updater plugin

## Develop

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5199
pnpm dev:desktop  # browser-based preview of the desktop shell
```

## Desktop

```bash
pnpm desktop:dev                         # isolated dev app/profile
pnpm exec tauri build --no-bundle        # unsigned local release executable
pnpm desktop:build                       # signed installers; requires Tauri signing env vars
```

## Structure

```
src/landing/     Landing page (scroll scenes, field guide, desktop install section)
src/desk/        Desktop surface (library rail, desk home, first-run setup)
src/studio/      The app: notebooks, sources, chat, generators
src/lib/         db, retrieval, llm client, import pipeline, settings, ollama
src/checkout/    Hosted Smarter Models checkout
api/             Vercel edge functions (anthropic proxy, paypal, search, relay, report)
src-tauri/       Desktop wrapper
```
