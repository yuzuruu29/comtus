# Comtus — Brand Kit

> The essential brand kit. Every design decision in the product defers to this file.
> A scholar's desk: warm paper, clear ink, restrained brass, and room to think.
> Landing and Studio share the same visual language. The composer is the desk's lamp.
> The optional pixel companion starts clear of the work. Users control its placement and size.
>
> Current direction: `docs/superpowers/specs/2026-09-04-frontier-study-desk-design.md`.
> Live color values and contrast contracts belong to `src/styles/tokens.css`.

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

The illustration palette above describes pixel assets. Product surfaces use the
theme-aware `ground`, `surface`, `raised`, `ink`, `muted`, `hairline`, `brass`,
`moon`, `sage`, and `rust` tokens from `src/styles/tokens.css`.
Use `brass` for readable accent text. `brass-pale` is decorative light only.
Primary buttons use `ground` text on `brass`. Avoid new local palette overrides.

### Texture & Dither Backdrops (CSS-Only)

- `.bg-paper-parchment`: SVG data-URI fiber and grain texture on aged parchment.
- `.bg-dither-sepia-fine`: 2x2 fine checkerboard pixel dither pattern in warm sepia.
- `.bg-dither-sepia-coarse`: 4x4 coarse checkerboard pixel dither pattern in warm sepia.
- `.bg-wood-grain`: 16-bit wood grain pattern blending `--px-leather` and paper surface.

---

## 4 · Typography

All families are self-hosted via `@fontsource`. No Google Fonts CDN.

Literata Variable (`--font-read`) carries long reading and editorial headings.
Instrument Sans Variable (`--font-ui`) carries navigation, forms, actions, and interface copy.
JetBrains Mono is reserved for measurements and code. Pixelify is an optional accent.
The landing uses the same families and tokens as Studio. Reading size adjusts source text
and answers while interface controls keep their size. Never set a whole workspace to the
display family or use uppercase mono as the default form voice.

Landing scale: hero `clamp(2.8rem, 7.5vw, 6.8rem)` · section titles `clamp(2.1rem, 4.6vw, 3.8rem)` · statement `clamp(2.4rem, 6vw, 5.2rem)` · body 16px.
These live as `--text-landing-hero` / `--text-landing-section` / `--text-landing-statement` in
`src/index.css`. Use the token; do not hand-roll another `clamp()`.

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

- **Landing page**: Immediate access, an editorial thesis, and an interactive sample
  notebook. Clearly label sample content. Show source citations and practice feedback.
  Explain local storage and provider access accurately. Setup is optional.
- **Studio**: A readable notebook library, one workspace header, and sources, chat,
  and study tools in clear panes. Mobile uses one pane at a time with persistent tabs.
  Keep primary practice tools visible and additional formats in a native disclosure.
  Preserve saved-work Undo and keyboard pane resizing.
- **Shared controls**: Reuse `src/ui`, native labels, visible focus, and generous touch
  targets. Avoid duplicate controls, inactive feature teasers, and decorative telemetry.
- **Companion**: Compad is a sage notebook character with cream page edges, a brass
  bookmark, and an ink face. Optional in active notebook workspaces, including mobile
  Sources and Studio. Start clear of the controls, then preserve the user's chosen
  placement and size within the viewport. Offer direct dragging, resizing, keyboard
  controls, and a position reset. Its compact chat shares the notebook conversation,
  draft, model, and sources. Keep the library free of the companion.
- **Themes and motion**: Preserve Daylight, dark Lamplight, reading size, and reduced
  motion. Motion helps track a change and always leaves content immediately usable.
