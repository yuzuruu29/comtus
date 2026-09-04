# Comtus redesign — the Frontier Study Desk

Date: 2026-09-04
Status: proposed (design brief + inconsistency register; the executable plan is
`docs/superpowers/plans/2026-09-04-frontier-study-desk.md`)
Baseline: `2905ee3` on `main` · `tsc` 0 errors · `pnpm lint` 0 errors ·
`vitest` 63 files (suite exceeds 9 min on a cold sandbox; see plan §Phase 0)
Evidence captured: dev build at `127.0.0.1:5199`, 2026-09-04 (landing, shelf,
workspace at 1568×980 and 390×844)

---

## 0 · Why this document exists

Comtus already has a strong brand thesis (`BRAND.md`: *rough thought, polished*;
the parchment, the margin, the shelf) and a real product core (grounded chat with
citations, BM25 retrieval over local IndexedDB, quiz/exam/essay/flashcard
generators). It does not yet *look* or *behave* like one product. Three
successive visual directions were layered on top of each other rather than
replaced — a parchment scholar's desk, a "Cantor8 royal sapphire console", and a
16‑bit pixel arcade — and the code still carries all three. The result reads as
templated in exactly the ways design-review skills flag as generated UI
(eyebrow labels on every heading, numbered section markers, `A · B · C` meta
strings, icon-heading-text card grids, fake precision metrics).

This spec does three things:

1. **Names the inconsistencies precisely** (§2), with file:line evidence, so an
   agent can fix them without re-deriving the audit.
2. **Locks one design direction** (§3–§6) that is specific to *this* subject —
   a scholar's desk at night — and writes down the rules that keep it from
   sliding back into category defaults.
3. **Defines the product shape of a frontier study app** (§7): what "studying
   made easier with AI" means concretely for a nursing/LET/CPA/engineering
   reviewer, and which of those capabilities the redesign must ship versus
   stage.

The plan argues from this spec. Executors read both.

---

## 1 · Current state (evidence)

### 1.1 What the user sees today

| Surface | Observation (screenshots `.hoplite/shots/*`, 2026-09-04) |
|---|---|
| `/` first paint | A full-screen **dark pre-landing onboarding** ("Scholar Welcome · 01 Philosophy · 02 Calibration · 03 Launch", "CALIBRATE YOUR DESK") gates every first visit before any product is visible. Pixelify display *and* body copy. Three identical icon-heading-text cards. |
| `/` hero (after skip) | Light parchment ground with wavy contour lines; **Pixelify Sans as the body face** ("Transform complex course materials into defensible knowledge…"); eyebrow chip `▪ COMTUS COGNITIVE INFRASTRUCTURE`; headline *"Unified Cognitive Infrastructure for Deep Study"*; two pill CTAs with `↗`. Nav labels "Console · Power-Ups · Free Play · Help & FAQ" — arcade vocabulary on a study tool. |
| `/` section 2 | Eyebrow `▪ FOUNDATIONS`, four bordered cards each with its own eyebrow (`▪ DIALECTIC ENGINE`, `▪ SPACED RETENTION`…), and **invented metrics**: "98.4% Pass Rate · Socratic Pass", "94.2% Long-Term Retention", "99.1% Step Precision" (`src/landing/CantorShowcase.tsx:29–47,81–82`). Nothing in the product measures any of these. |
| `/studio` shelf | A console chassis with a status bar `COMTUS · Course Notebooks Shelf · INFERENCE: Local SQLite / Dexie` (`src/studio/NotebookList.tsx:220`) — the app uses IndexedDB, not SQLite. Doubled branding (status bar "COMTUS" + header "COMTUS"). Duplicated controls ("Create new" button + "Create new notebook" card). A 4-frame pixel battery mascot, ~130 px tall, bottom-right. CRT scanline overlay at `z-index: 40` over the whole viewport (`src/studio/console-shell.css:111–122`) — explicitly forbidden by `BRAND.md §5`. |
| `/studio/:id` | The three-pane desk is the strongest surface: Sources / Chat / Studio, composer with model chip, focus chip, effort chip, Think/Web toggles. Weaknesses: header has **nine** controls (`1/12`, Analytics, Share, `free · High`, gear, BYOK, sidebar toggle, account, back); Studio rail mixes "Audio Overview — COMING SOON" with a disabled "Soon" button; mascot overlaps the generator list (see screenshot `studio-02-workspace.png`, Essay Coach / Flashcards rows). |
| Settings gear | **Clicking the gear does nothing.** The keyboard shortcut (`Ctrl+,`) opens Settings. Root cause: `WorkspaceHeader` types `onSettings: () => void` (`Workspace.tsx:401`) but the parent passes `openSettings(tab: SettingsTab = "settings")` (`Workspace.tsx:44,196`). `<button onClick={onSettings}>` (`Workspace.tsx:501,507,519,524,546`) therefore calls `openSettings(MouseEvent)`; `SettingsModal` then renders `open && tab === "settings"` / `open && tab === "models"` (`SettingsModal.tsx:430,755`) — `tab` is a `MouseEvent`, neither matches, no dialog. |
| 390 px viewport | The workspace does **not** adapt: the desktop three-pane layout is rendered at phone width (screenshot `studio-04-mobile.png`, captured after `set viewport 390 844` without reload — a reload-dependent breakpoint is itself a defect; see §2.6). |

### 1.2 What the code contains

