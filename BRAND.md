# Comtus — Brand Kit

> The essential brand kit. Every design decision in the product defers to this file.
> 16-bit Cozy Pixel Bookshop aesthetic with scholarly craft, aged parchment paper, warm brass accents, rubber-stamp ink-press physics, and organic paper motion.

---

## 1 · Name & Story

**Comtus** — from Latin *comptus*: "adorned, polished, refined; carefully arranged."
Past participle of *comere*, "to care for, to arrange." Kin to *computus*, the medieval
scholarly discipline of careful reckoning.

**The story we tell:** study is a craft. Rough thought — highlights, half-questions,
messy notes — is worked and reworked until it shines. That work happens in one place:
the scholar's desk on aged parchment, ink drying into paper fibers, everything quiet except the thinking.

- **Keystone tagline:** **Rough thought, polished.**
- **Supporting line:** Study in a warmer light.
- **Pronunciation:** KOM-tus

---

## 2 · Motif — The Parchment, The Margin & The Shelf

Three images carry the whole identity:

1. **The parchment & ink** — light as understanding. The warm aged paper surface where thinking happens.
   Visually: subtle fibrous grain, warm sepia gridlines, organic ink-bleed reveals,
   quill-stroke underlines, and rubber-stamp ink-press depressions.
2. **The margin** — the scholar's dialogue with the text. Visually: thin sepia hairline rules,
   numbered mono section indices (`01 — THE METHOD`), pencil-stroke dividers, citation chips like footnote markers.
3. **The shelf & bindings** — tactile 16-bit warmth. Visually: aged parchment, rich leather-brown
   bindings (`#4A2E1B`), warm wood trim, fine sepia dither patterns, and paper-curl elevated cards.

---

## 3 · Palette — 16-Color Cozy Pixel Bookshop Master Palette

The master palette is a curated 16-color system calibrated for high readability on warm paper, tactile bookshop depth, and seamless dark Lamplight compatibility.

### Master Palette (16 Colors)

| Token | Hex Code | Role & Usage |
|---|---|---|
| `--px-paper-ground` | `#F5F1E8` | Primary aged parchment ground (Daylight default) |
| `--px-paper-surface`| `#FCFAF4` | Raised parchment card surface, modal canvas |
| `--px-paper-raised` | `#EAE4D6` | Hover states, active parchment tiles |
| `--px-paper-border` | `#D3C9B4` | Warm parchment bevel border, subtle dividers |
| `--px-paper-ink`    | `#1B2334` | High-contrast scholar ink text |
| `--px-paper-muted`  | `#5A6274` | Muted labels, secondary captions, metadata |
| `--px-paper-sepia`  | `#5C3D1E` | Deep sepia accent, rubber-stamp shadows |
| `--px-leather`      | `#4A2E1B` | Book-spine brown, leather binding trim |
| `--px-brass`        | `#A5731C` | Warm brass accent (calibrated for paper) |
| `--px-brass-light`  | `#E3B04B` | Golden highlight, active badge rim |
| `--px-void`         | `#080B12` | Deepest shadow (Lamplight dark ground) |
| `--px-surface-dark` | `#171F32` | Raised dark surface (Lamplight cards) |
| `--px-moon`         | `#3D6E9E` | Scholar blue secondary accent |
| `--px-sage`         | `#4F8A5A` | Success indicators, verified marks |
| `--px-rust`         | `#B2554A` | Error, warnings, critical alerts |
| `--px-candle`       | `#D97724` | Amber hearth spark, milestone flares |

### App Semantic Layer

| Token | Daylight Paper (Default) | Lamplight Study (Dark Mode) | Role |
|---|---|---|---|
| `ground` | `#F5F1E8` (`--px-paper-ground`) | `#0F1420` (`--px-void`) | Page ground |
| `surface` | `#FCFAF4` (`--px-paper-surface`)| `#171F32` (`--px-surface-dark`) | Raised surfaces, cards |
| `raised` | `#EAE4D6` (`--px-paper-raised`) | `#222C44` | Hover / active surfaces |
| `ink` | `#1B2334` (`--px-paper-ink`) | `#F5F0E6` | Primary high-contrast text |
| `muted` | `#5A6274` (`--px-paper-muted`) | `#9099B0` | Muted text, labels at rest |
| `hairline` | `rgba(92,61,30,0.14)` | `rgba(245,240,230,0.09)` | Borders and dividers |
| `brass` | `#A5731C` (`--px-brass`) | `#E3B04B` | Primary accent |
| `moon` | `#3D6E9E` (`--px-moon`) | `#6C98C2` | Secondary accent |
| `sage` | `#4F8A5A` (`--px-sage`) | `#78B084` | Success / correct |
| `rust` | `#B2554A` (`--px-rust`) | `#C85848` | Error / incorrect |

### Texture & Dither Backdrops (CSS-Only)

- `.bg-paper-parchment`: SVG data-URI fiber and grain texture on aged parchment.
- `.bg-dither-sepia-fine`: 2x2 fine checkerboard pixel dither pattern in warm sepia.
- `.bg-dither-sepia-coarse`: 4x4 coarse checkerboard pixel dither pattern in warm sepia.
- `.bg-wood-grain`: 16-bit wood grain pattern blending `--px-leather` and paper surface.

---

## 4 · Typography

All families are self-hosted via `@fontsource`. No Google Fonts CDN.

