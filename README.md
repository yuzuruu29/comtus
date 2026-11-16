<div align="center">

<img src="public/images/icon-192.png" width="96" height="96" alt="Comtus app icon">

# Comtus

### Rough thought, polished.

Comtus turns your PDFs, documents and notes into a study partner.<br>
Ask it anything and it answers from your own material, with the page it came from.<br>
Then it quizzes you, turns your mistakes into flashcards, and plans every review before exam day.

[![Open Comtus in your browser](https://img.shields.io/badge/Open_Comtus-in_your_browser-845C16?style=for-the-badge)](https://www.comtus-ai.xyz)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-0B132B?style=for-the-badge)](https://github.com/yuzuruu29/comtus-releases/releases/latest/download/Comtus_x64-setup.exe)
[![Download for macOS](https://img.shields.io/badge/Download-macOS-0B132B?style=for-the-badge)](#get-comtus)

<sub>Free to use. No Comtus account. Your notebooks stay on your device.</sub>

<br>

<a href="docs/media/comtus-how-it-works.mp4"><img src="docs/media/comtus-how-it-works.gif" width="100%" alt="Animation: study files drop into a Comtus notebook, a question gets an answer that cites page 12 of a lecture PDF, a missed quiz question becomes a flashcard, and an exam plan fills the week."></a>

<sub>How Comtus works, in 35 seconds. <a href="docs/media/comtus-how-it-works.mp4">Download the full-quality version (MP4, 4 MB)</a>.</sub>

</div>

## How it works

1. **Drop it all in.** PDFs, Word docs, web pages, typed notes and photos of handwritten pages go into one notebook per subject.
2. **Ask anything.** Answers come from your sources. Each one carries a small numbered citation that opens the exact passage it relied on, and you can watch the reasoning as it happens.
3. **Quiz yourself.** Flashcards, quizzes, timed mock exams and essay feedback, all made from your material. Every question you miss becomes a flashcard.
4. **Be ready by exam day.** Set the date and Comtus gives you a short plan for each day, so every review lands before the exam.

## What's in a notebook

| Feature | What you can do |
|---|---|
| 📄 **A reader for your sources** | Highlight passages, write margin notes, ask about a paragraph, or turn a sentence into a fill-in-the-blank card. |
| 💬 **Chat that shows its work** | Answers cite your pages, so checking one takes a single click. |
| 📝 **Practice that remembers** | Quiz and exam results are kept. *Where you stand* shows your weak topics, and misses become cards. |
| 🃏 **Flashcards that space themselves** | Spaced repetition and cloze cards, with Anki and CSV import and export. |
| ✍️ **Essay feedback** | Get your essay graded against a rubric, with the reasoning behind each mark. |
| 📅 **An exam plan** | A short list for each day, timed so your reviews finish before the test. |
| 🔎 **Search everything** | Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd> to search inside every notebook. |
| 📲 **Send to another device** | No account needed. The notebook is encrypted before it leaves, held for up to an hour, and merged on the other side. |

## Your notes stay yours

Notebooks, sources and history live on your device, in your browser or in the desktop app. Nothing is uploaded to a Comtus account, because there isn't one. When you ask a question, only that question and the relevant passages go to the AI provider you picked. Scanned pages and photos are read by a model only when you say yes.

AI can still make mistakes. That is why every answer points back to your source: check anything that matters.

## Pick your AI

| Option | Cost | How |
|---|---|---|
| **On your computer** (desktop) | Free | Install [Ollama](https://ollama.com/download). Comtus finds it on first launch and suggests one model to download. Answers then run on your own machine. |
| **Free web models** | Free | Connect OpenRouter in one click. The provider sets which models are free and how much you can use them. |
| **Your own key** | Your provider's rates | Anthropic, OpenRouter, Groq, DeepSeek, Together, LM Studio, or any OpenAI-compatible endpoint. Keys are stored on your device. |
| **Smarter Models** (hosted) | One-time top-up | Claude Opus 5.5 and Sonnet 5.5 through Comtus, paid with PayPal. No subscription. |

## Get Comtus

- **Web:** [www.comtus-ai.xyz](https://www.comtus-ai.xyz). Works in any modern browser, and installs as an app on your phone.
- **Windows:** [Download the installer](https://github.com/yuzuruu29/comtus-releases/releases/latest/download/Comtus_x64-setup.exe)
- **macOS:** [Apple silicon](https://github.com/yuzuruu29/comtus-releases/releases/latest/download/Comtus_aarch64.dmg) or [Intel](https://github.com/yuzuruu29/comtus-releases/releases/latest/download/Comtus_x64.dmg)

The desktop apps update themselves. Every release is listed in [comtus-releases](https://github.com/yuzuruu29/comtus-releases/releases).

## Questions

<details>
<summary><b>Is it really free?</b></summary>

Yes. Comtus itself costs nothing. Local models on the desktop app and OpenRouter's free models cost nothing either. Paying is only for the optional hosted Smarter Models, or for your own provider key if you use one.
</details>

<details>
<summary><b>Do I need an account?</b></summary>

Not for Comtus. You can open the desk and build a notebook straight away. To get answers you connect a model: local models need nothing, free web models need an OpenRouter account, and your own key needs that provider's account.
</details>

<details>
<summary><b>Can I trust the answers?</b></summary>

Check them. Every answer cites the passage it used, and the citation opens your source at that spot. Comtus is built so the evidence is always one click away.
</details>

<details>
<summary><b>What can I import?</b></summary>

PDF, Word (`.docx`), plain text and Markdown, images and photos, and web pages by link. Flashcards also import from Anki and CSV.
</details>

---

## For developers

Vite + React 19 + TypeScript + Tailwind v4, one codebase for web and desktop. See [`BRAND.md`](BRAND.md) for the design system.

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5199
pnpm dev:desktop  # browser-based preview of the desktop shell
pnpm test         # Vitest
pnpm lint
```

<details>
<summary><b>Stack</b></summary>

- **Vite + React 19 + TypeScript + Tailwind v4**: one codebase for web and desktop.
- **Models**: `@anthropic-ai/sdk` and `openai` SDKs (bring your own key, browser-direct) or the hosted pass proxy (`api/anthropic.ts`); local Ollama through OpenAI-compatible endpoints.
- **Dexie / IndexedDB**: notebooks, sources, chunks and history. Nothing uploads.
- **Native scroll timelines + Lenis**: landing-page motion, with reduced motion honored.
- **Tauri v2**: desktop wrapper (`src-tauri/`), auto-update through the updater plugin.
- **Hosted checkout**: one-time PayPal passes (`src/checkout/`, `api/paypal.ts`), metered by token cost and restorable by PayPal order id.
</details>

<details>
<summary><b>Desktop builds and releases</b></summary>

```bash
pnpm desktop:dev                         # isolated dev app and profile
pnpm exec tauri build --no-bundle        # unsigned local release executable
pnpm desktop:build                       # signed installers; requires Tauri signing env vars
```

CI publishes Windows and macOS installers to the public releases repo (`yuzuruu29/comtus-releases`) on every `v*` tag. The same run produces the site's download links and the auto-updater manifest (`public/desktop/latest.json`), see `.github/workflows/desktop-release.yml`. The desk surface lives in `src/desk/` and shares the studio's panes, settings and generators.
</details>

<details>
<summary><b>Project layout</b></summary>

```
src/landing/     Landing page (scroll scenes, field guide, desktop install section)
src/desk/        Desktop surface (library rail, desk home, first-run setup)
src/studio/      The app: notebooks, sources, chat, generators
src/lib/         db, retrieval, llm client, import pipeline, settings, ollama
src/checkout/    Hosted Smarter Models checkout
api/             Vercel edge functions (anthropic proxy, paypal, search, relay, report)
src-tauri/       Desktop wrapper
promo/           Remotion films, including the how-it-works explainer (promo/src/how)
```
</details>

<details>
<summary><b>The how-it-works animation</b></summary>

The animation at the top of this page is code. It is a Remotion composition in [`promo/src/how`](promo/src/how), drawn with the app's own tokens, fonts and Compad sprite. Its README has the render and GIF commands.
</details>