| Metric | Value | Source |
|---|---|---|
| CSS total | **6,327 lines** across 14 files | `wc -l` |
| Distinct `@keyframes` | 59 (6 names defined twice) | `rg '@keyframes'` |
| Theming hooks on `<html>` | `data-theme` (light/dark), `data-font-preset` (4), `data-pixel="on"` (98 selectors), `data-landing-pixel="on"` (62 selectors), `data-shell`, `data-platform` | `rg 'html\[data-'` |
| Token redefinitions of `--ink/--moon/--brass…` | 42 in `index.css`, 22 in `pixel-desk.css`, 13 in `pixel-landing.css` | §2.1 |
| Hardcoded hex in TSX | 166 `PixelDeskHeroScene.tsx`, 94 `OnboardingModal.tsx`, 80 `ComtusShowcase.tsx`, 56 `PixelUI.tsx`, 54 `StudyGlyph.tsx` | `rg '#[0-9a-f]{6}'` |
| Hardcoded hex in CSS (non-token lines) | 88 `comtus-showcase.css`, 53 `pixel-player.css`, 13 `scholar-deck.css` | |
| Arbitrary `text-[Npx]` | 833 uses, 22 distinct sizes | vs. a 5-step `--text-*` ladder in `index.css` |
| Raw `<button` in `src/studio` | 245 | `ui.tsx` exports only `Modal, Field, inputCls, btnGhost, btnLamp, ErrorNote, LampPulse` |
| `uppercase` tracked labels | 138 | the eyebrow tell |
| ` · ` meta joiners | 124 | the middle-dot tell |
| Icon libraries | `lucide-react` (27 files) **and** `@phosphor-icons/react` (26 files) | |
| Animation libraries | `gsap` (32 files, landing) **and** `motion` (23 files, studio) | |
| Dead code reachable from no route | `src/landing/{ComtusShowcase,PixelPlayerShowcase,PixelDeskHeroScene,Hero,ProductDemo,StudioShowcase,LearningLoop,Method,WhyComtus,UseCases,TrustPrivacy,AcademicIntegrity,BringStack,Marquee}.tsx` + `comtus-showcase.css` + `pixel-player.css` = **5,532 lines**; `src/desk/*` (1,681 lines) only mounts when `isDeskShell()` (Tauri / `VITE_DESKTOP_SHELL=1`) | `rg` import graph |
| Tests | 63 files; **zero** for `SettingsModal`, `SourcesPane`, `ChatPane`, `Workspace`, `NotebookList`, `ExamFlow`, `EssayFlow`, `AidsFlow` | |
| Committed binaries | 37 MB `desktop-releases/`, 4.3 MB `minimax-ad-assets/`, 3.7 MB `design-mockups/` | `du -sh` |
| `impeccable detect` (v3.6.1) | 20 findings: 8× bounce easing (`cubic-bezier(0.34,1.56,0.64,1)`), 5× layout `transition: width`, 4× decorative grid backgrounds, 1× gradient text (`.text-lamp`, `index.css:295`), 1× 3 px side-stripe border (`.md blockquote`, `studio.css:39`) | |

---

## 2 · Inconsistency register

Each entry: **what**, **evidence**, **rule it breaks**, **fix** (the plan task
that lands it). Severity: **P0** breaks the product or the brand promise;
**P1** makes the product read as templated or unfinished; **P2** hygiene.

### 2.1 Tokens and theming (P0)

| # | What | Evidence | Fix |
|---|---|---|---|
| T1 | Three competing sources of truth for the same semantic token. `--moon` is `#8c7e6d` in `index.css:150`, `var(--px-moon)` (= `#8C7E6D`, then `#C4B8A5` dark) in `pixel-desk.css:37,106` and `pixel-landing.css:44`; `BRAND.md §3` documents `--px-moon` as `#3D6E9E` (a blue that no longer exists in code). | `rg '^\s*--moon:'` | Plan T-1.1: one `tokens.css`; delete `pixel-palette.css` redefinitions; rewrite `BRAND.md §3` from the code. |
| T2 | `--ink` is `#0b132b` in `index.css:143` but `BRAND.md` says `#1B2334`. | | T-1.1 |
| T3 | Two parallel theming systems fight by specificity: `html[data-pixel="on"]` (98 rules, 7 `!important`) and `html[data-landing-pixel="on"]` (62 rules) each *re-map* every semantic token to `--px-*`, changing colors, radii (`--radius-control: 2px` at `pixel-landing.css:53`) and fonts underneath components that were styled against the base tokens. | `pixel-desk.css`, `pixel-landing.css` | T-1.2: remove `data-pixel` / `data-landing-pixel`; the pixel look becomes one optional `data-chrome="pixel"` attribute that only affects `PixelBatteryCompanion` and the 16-bit *accent* sprites, never tokens. |
| T4 | Font presets contradict their own docs. `fontPresets.ts:19` labels Instrument as "Unified Inter system", `font-presets.css:9–11` maps it to Inter, but `index.css:32–34` and `BRAND.md §4` say Instrument = Instrument Serif display + Instrument Sans body. Pixel Signal sets **`--font-body` to Pixelify** (`font-presets.css:17`) — `BRAND.md §4` forbids Pixelify as body text, and the landing does the same at `pixel-landing.css:52`. | | T-1.3: presets retired; Literata (reading) + Instrument Sans (UI); Pixelify only under `data-chrome="pixel"` display headings, never in `--font-body`. |
| T5 | Radius scale exists (`--radius-control/field/dialog` = 6/10/12 px) but 25 distinct literal radii are used in CSS (`999px` ×14, `2px` ×7, `4px` ×12, `6px` ×14, `8px`, `14px`, `20px`, `50%`…) plus `rounded-[2px]` ×29 in TSX. | §1.2 | T-1.1 adds `--radius-pill`; T-2.x components consume only tokens; guard test. |
| T6 | Type scale exists (`--text-display/title/heading/body/label`) but 833 arbitrary `text-[Npx]` uses bypass it. | | T-1.3 fixed rem ladder; T-2.5 components consume it; `scale.test.ts` ratchets arbitrary sizes to 0. |
| T7 | Colors leak past the palette: sapphire/cyan glows `rgba(4,74,179,…)` and `rgba(111,227,255,…)` in `cantor-theme.css:512–548`, `pixel-landing.css:507`, and the focus ring of the shelf search (`NotebookList.tsx:285`). `StudyFocusDock.tsx:46–62` ships a 7-color ring picker (`#FFD166`, `#4EED88`, `#5CE1E6`…) exempted in `palette.test.ts`. | | T-1.1, T-3.x; StudyFocusDock ring colors reduce to brass/moon/sage/candle. |