| Role | Family | Usage |
|---|---|---|
| Display (landing) | **Pixelify Sans Variable** | Every landing surface: hero, nav, body, captions, buttons, footer. Sized ≥12px labels, ≥14–16px body. Never Press Start 2P. |
| Display (Pixel desk) | **Pixelify Sans Variable** | Every studio/desk line when Pixel is on: titles, chat, notes, markdown, settings, composer, buttons. Sized ≥14px body, ≥12px labels. |
| Display (Scholar desk) | **Fraunces** (variable serif, optical size / `opsz` auto) | Scholar-mode notebook titles only. Weight 340–560. *Italics* for emphasized words. Tokens: `text-display`, `text-title`. |
| Body (studio) | **Pixelify Sans Variable** (Pixel, default) · **Inter** (Scholar) | Pixel: chat, notes, markdown, settings, composer. Scholar restores Inter. Tokens: `text-heading`, `text-body`. |
| Label (studio) | **Pixelify Sans Variable** (Pixel) · **JetBrains Mono** (Scholar) | Pixel restyles chrome labels to Pixelify at ≥12px. Scholar keeps JetBrains for code/IDs. Token: `text-label`. |

Landing scale: hero `clamp(2.8rem, 7.5vw, 6.8rem)` · section titles `clamp(2.1rem, 4.6vw, 3.8rem)` · statement `clamp(2.4rem, 6vw, 5.2rem)` · body 16px.

---

## 5 · Motion & Tactile Physics — "Ink Bleeds Into Paper & Typeset Presses In"

Movement in Comtus is physical, warm, and intentional. Interactions follow the physics of a hand-bound book, rubber-stamp printing, and organic pen craft.

- **Rubber-Stamp Ink-Press Interaction (`.btn-ink-press`)**:
  - Rest: 1px top highlight, 2px solid bottom shadow in warm sepia (`--px-paper-sepia` at 65%).
  - Hover: −1px elevation, `--px-paper-raised` background, warmed brass border.
  - Active Press: +1px physical depression, 0px bottom shadow, inset depth shadow into parchment.
- **Paper-Curl Card Lift (`.card-paper-curl` / `.card-book-press`)**:
  - Warm parchment bevel borders, subtle asymmetric bottom-right shadow, and −1.5px physical lift on hover simulating paper peeling off the desk.
- **Organic & Stepped Animations**:
  - `@keyframes ink-bleed`: smooth opacity and subtle blur expansion simulating ink soaking into parchment fibers.
  - `@keyframes quill-draw`: smooth SVG path dash-offset animation simulating pen-nib line drawing.
  - `@keyframes px-breathe`: 4-step ambient pulse for hearth and bookshop calm.
  - `@keyframes px-flicker`: 6-step warm candle/lamp filament micro-flicker.

### Reduced-Motion Standards (Three Tiers)

1. **Tier 1 (Ambient loops)**: Ambient loops (`.anim-px-breathe`, `.anim-px-flicker`, grain) stop immediately and rest visibly in their calm state.
2. **Tier 2 (Entrances & Shifts)**: Entrances keep a quiet opacity fade without translation, scale, or parallax. Ink-press and paper-curl transitions collapse to zero delay.
3. **Tier 3 (Backstop)**: Any missed continuous animation resolves in a single frame. State changes remain visible via instantaneous color and border adjustments.

### Forbidden Motion (never ship)

- **Wand-cast / wand mode** — no second cursor tool, no restoration spell.
- **Burnable type** — no charred-ash text states, no ignite-to-ash keyframes.
- **Combo streaks / FIRE states** — no `xN Combo` badges, no streak flames.
- **Confetti, spark showers, spark bursts on click** — buttons press; they do not erupt.
- **Screen shake** — the desk never shakes, at any intensity.
- **CRT overlays / obvious scanlines** — paper fiber and fine dither are the textures.

---

## 6 · Voice

A warm scholar, not a hype startup. Second person. Plain, precise words. No exclamation marks in product UI. Never "revolutionary", "supercharge", "unleash".

- Buttons are verbs: "Open the studio", "Add sources", "Grade my essay".
- Empty states teach: "Every answer traces back to a source you added."
- Errors are honest and calm: "The ink ran dry — check your API key and try again."

---

## 7 · Product Principles

1. **Grounded or silent** — answers cite sources; no sources, no confident answers.
2. **Thinking is visible** — reasoning is a first-class UI surface, not a loading spinner.
3. **Local first** — notebooks, sources, and history live on the user's device (IndexedDB); the API key never leaves it.
4. **Craft is the feature** — the tool should feel like a well-bound book: quiet, precise, warm under the hand.

---

## 8 · Desk Life & Landing Specifications

- **Landing Page**:
  - Always rendered on Daylight Paper ground (`#F5F1E8`) with subtle paper fiber texture.
  - Floating parchment navigation bar with paper-curl shadow.
  - Ink-nib custom cursor without bright glow trails.
  - Thin sepia hairline section dividers (pencil margin rules).
  - Leather-bound footer with `#4A2E1B` top binding border.
  - Lamp companion is quiet and rests in the Studio only.
- **Studio & Desk**:
  - Defaults to Daylight Paper workspace following OS preference.
  - Full dark Lamplight mode toggle preserved in Settings.
  - Interactive companion lamp rests in bottom-right corner with position persistence (`comtus-lamp-pos`).
  - Study-craft milestones celebrate real progress without arcade gamification.
