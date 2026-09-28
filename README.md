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
src/landing/     Landing page (preloader, lamp canvas, scroll choreography)
src/studio/      The app: notebooks, sources, chat, generators
src/lib/         db, retrieval, llm client, import pipeline, settings
src-tauri/       Desktop wrapper
```