### 2.2 Brand-forbidden and generated-UI patterns (P0/P1)

| # | What | Evidence | Fix |
|---|---|---|---|
| B1 | CRT scanline overlay over the whole studio viewport; scanline/CRT classes in three landing files. `BRAND.md §5` lists "CRT overlays / obvious scanlines" under **Forbidden Motion (never ship)**. | `console-shell.css:111`, `scholar-deck.css:123–145`, `comtus-showcase.css:280`, `pixel-player.css:264` | T-0.3 delete. |
| B2 | Invented statistics presented as product truth. | `CantorShowcase.tsx:29,38,47,81,82`; `ScholarConsoleDeck.tsx:307` ("99.8% Grounded") | T-4.1 landing rewrite: no number appears unless the product measures it. |
| B3 | False technical claims: "Local SQLite" (three places), "Claude 3.7 Sonnet, DeepSeek R1, GPT-4o" model names in marketing copy while the product's model lists are `claude-opus-5 / claude-sonnet-5 / gpt-5.6-*` (`settings.ts`, `types.ts:316`). | `NotebookList.tsx:220`, `CantorShowcase.tsx:56`, landing card copy | T-0.4, T-4.1. |
| B4 | Eyebrow/kicker labels above headings (138 uppercase-tracked labels; `label-mono` ×46 with `letter-spacing: .24em`), numbered section markers (`01 Philosophy · 02 Calibration · 03 Launch`, `01 — THE METHOD` motif in `BRAND.md §2`), `A · B · C` meta strings (124), `→`/`↗` appended to CTAs (7). Anthropic's `frontend-design` skill and impeccable's craft floor both list these as the commonest tells of generated UI; impeccable makes the eyebrow an outright ban. | §1.2 | §5.3 typographic rules; T-2.x, T-3.x, T-4.x. `BRAND.md §2` motif rewritten. |
| B5 | Emoji as icons in product UI (`🔥 Frontier Preview`, `🖼️ Multimodal`, `🧠 Deep Reasoning`, `⚡ Ultra-Fast LPUs`, `📊 View Full Model Comparison`). | `OpenRouterByokSection.tsx:53–87,406–410` | T-4.1. |
| B6 | Arcade vocabulary on a study tool: nav "Power-Ups", "Free Play", "Console"; "CALIBRATE YOUR DESK"; "PWR: ON"; "Rotate Reasoning Depth"; `.ROM` cartridge buttons (`USMLE-MED.ROM`). `BRAND.md §6`: "a warm scholar, not a hype startup". | `Nav.tsx:11–12`, `PreLandingOnboarding.tsx`, `ScholarConsoleDeck.tsx` | T-4.1. |
| B7 | Bounce easing (`cubic-bezier(0.34,1.56,0.64,1)` ×7, `effort-bounce`) in an interface whose motion doctrine is "ink bleeds into paper". Gradient text `.text-lamp`. 3 px brass side-stripe on blockquotes. | impeccable findings, `studio.css:666–1065`, `index.css:295,471,557` | T-1.4 motion tokens and anti-pattern sweep; T-2.x. |
| B8 | Backdrop blur used as decoration (23 uses) on a paper-material brand. | `rg backdrop-blur` | T-2.x: blur only on the modal scrim. |

### 2.3 Architecture and dead code (P1)

| # | What | Evidence | Fix |
|---|---|---|---|
| A1 | **5,532 lines** of landing components/CSS are unreachable from any route (`LandingPage.tsx` mounts only `CantorShowcase, CognitiveTelemetryGrid, ScholarConsoleDeck, OpenRouterByokSection, FAQSection, Statement, FinalCTA, Footer`). Tests still import the dead `ComtusShowcase` (`Landing.test.tsx:4`) and `PixelPlayerShowcase`; `palette.test.ts` carries an allow-list entry for a dead file. | import graph | T-0.2 delete with their tests. |
| A2 | `src/desk/*` (DeskApp, DeskHome, LibraryRail, NotebookDesk — 1,681 lines) is a second, divergent app shell reached only in the Tauri build. Two products, one repo, no shared components. | `StudioApp.tsx:33–40` | T-5.1: desktop uses the same Studio; `DeskShell` keeps only the Tauri titlebar/updater concerns. |
| A3 | Three nested shells wrap the workspace: `DeskShell` (shortcuts, palette, companion, theme effects) → `ConsoleShell` (bezel, status bar, scanlines) → `Workspace` (own `WorkspaceHeader`). Two headers show the product name. | `Workspace.tsx:115–124`, `ConsoleShell.tsx:18–30` | T-3.1: `DeskShell` + one `DeskHeader`; `ConsoleShell` removed. |
| A4 | Two icon sets, two motion libraries, one dead landing dependency graph (`lenis`, `gsap` stay only for the landing). `PixelLampCompanion.tsx` is a 15-line alias shim over `PixelBatteryCompanion`. | §1.2 | T-0.5 (`lucide-react` → Phosphor everywhere), T-4.x (landing motion decided per §6), T-0.2. |
| A5 | God files: `SettingsModal.tsx` 1,682 lines (two modals + key vault + OAuth + plan/tier + typography + data), `ChatPane.tsx` 1,649, `llm.ts` 1,271, `AidsFlow.tsx` 934 (four generators). | `wc -l` | T-3.4, T-3.6 split by responsibility; no file over ~500 lines after the plan. |
| A6 | State scattered across 21 ad-hoc `localStorage` keys with two naming schemes (`comtus:battery_pos`, `comtus_kickstart`, `comtus-layout`), a zustand store, and Dexie. | `rg 'comtus[:_-]'` | T-3.7: one `prefs.ts` with a typed key registry; migrate keys once. |
| A7 | Breakpoints disagree: `matchMedia("(min-width:1024px)")` in `Workspace.tsx`, `(max-width:1199px)` ×3 elsewhere, CSS at 640/768/991/1300 px; `ConsoleShell` drops padding at 768. | §1.2 | T-1.5: `--bp-*` documented ladder (sm 640 / md 900 / lg 1200) and one `useBreakpoint()` hook. |
| A8 | Test suite cannot be used as a gate: full run exceeds 9 minutes on a cold sandbox (`launch-check.sh` assumes ~20 s). | `vitest run` timing | T-0.1: fix `react-native` alias leak, isolate mobile tests, `pool: "threads"`, per-dir timing budget. |
| A9 | Repository weight: 37 MB installers, 4.3 MB ad renders, 3.7 MB mockup PNGs, sample PDFs at root. | `du -sh` | T-0.6: move release binaries to GitHub Releases; ad assets out; keep `design-mockups/` only for the approved reference set. |

### 2.4 Product and AI layer (P1)

| # | What | Evidence | Fix |
|---|---|---|---|
| P1 | "Spaced repetition deck" is an ad-hoc SM-2-lite: `ease` starts 2.5, `again −0.2 / hard −0.05 / good +0.02 / easy +0.12`, interval `max(1, round(interval × ease × {0.8,1,1.25}))`. No retrievability model, no review log, no daily queue across notebooks. | `AidsFlow.tsx:357–377`, `types.ts:254–261` | T-6.1 FSRS via `ts-fsrs@5.4.2` (`fsrs()`, `createEmptyCard()`, `Rating`), `reviewLog` table, cross-notebook **Today** queue. |
| P2 | Attempts are not persisted: quiz and exam results live in component state only; nothing feeds back into what to study next. | `rg 'db.generations.put' generators/*` → only AidsFlow | T-6.2 `attempts` table; `ExamFlow`/`QuizFlow` write one row per item. |
| P3 | No concept/topic layer: generators carry `topic: string` per item but nothing aggregates weak topics, so "make me a quiz on the hardest part" is a prompt string, not a query. | `types.ts:117` | T-6.3 `topics` derived from attempts + card ratings; **Weak spots** panel; generators accept `topicFilter`. |
| P4 | Retrieval is BM25 over ~1,150-token chunks with 550-char overlap, full-context under 90k tokens, otherwise top-8 within a 45k budget. No reranking, no highlight → citation mapping for the reader. | `import.ts:195–196`, `retrieval.ts:31–32,100` | Keep BM25 (local-first, no second key); T-6.5 adds per-page anchors so citations open the exact page/offset in the reader. Embeddings stay out of scope (would require a second provider or a 20–80 MB local model). |
| P5 | Audio Overview is a permanent "COMING SOON" card with a disabled "Soon" button in the primary Studio rail. | screenshot; `StudioPane.tsx` | T-3.5 remove from the rail; add back only when shippable. |
| P6 | Study session has no shape: a Pomodoro exists but is "disabled/hidden by default" inside the companion dock (`StudyFocusDock.tsx:119`); milestones are 12 static badges. | | T-6.4 `sessions` table; **Session bar** in the desk; milestones derive from sessions and attempts. |
| P7 | Provider parity is uneven and undocumented in-product: reasoning/thinking is surfaced for Anthropic and Codex, `webSearch` relays through `/api/search`; the composer shows `Think` and `Web` toggles regardless of whether the active model supports them. | `llm.ts:487–512` | T-3.3: capability flags per provider (`supportsThinking`, `supportsVision`, `supportsWeb`) drive the composer. |

### 2.5 Copy (P1)

Exclamation marks in UI: 4. Hype vocabulary: 5 hits (`cutting-edge`, `power-up`…). Same
concept, three words: the app is "Studio" in the route and rail, "Desk" in the
shell and brand, "Console" in the landing nav and status bar, "workspace" in
code. Sources are "sources" in the rail and "documents/materials/vault" in
marketing. §5.5 fixes the glossary; `CONTEXT.md` (new) is its home.

### 2.6 Functional defects found during capture (P0)

| # | Defect | Evidence | Fix |
|---|---|---|---|
| F1 | Settings gear, `free · High` chip, BYOK badge, and account button in the workspace header do nothing (see §1.1). | `Workspace.tsx:401,501–546` | T-0.4 one-line fix + regression test (render `Workspace`, click `aria-label="Settings"`, expect `role="dialog"`). |
| F2 | Responsive layout is resolved once with `window.matchMedia(...).matches` in event handlers and `useMediaQuery` at mount; changing viewport without reload leaves the desktop grid at 390 px. | `Workspace.tsx:256` | T-1.5 `useBreakpoint()` subscribes to `change`. |
| F3 | Studio chunk is 1.24 MB (build warning); cold load of `/studio` showed only a pulsing dot for >10 s in dev. | `.audit/launch-readiness.tsv`, capture | T-3.8 route-level splits for generators, exports (`jspdf`, `pptxgenjs`), `katex`. |

---

## 3 · Design direction — one world, locked

### 3.1 Subject, audience, job

**Subject:** a scholar's desk at night — the last lamp on in a library reading
room. Paper, ink, brass lamp hardware, a leather-bound notebook, a wooden
shelf. Instruments, not screens.

**Audience:** board-exam reviewers (nursing, LET, CPA, engineering) and university
students who study for long stretches, often late, often with the tab left
open, often on a phone between sessions.

**Job of the product:** turn the materials the student already has into
understanding they can prove — with every claim traceable to a page.

**Job of the landing page:** make a tired student believe that this desk will
respect their time and their sources. Persuade mode.

**Job of the studio:** disappear into the task. Operate mode.

### 3.2 The one memorable thing

**The lamp.** Not a mascot — a light source. Every surface in the studio is lit
from one warm point (the composer). Focus, streaming, and citation highlights
are all expressions of the same lamp: when the model is thinking, the lamp
breathes; when a citation is selected, the lamp swings to the source and the
passage glows; when the student drifts, the lamp dims a notch. It is the single
motion moment the brand spends its boldness on. Everything else is paper.

This replaces three competing "memorable things" (sapphire console, pixel
battery, CRT chassis) with one that grows out of the subject.

### 3.3 Anti-references (must not appear)

- Sapphire/cyan glows, "Cantor8", telemetry grids, circuit streams, CRT bezels,
  scanlines, `.ROM` cartridges — the console world is retired.
- Pixel type in body copy; Pixelify anywhere except the optional accent chrome.
- The generated-UI tells listed in §2.2 B4: eyebrows, numbered sections
  without sequence meaning, middle-dot meta strings, arrow-suffixed CTAs,
  identical icon-heading-text card grids, hero-metric templates, gradient text,
  glassmorphism, bounce easing, colored side-stripes.
- Gamification grammar: XP, streaks-as-guilt, combos, confetti (already
  forbidden in `BRAND.md §5`; the plan removes the remaining arcade vocabulary).
- Invented numbers. If the product does not measure it, the page does not say it.

### 3.4 What is kept from the incumbent

The parchment palette and its Lamplight dark counterpart; brass as the single
accent; sage/rust/candle as state colors; the ink-press button physics; the
three-pane Sources / Chat / Studio desk; grounded-or-silent chat with visible
thinking and footnote-style citations; the four-mode layout (`standard,
reading, writing, focus`); the command palette; the battery companion **as an
optional 16-bit accent** the student can turn off.

---

## 4 · Palette

One master palette. Every other color is derived with `color-mix()`.

| Token | Daylight | Lamplight | Role |
|---|---|---|---|
| `--ground` | `#F5F1E8` | `#0B0F1A` | page ground (aged paper / midnight) |
| `--surface` | `#FCFAF4` | `#121828` | cards, panes, composer |
| `--raised` | `#EAE4D6` | `#1A2136` | hover, active rows, chips |
| `--ink` | `#0B132B` | `#F2EDE3` | primary text |
| `--muted` | `#5A6274` | `#8E96AB` | secondary text (≥ 4.5:1 on ground in both themes) |
| `--hairline` | `rgba(11,19,43,.12)` | `rgba(242,237,227,.09)` | dividers |
| `--hairline-strong` | `rgba(11,19,43,.22)` | `rgba(242,237,227,.18)` | borders on interactive controls |
| `--brass` | `#A5731C` | `#E3B04B` | the lamp — primary action, selection, citation |
| `--brass-deep` | `#7D5312` | `#C99236` | pressed states, text on brass fills |
| `--brass-pale` | `#E3B04B` | `#F0CE8C` | glow, active rims |
| `--leather` | `#4A2E1B` | `#4A2E1B` | notebook spines, footer, deep shadows |
| `--sage` | `#4F8A5A` | `#8FBF98` | correct / verified |
| `--rust` | `#B2554A` | `#C96A5E` | incorrect / error |
| `--candle` | `#D97724` | `#FF9E43` | milestone flare, due-today badge |
| `--moon` | `#8C7E6D` | `#C4B8A5` | thinking drawer, reasoning text, secondary accent (pewter, not blue) |

Rules:

1. Brass is the only accent used for *action*. Sage/rust/candle carry *state*.
   Moon carries *reasoning* (the thinking drawer, effort chip) and nothing else.
2. Secondary text on tinted surfaces is tinted from `--ink`/`--muted`, never
   gray (`color-mix(in srgb, var(--ink) 62%, var(--surface))`).
3. Elevation is declared once: paper cards use a **shadow** with offset and
   blur (`--elev-card: 1px 2px 0 rgba(92,61,30,.14), 0 4px 14px -3px rgba(74,46,27,.12)`);
   controls use a **1 px hairline**. Never both on the same element.
4. Glows exist only on the lamp (composer focus/streaming) and citation
   targets — never as decorative halos on buttons or cards.
5. `BRAND.md §3` is rewritten from this table; the `--px-*` layer is deleted.

Tailwind exposure stays as it is today (`@theme` maps `--color-*` to these
variables) so `bg-surface`, `text-muted`, `border-hairline` keep working.

---

## 5 · Typography

### 5.1 Faces

| Role | Face | Package (already installed unless noted) | Why |
|---|---|---|---|
| Reading (sources, answers, notes, long copy) | **Literata Variable** | `@fontsource-variable/literata` (**add**) | An optical-size serif designed for screen reading; it is the book on the desk. Distinct from the cream-serif default (Fraunces/Newsreader) that generated pages reach for. |
| Interface (labels, buttons, chips, nav, data) | **Instrument Sans Variable** | installed | Compact, slightly quirky grotesque; already the body face in `index.css`. |
| Numerals & code (citations `[3]`, page refs, timers, token counts, code) | **JetBrains Mono** | installed | Used for *measurement*, never as a "technical" costume for labels. |
| Optional accent chrome (`data-chrome="pixel"`) | **Pixelify Sans Variable** | installed | Display headings and companion chrome only. Never body, never labels. |

Removed: Fraunces, Inter, Instrument Serif (three fewer font payloads; the
Scholar/Console/Instrument-as-Inter presets are retired — see T-1.3).

### 5.2 Scale (fixed rem, ratio 1.2 for UI; reading uses its own measure)

| Token | Size / line-height | Use |
|---|---|---|
| `--text-xs` | 0.6875rem / 1.4 | timestamps, page refs (mono) |
| `--text-sm` | 0.8125rem / 1.45 | chips, secondary labels |
| `--text-base` | 0.875rem / 1.55 | UI body, buttons |
| `--text-md` | 1rem / 1.5 | pane headings |
| `--text-lg` | 1.25rem / 1.3 | notebook titles, dialog titles |
| `--text-xl` | 1.5rem / 1.25 | shelf heading |
| `--text-read` | 1.0625rem / 1.65 | **Literata** reading measure, max width `68ch` |
| `--text-read-h` | 1.375rem / 1.3 | headings inside answers/notes |
| Landing display | `clamp(2.6rem, 6vw, 5.4rem)` / 1.02, tracking `-0.02em` | Literata, the only fluid step |

The 22 arbitrary `text-[Npx]` sizes collapse onto this ladder. A guard test caps
new arbitrary sizes at zero outside `src/landing/`.

### 5.3 Typographic rules (the anti-tell list, enforced by review and tests)

1. No eyebrow/kicker above a heading. The heading carries its own weight.
2. No all-caps tracked labels. Labels are sentence case, `--text-sm`, `--muted`.
   The `.label-mono` class is deleted.
3. Numbering only where order carries information (exam items, steps in a
   worked solution, footnote citations). Never section decoration.
4. No ` · ` joiners in UI strings. Use a real separator with meaning
   (comma, "and", a second line) or a pill per fact.
5. No `→` / `↗` appended to button or link text. Icons come from Phosphor, one
   weight (`regular`), 16 or 20 px.
6. Mono is for numbers and code. A label in mono is a defect.
7. Reading measure 60–72ch; UI text may run denser.

### 5.4 Voice (extends `BRAND.md §6`)

Second person, sentence case, no exclamation marks, verbs on buttons, errors
name the problem and the recovery ("The key was rejected. Check it in Settings
and try again."). Empty states teach one action. The words "cognitive",
"infrastructure", "engine", "console", "power-up", "unleash", "revolutionary"
do not appear in product or marketing copy.

### 5.5 Glossary (single names; lives in `CONTEXT.md`)

| Concept | Word | Not |
|---|---|---|
| The app surface at `/studio` | **desk** (UI copy); `/studio` stays as the route | studio, console, workspace |
| The list of notebooks | **shelf** | library, dashboard |
| A container of sources and work | **notebook** | course, project, desk |
| An uploaded/pasted/linked input | **source** | document, material, file, vault |
| Passage → footnote link | **citation** | reference, anchor |
| The model's reasoning stream | **thinking** | reasoning depth, telemetry |
| Generated study artifacts (quiz, exam, cards, guide…) | **work** (rail label: "Your work") | generations, aids, power-ups |
| A due-cards review across notebooks | **Today** | queue, review deck |
| Dark theme | **Lamplight** | dark mode, night |
| Light theme | **Daylight** | light mode, paper mode |

---

## 6 · Surfaces

### 6.1 Landing (`/`) — Persuade

The pre-landing onboarding gate, preloader, custom cursor, torch layer, Lenis
smooth scroll, and GSAP scroll choreography are removed. A student arriving
from a search result sees the product in the first viewport and can leave in
one click. The page is five sections and a footer, ~40% of today's DOM.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Comtus                                  Guide  Privacy   [Open the desk]│
│                                                                        │
│   Rough thought, polished.                                             │  Literata display,
│   Study from your own sources. Every answer                            │  left-aligned, 60ch
│   cites the page it came from.                                         │
│                                                                        │
│   [Open the desk]   Bring your own key or sign in with Claude/ChatGPT  │  one brass button,
│                                                                        │  one plain sentence
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │  live desk: a real notebook with 2 sample sources; the        │    │  the hero IS the
│   │  visitor can type one question and watch a cited answer       │    │  product (read-only
│   │  stream from a canned transcript (no key needed)              │    │  demo transcript)
│   └──────────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────┤
│  How a night at the desk goes                                          │  three prose steps
│  1 Add the chapter. 2 Ask, and read the margin. 3 Drill what you missed│  (numbered because
│                                                                        │  it is a sequence)
├──────────────────────────────────────────────────────────────────────┤
│  What the desk makes for you                                           │  one wide list, not
│  Quiz · Mock exam · Essay feedback · Flashcards (FSRS) · Study guide    │  a card grid; each
│  …each row: name, one sentence, a real 240px screenshot                │  row alternates side
├──────────────────────────────────────────────────────────────────────┤
│  Your sources stay on this device                                      │  plain paragraph +
│  IndexedDB, BYOK, no uploads. Link to /privacy.                        │  two facts, no badges
├──────────────────────────────────────────────────────────────────────┤
│  Questions students ask                                                │  existing FAQ, restyled
├──────────────────────────────────────────────────────────────────────┤
│  leather footer: Comtus · Guide · Privacy · Terms · Contact · Desktop  │
└──────────────────────────────────────────────────────────────────────┘
```

Rules for this surface: one orchestrated motion (the lamp warming up as the
demo answer streams); no per-section fade-ups; no numbers that are not measured;
no emoji; nav is three links and one button; the free-model catalogue moves to
`/guide/models` as a Read-mode page.

### 6.2 Shelf (`/studio`) — Operate

```
┌──────────────────────────────────────────────────────────────────────┐
│ Comtus     Your notebooks                       Today (12)  ⚙  [New]   │  one header
├──────────────────────────────────────────────────────────────────────┤
│ Search notebooks                                     Recent ▾  ▦ ☰    │
│                                                                        │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                     │  notebook = a book
│ │ Pharmacology │ │ Med-Surg II  │ │ + New        │                     │  spine on the left
│ │ 4 sources    │ │ 2 sources    │ │   notebook   │                     │  (leather), title,
│ │ 9 due today  │ │ opened 2d ago│ │              │                     │  two facts max
│ └──────────────┘ └──────────────┘ └──────────────┘                     │
│                                                                        │
│ Today: 12 cards due across 2 notebooks · [Review now]                  │  the only brass CTA
└──────────────────────────────────────────────────────────────────────┘
```

Removed: console status bar, duplicated brand mark, duplicated create control,
"INFERENCE" readout, milestone counter in the header (moves into the desk's
session bar), BYOK badge (moves into Settings → Models).

### 6.3 Desk (`/studio/:id`) — Operate

```
┌──────────────────────────────────────────────────────────────────────┐
│ ‹ Shelf   Pharmacology II                 ● 25:00  Sonnet · high  ⚙   │  DeskHeader: back,
├────────────┬───────────────────────────────────────┬───────────────────┤  editable title, session
│ Sources    │ Chat                    New chat ▾    │ Your work          │  timer, model chip
│ [Add]      │                                       │ Today: 9 due       │  (opens Settings→Models),
│ ▸ Ch.4 pdf │  Q: Why does heparin…                 │ ┌────────────────┐ │  gear
│   12 pages │                                       │ │ Make…          │ │
│ ▸ Notes.md │  thinking ▸ (moon, collapsed)         │ │ Quiz  Exam     │ │  generators are a
│            │  Heparin potentiates antithrombin… [1]│ │ Cards Essay    │ │  2×3 grid of quiet
│            │  ─ citations ───────────────────────  │ │ Guide Slides   │ │  tiles, no "soon"
│            │  [1] Ch.4 · p.112                     │ └────────────────┘ │
│            │  [Save to note] [Copy]                │ Weak spots         │  derived from
│            │                                       │ Anticoagulants 41% │  attempts/ratings
│            │ ┌───────────────────────────────────┐ │ Renal dosing  55%  │
│            │ │ model ▾  all 2 sources ▾     high ▾│ │                    │
│            │ │ Ask, or say what to drill…         │ │ Saved work (4)     │
│            │ │ + Think Web             ↑           │ │ …                  │
│            │ └───────────────────────────────────┘ │                    │
│            │  the lamp: composer glow is the only  │                    │
│            │  ambient light in the desk            │                    │
└────────────┴───────────────────────────────────────┴───────────────────┘
```

Behavioral rules:

- Header holds at most five controls. Analytics and Share become items in the
  notebook menu (`⋯`) next to the title.
- The companion is off by default for new users and, when on, docks *inside*
  the Sources pane footer so it can never overlap work.
- Composer chips show only capabilities the active model has (`Think` hidden
  for models without reasoning; `Web` hidden when the relay is unavailable).
- Citations render as footnote numbers in mono; clicking one switches to
  `reading` layout and scrolls the source reader to the anchored page with a
  brass passage highlight that decays over `--dur-settle`.
- Empty chat teaches one thing: "Add a source, then ask. Every answer will
  cite the page it came from." with the starter prompts beneath.
- Skeletons, not spinners, for the shelf and source list.

### 6.4 Today (`/studio/today`) — Operate

A cross-notebook FSRS review: one card at a time, Literata on parchment, four
rating buttons (`Again · Hard · Good · Easy` → keyboard `1–4`), the projected
next interval shown quietly under each button, a progress line, and a summary
that names the notebooks and topics you struggled with. Cards can open their
source citation. No streaks; the summary says what to do tomorrow.

### 6.5 Settings

Two panels remain (`Settings`, `Models`) but as a **right-side sheet**, not a
centered modal, so the desk stays visible while keys are tested. Sections:
Appearance (Daylight / Lamplight / System; Companion on/off; Pixel accent
chrome on/off; Motion full/minimal/none), Typography (reading size only —
presets are retired), Models (provider, key vault, sign-ins, model, effort),
Data (export, import, clear). Plan tier and passes live under Models.

### 6.6 Motion

One vocabulary, defined once in `tokens.css`:

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | chips, toggles |
| `--dur-med` | 200ms | pane reveals, popovers |
| `--dur-slow` | 320ms | sheet open, layout mode change |
| `--dur-settle` | 700ms | citation glow decay |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | every transition |
| `--ease-inout` | `cubic-bezier(0.65, 0, 0.35, 1)` | layout mode change |
| `--beat-lamp` | 2.6s | composer breath while streaming |

No bounce easings, no `transition: width/height` (use `grid-template-columns`
on the pane grid with `--ease-inout`, or `clip-path`), no page-load
choreography in the desk. Reduced motion keeps the three-tier doctrine already
in `index.css` (ambient loops stop; entrances become opacity; everything else
resolves in one frame).

### 6.7 Responsive

| Breakpoint | Shelf | Desk |
|---|---|---|
| `< 640` | single column list; New as a bottom action | one pane at a time with a bottom tab bar (Sources / Chat / Work); composer pinned above the bar with `env(safe-area-inset-bottom)` |
| `640–899` | 2-column grid | Chat + one side pane; the other slides over as a sheet |
| `900–1199` | 3-column grid | three panes, side panes collapsible |
| `≥ 1200` | 3–4 column | full desk with resizable panes (existing `usePaneResize`) |

`useBreakpoint()` subscribes to `matchMedia` change events; no handler reads
`matches` at call time.

### 6.8 Accessibility floor

Visible focus ring (`2px solid var(--brass)` + `2px` offset) on every
interactive element; `role="dialog"` + focus trap for the settings sheet and
generators (existing `Modal` behavior kept); `aria-live="polite"` on the
streaming answer container and the Save/Copy confirmations; every icon-only
button has `aria-label`; contrast ≥ 4.5:1 for body and placeholder text in both
themes (checked by a token test computing WCAG ratios); all interactions
keyboard-reachable including the pane resizers (already `role="separator"`).

---

## 7 · Product model — what "frontier study app" means here

The product's promise is *grounded, adaptive study from your own sources*. The
capabilities below are ordered by how much they change a student's week.

| # | Capability | Ship in this redesign | Notes |
|---|---|---|---|
| 1 | **Grounded chat with page-level citations** | keep, fix reader anchors | Existing BM25 + full-context. Add `page`/`offset` to `Chunk` so `[1]` opens page 112, not the top of the PDF. |
| 2 | **FSRS spaced repetition with a cross-notebook Today queue** | yes | `ts-fsrs` (MIT, 5.4.2). Replaces the SM-2-lite in `AidsFlow.tsx`. Cards keep provenance to the source passage. |
| 3 | **Attempt memory and weak-spot targeting** | yes | Persist every quiz/exam item outcome; derive per-topic accuracy; generators accept `topicFilter` and default to weak topics when asked for "the hardest part". |
| 4 | **Study sessions** | yes (minimal) | Start/stop with the header timer; a session records duration, notebook, cards reviewed, items attempted. Milestones derive from sessions. |
| 5 | **Capability-aware model chips** | yes | Show Think/Web only when supported; label the active provider honestly. |
| 6 | **Worked-solution grading (photo)** | keep | Existing `checkSolution`; ensure vision capability gating. |
| 7 | **Essay rubric feedback** | keep | Existing; move copy to voice rules. |
| 8 | **Study guide / brief / FAQ / timeline / slides** | keep | Consolidate into one `DocGenerator` with a kind switch; slides remain. |
| 9 | Audio overview | **cut from UI** | Return when TTS is implemented end-to-end. |
| 10 | Embedding retrieval / reranking | **out of scope** | Requires a second key or a large local model; contradicts BYOK-simplicity. Revisit after 1–4. |
| 11 | Cloud sync / accounts | **out of scope** | Local-first is a principle, not a gap. |

Learning-science rationale (kept short): retrieval practice and spacing are the
two interventions with the strongest evidence for durable learning; FSRS is the
current open scheduler with published parameters
(<https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm>);
error-driven targeting (attempts → weak topics → next drill) closes the loop
that NotebookLM-style tools leave open.

### 7.1 Data model additions (Dexie v3)

```ts
// src/lib/types.ts
export interface Chunk {              // existing + anchors
  id: string; sourceId: string; notebookId: string; idx: number;
  text: string; tokens: number;
  page?: number;                      // 1-based, PDFs/PPTX
  startChar: number; endChar: number; // offsets into Source.content
}

export interface Card {               // replaces CardProgress
  id: string;                         // `${generationId}:${cardId}`
  notebookId: string; generationId: string;
  front: string; back: string; topic?: string;
  sourceId?: string; startChar?: number; endChar?: number;
  // ts-fsrs Card fields
  due: number; stability: number; difficulty: number;
  elapsed_days: number; scheduled_days: number; reps: number; lapses: number;
  state: 0 | 1 | 2 | 3;               // New, Learning, Review, Relearning
  last_review?: number;
}

export interface ReviewLog {
  id: string; cardId: string; notebookId: string;
  rating: 1 | 2 | 3 | 4; state: 0 | 1 | 2 | 3;
  due: number; stability: number; difficulty: number;
  elapsed_days: number; last_elapsed_days: number; scheduled_days: number;
  review: number;                     // epoch ms
}

export interface Attempt {
  id: string; notebookId: string; generationId: string;
  kind: "quiz" | "exam"; itemId: string; topic: string;
  correct: boolean; credit: number;   // 0 | 0.5 | 1
  answeredAt: number; sessionId?: string;
}

export interface StudySession {
  id: string; notebookId?: string;
  startedAt: number; endedAt?: number;
  cardsReviewed: number; itemsAttempted: number;
}
```

Indexes: `cards: "id, notebookId, generationId, due, state"`,
`reviewLogs: "id, cardId, notebookId, review"`,
`attempts: "id, notebookId, generationId, topic, answeredAt"`,
`sessions: "id, notebookId, startedAt"`. The v3 upgrade converts each
`CardProgress` row into a `Card` by mapping `ease/intervalDays/dueAt/reps` onto
`difficulty/stability/due/reps` with `state = reps > 0 ? Review : New`.

---

## 8 · Quality gates the plan enforces

| Gate | Threshold | How |
|---|---|---|
| Types | `tsc --noEmit` 0 errors | `pnpm exec tsc --noEmit` |
| Lint | 0 errors, jsx-a11y on | `pnpm lint` |
| Unit tests | all pass, **< 120 s** cold | `pnpm test`; per-directory timing recorded in T-0.1 |
| Palette | no Tailwind stock colors; no hex outside `tokens.css` and SVG sprite files | `src/styles/palette.test.ts` extended |
| Type scale | 0 `text-[Npx]` outside `src/landing/` | new `src/styles/scale.test.ts` |
| Tells | 0 `uppercase` labels outside `<kbd>`; 0 ` · ` in TSX string literals; 0 `→` in button text; 0 `label-mono` | new `src/styles/tells.test.ts` |
| Anti-patterns | `pnpm dlx impeccable@3.6.1 detect --json src/` returns **0** warnings | recorded in `scripts/launch-check.sh` |
| Bundle | `/studio` initial chunk < 600 kB gzip; landing < 250 kB | `vite build` output |
| Contrast | every `--muted`/`--ink` on `--ground`/`--surface` pair ≥ 4.5:1 in both themes | `src/styles/contrast.test.ts` |
| Visual | before/after screenshots for landing, shelf, desk, Today, settings at 1440 and 390 in both themes | plan §Verification |

---

## 9 · Skills consulted

- `obra/superpowers` — `brainstorming`, `writing-plans`,
  `subagent-driven-development` (plan structure, task right-sizing, no
  placeholders, TDD steps). <https://github.com/obra/superpowers>
- `anthropics/skills` — `frontend-design` (subject-grounded direction, the
  generated-UI calibration list, two-pass plan → review → build).
  <https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md>
- `pbakaus/impeccable` — `SKILL.src.md` modes (Persuade / Operate / Read),
  `reference/craft-floor.md` (verify list and refusals), `reference/operate.md`
  (product UI rules), and the deterministic detector (`impeccable detect`),
  run against this repo for §1.2. <https://github.com/pbakaus/impeccable>
- Repo-local: `BRAND.md`, `.impeccable.md`, `docs/agents/*.md`, the existing
  console-deck spec/plan pair as the house format.
