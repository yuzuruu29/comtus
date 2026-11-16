# Comtus — Brand Kit

> The essential brand kit. Every design decision in the product defers to this file.
> A scholar's desk: warm paper, clear ink, restrained brass, and room to think.
> Landing and desk share the same visual language. The composer is the desk's lamp.
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

## 3 · Palette — Daylight & Lamplight

One master palette, defined once in `src/styles/tokens.css`. Hex literals are
legal there and nowhere else under `src/`. Everything else reads `var(--token)`
or derives with `color-mix()`. `src/styles/tokens.test.ts` and
`src/styles/contrast.test.ts` enforce both halves of that rule.

Daylight lives on `:root`; Lamplight overrides only what changes.

| Token | Daylight | Lamplight | Role |
|---|---|---|---|
| `--ground` | `#F5F1E8` | `#14100C` | page ground — aged paper / walnut desk |
| `--surface` | `#FCFAF4` | `#1D1712` | cards, panes, composer |
| `--raised` | `#EAE4D6` | `#261E18` | hover, active rows, chips |
| `--ink` | `#0B132B` | `#F2EDE3` | primary text |
| `--muted` | `#5A6274` | `#A59A8A` | secondary text, labels |
| `--hairline` | `rgba(27,35,52,.12)` | `rgba(242,237,227,.09)` | dividers |
| `--hairline-strong` | `rgba(27,35,52,.22)` | `rgba(242,237,227,.18)` | borders on controls |
| `--brass` | `#845C16` | `#E3B04B` | **the lamp** — action, selection, citation |
| `--brass-deep` | `#5B3F0F` | `#C99236` | pressed fill |
| `--brass-pale` | `#E3B04B` | `#F0CE8C` | glow only; decorative, carries no meaning |
| `--leather` | `#4A2E1B` | `#4A2E1B` | spines, deep shadow, text on a candle fill |
| `--sage` | `#3F6E48` | `#8FBF98` | correct, verified, due |
| `--rust` | `#A04D43` | `#DB7B6F` | incorrect, error |
| `--candle` | `#EF8328` | `#FF9E43` | milestone flare, due-today fill |
| `--moon` | `#6B6052` | `#C4B8A5` | reasoning — the thinking drawer, effort chip |

Rules the values depend on:

1. **Brass is the only accent for action.** Sage, rust and candle carry *state*.
   Moon carries *reasoning* and nothing else.
2. **Text on a `--brass` or `--brass-deep` fill is always `--ground`**, in both
   themes. `--brass-deep` is the pressed fill, never a text colour. Text on a
   `--candle` fill is `--leather`.
3. `--brass-pale` is decorative glow only: never state, never an active rim,
   never under text. Active rims use `--brass`.
4. `--candle` is a fill only, never a text or icon colour. `--sage`, `--rust`,
   `--moon` and `--brass` are sized to work as text and icons.
5. Elevation is declared once: paper cards take `--elev-card` (shadow with an
   offset, thrown down-right because the desk light comes from the upper left),
   controls take a 1px hairline. Never both on one element.

### Texture & Dither Backdrops (CSS-Only)

The material layer lives in `src/styles/paper.css`. It reads tokens, carries no
hex, and never animates — paper does not move.

- `.bg-paper-parchment`: two-layer paper. A fine isotropic tooth over a slow
  anisotropic mottle, multiplied on Daylight and screened on Lamplight so one
  asset serves both themes. Use on page and pane grounds.
- **Not built**, and deliberately so — an unused class is a promise the next
  person has to keep. Build each when a surface calls for it:
  `.bg-dither-sepia-fine` / `.bg-dither-sepia-coarse` (they belong to the pixel
  illustration layer, Compad, not to document surfaces — a checkerboard behind
  reading copy costs legibility for decoration) and `.bg-wood-grain` (no
  surface has needed it). `.bg-paper-surface` was cut: the card already spends
  its `::before` on the book spine, and two backdrops on one pseudo-element
  collide.

### Pixel Artwork

The 16-bit illustration layer — Compad, the sprites in
`src/components/pixel/` — is the one place raw hex is allowed outside
`tokens.css`, because for a sprite the colour *is* the asset. It is gated to
that role by an explicit allow-list in `src/styles/palette.test.ts`.

---

## 4 · Typography

All families are self-hosted via `@fontsource`. No Google Fonts CDN.

The pairing is called Bookbinder (2026-11-16).
Fraunces Variable (`--font-display`, the `font-display` utility) carries headings,
titles and display figures. It ships with every axis (`full.css`, `full-italic.css`):
optical size, weight, SOFT and WONK. `index.css` sets SOFT 100 at the root, keeps
WONK off in roman and turns it on for `em`/`i`, so italics get the drawn forms.
Big display lines are light (300–380) and tight (about −0.045em at hero size);
small headings sit near 400–500.
Literata Variable (`--font-read`) carries long reading: answers, sources, passages
and quotes. It keeps its optical-size axis, so a 17px answer gets the text cut.
Bricolage Grotesque Variable (`--font-ui`) carries navigation, forms, actions, and interface copy.
JetBrains Mono is reserved for figures, keys, ids, timers and code. Pixelify is an optional accent.
The landing uses the same families and tokens as the desk. Reading size adjusts source text
and answers while interface controls keep their size. Never set a whole workspace to the
display family or use uppercase mono as the default form voice.

The interface ladder, smallest first: `text-label` 11px, `text-small` 13px,
`text-body` 14px, `text-lead` 16px, `text-heading` 16.8px, `text-title` 20px,
then `text-display`. Every desk size is one of these; `src/styles/scale.test.ts`
holds arbitrary pixel sizes outside the landing at zero.

Labels are sentence case in the UI face. Page kickers are brass, semibold, with a
short brass rule before them. Numbered steps use large italic Fraunces figures. A badge is `text-label font-semibold`
on its tone; a section label inside a card ("Why", "The grader's reasoning")
is `text-small font-semibold`. Uppercase survives only where the thing itself
is capitals, such as a transfer code. `src/styles/tells.test.ts` holds the count.

Answers are typeset like a book. A citation is a brass superscript figure in the
UI face that hugs the word it cites; marks written side by side share one
superscript ("1,2"). The brackets stay in the text for copying and for screen
readers but are hidden from sight. Tables are booktabs: a heavier rule above
and below, hairlines between rows, no vertical rules and no caps headers.

Icons are one family (Phosphor) on one scale: `--icon-xs` 12px through `--icon-3xl`
32px, exported as `ICON` from `src/ui/iconScale.ts`. The smallest step is for a
micro-badge only; a functional icon starts at 14px, and a button icon at 16px.
The pixel sprites in `src/components/pixel/` are artwork, not interface icons, and
keep their own sizes.

Landing scale: hero `clamp(2.8rem, 7.5vw, 6.8rem)` · section titles `clamp(2.1rem, 4.6vw, 3.8rem)` · statement `clamp(2.4rem, 6vw, 5.2rem)` · body 16px.
These live as `--text-landing-hero` / `--text-landing-section` / `--text-landing-statement` in
`src/index.css`. Use the token; do not hand-roll another `clamp()`.

---

## 5 · Motion & Tactile Physics — "Ink Bleeds Into Paper & Typeset Presses In"

Movement in Comtus is physical, warm, and intentional. Interactions follow the physics of a hand-bound book, rubber-stamp printing, and organic pen craft.

- **Rubber-Stamp Ink-Press Interaction (`.btn`, `.icon-btn`)**:
  - Rest: 1px top highlight, 2px solid bottom shadow in warm sepia (`--leather` at 65%).
  - Hover: −1px elevation, `--raised` background, warmed brass border.
  - Active Press: +1px physical depression, 0px bottom shadow, inset depth shadow into parchment.
  - The press reads through the shadow, not through the label. Text never changes colour on press.
  - `.card-book-press` (in `src/styles/paper.css`) is the same physics for cards; the button kit rhymes with it.
- **Paper-Curl Card Lift (`.card-paper-curl` / `.card-book-press`)** — `src/styles/paper.css`:
  - A quiet hairline frame, a warm top highlight catching the lamp, a subtle
    asymmetric bottom-right shadow, and a −1.5px physical lift on hover
    simulating paper peeling off the desk.
  - The frame is neutral (`--hairline-strong`), never brass-tinted. A row of
    brass-framed cards reads as decoration rather than as a library.
  - The shadow is thrown down and to the right because desk light comes from the upper left. Keep it asymmetric.
  - `.card-book-press` adds the press: +1px depression and an inset depth shadow.
- **Brass Bookmark (`.rule-bookmark`)** — `src/styles/paper.css`:
  - A 2px brass stroke on a row's leading edge, absent at rest and drawn top-down on hover or focus. It marks your place in a list the way a ribbon marks a page, and it is the reason study-tool rows need no coloured icon tiles.
- **Organic & Stepped Animations** — the vocabulary that actually ships:
  - `@keyframes breathe`: ambient pulse, the lamp at rest and the globe while a web search runs.
  - `@keyframes think-shimmer`: moon light passing over "Thinking…" while the model reasons.
  - `@keyframes pixel-flicker` / `torch-flicker`: warm filament micro-flicker for the pixel chrome.
  - `@keyframes citation-spotlight` / `cite-bloom`: a citation settling onto its passage, decaying over `--dur-settle`.
  - `@keyframes rise-in` / `fade-in` / `pop-in`: entrances. A short rise with a fade, never a scale — a panel that grows from 96% is a generated-UI tell.
  - `@keyframes ink-in`: while an answer streams, each block the model starts settles in with a fade and a 4px rise (`.md-live`, the streaming slot only, so a finished answer never replays). Minimal fades it in place; None shows it at once.
  - Keyframes never overshoot, the same rule the springs follow: `chip-pop` settles at its resting size without passing it.
- **Glass for floating layers only (`.glass`, `src/index.css`)**: frosted paper
  for the layers that float over the desk: Compad's panel and speech, the focus
  timer, the milestone toast. Panes, cards and dialogs stay opaque paper. Glass
  falls back to `--surface` without `backdrop-filter` and under
  `prefers-reduced-transparency`. Neumorphism is out: it fails contrast and
  reads as plastic, not paper.

### The lamp — light as a material

The desk lamp sits at the upper left; light is what moves (`src/ui/LampSwitch.tsx`,
`src/studio/lamplight.css`).

- **The lamp switch** is the theme control on the landing nav, the shelf and the
  desk header. Daylight with the lamp off, Lamplight with it on. Going to
  Daylight, the new page spreads out of the lamp in a circle; going to
  Lamplight, the old page gathers back into it (a view transition, 700ms). At
  Minimal the browser cross-fades; at None, and without view transitions, the
  theme changes in one frame. Hovering tilts the shade a few degrees.
- **The lit sheet.** The sheet you work on (the chat page, the practice sheet)
  carries a pool of `--brass-pale` light from its upper-left corner. It comes up
  when the sheet arrives, and the lamp is turned up while you write or an
  answer is written. It never pulses on its own: light changes with what you do.
  The landing hero has the same pool, brighter while you reach for "Open the desk".
- **Loose sheets (`.sheet-loose`, `src/ui/ui.css`).** Paper you can pick up lies
  at a small angle (`--tilt`, `--drop`) and squares up and lifts under the pointer
  or focus. Daylight shows it with the thrown shadow, Lamplight with a hairline
  that warms to brass. Used for the fresh page's three ways in, the model
  access notes and the install card. Reduced motion lays them flat.
- **Changing mode lays a different sheet down**: the mode switch's raised tab
  slides to the mode you pick, and the new view settles in with a short rise.
- **Dropping a file** raises a dashed brass sheet over the desk, and the empty
  source stack fans out to show where the reading will land.

### Study feedback — marked like paper

A tutor marks paper; Comtus does the same (`src/studio/generators/study-feedback.css`).

- A right answer gets a drawn check (`InkMark`, `src/ui/InkMark.tsx`) and a sage
  ribbon down the option's leading edge. A miss gets a drawn cross and a rust
  ribbon. Neither shakes, pops or scales.
- A finished quiz shows its score inside a ring drawn to the score, sage for a
  strong pass, brass in the middle, rust when low. A strong pass gets a brass seal.
- Every mark is complete at rest. Only the Full budget draws it in.

### Motion Budgets — Full, Minimal, None

The student picks a budget in Settings. It is a real setting, not a label.

| Budget | Ambient loops | Entrances | Direct feedback |
|---|---|---|---|
| **Full** | run | rise and fade | kept |
| **Minimal** | rest in their calm state | fade in place, no travel | kept |
| **None** | rest | none | instant |

A press still reads as a press at Minimal: removing feedback makes the desk
feel broken, and only decoration is worth removing. At None every state change
lands in one frame, and the change still shows through colour, border and
position. The budget lives on the document root as `html[data-motion]`, and the
OS "reduce motion" preference collapses the budget to None.

Informational loops — the button spinner, the skeleton shimmer, the toast
fuse, progress bars — keep running at every budget. They carry information,
not decoration.

### Reduced-Motion Standards (Three Tiers)

The OS preference is the backstop under the budget above.

1. **Tier 1 (Ambient loops)**: Ambient loops (`breathe`, `send-halo`,
   `bar-sheen`, the dust motes, the thinking shimmer, the waiting dots, the
   answer's ink caret) stop immediately and rest visibly in their calm state.
   While an answer streams, one of them runs at a time: the shimmer while the
   model reasons, the dots before anything arrives, the caret while it writes.
2. **Tier 2 (Entrances & Shifts)**: Entrances keep a quiet opacity fade without
   translation, scale, or parallax. Ink-press and paper-curl transitions collapse
   to zero delay.
3. **Tier 3 (Backstop)**: Any missed continuous animation resolves in a single
   frame. State changes remain visible via instantaneous color and border
   adjustments.

### Landing scroll motion

The public pages animate with native scroll timelines (`animation-timeline`). A
visitor can scrub every reveal, and a heading can never be left half-written:
its italic words follow the heading's own view timeline, so they finish once
the heading is fully on screen. The rules this depends on live in
`src/styles/landing-motion.test.ts`.

On the home page at the Full budget, and only with a mouse or trackpad, Lenis
weights the wheel (`src/landing/useSmoothScroll.ts`). It moves the real scroll
position, so the timelines still drive every scene; it never animates anything
itself. Touch screens keep their own scrolling.

- The headline is typeset in. Each line rises into its own window, then a pen
  stroke is drawn under the phrase the sentence leans on.
- Rows, headings and notes marked `data-landing-reveal` rise and fade as they
  are read. A list staggers by itself, because each row has its own timeline,
  and the hairline under it is drawn by the same progress.
- A brass ribbon along the foot of the navigation bar shows how far down the
  page the reader is. The link for the section being read is underlined, and
  the bar settles into frosted paper over the first 140px.
- Scenes, one idea each: the hero drifts up and away as you leave it; the desk
  preview lays down onto the page; two rows of exam subjects slide past each
  other; in the method, a brass thread runs down the steps, each numeral fills
  with ink, and each step's paper artifact (source chips, a cited passage, a
  score card) arrives as you read it; the field guide card is dealt off a
  stack; the page ends at night, in a Lamplight band where a lamp comes up.
- With the motion budget at Minimal every entrance fades in place and nothing
  is drawn. At None, and under the operating system's reduced-motion setting,
  the page is the finished static page from the first frame.

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

- Buttons are verbs: "Open the desk", "Add sources", "Grade my essay".
- Empty states teach: "Add a source, then ask a question about it."
- Errors are honest and calm: "The ink ran dry — check your API key and try again."

---

## 7 · Product Principles

1. **Keep evidence in reach** — make sources and citations easy to inspect. Encourage checking important answers; never promise that a model cannot make mistakes.
2. **Thinking is visible** — reasoning is a first-class UI surface, not a loading spinner.
3. **Local first** — notebooks, sources, and history live on the user's device (IndexedDB). AI requests send relevant material and authentication to the chosen provider, directly or through the configured relay.
4. **Craft is the feature** — the tool should feel like a well-bound book: quiet, precise, warm under the hand.

---

## 8 · Desk Life & Landing Specifications

- **Landing page**: Lead with the reading-to-recall journey and put the interactive
  sample notebook in the opening composition. Use numbered chapters, ruled margins,
  and a working recall card. Clearly label sample content, citations, and practice feedback.
  Explain local storage and provider access accurately. Setup is optional.
- **Desk**: The shelf is a numbered catalogue with a real recent-work entry.
  One notebook header leads into numbered Sources, Chat, and Study tools panes.
  Keep source search separate from inclusion; welcome copy reflects available sources.
  Mobile uses one pane at a time with persistent tabs. Keep primary practice tools
  visible, saved work above optional exam setup, and additional formats in a native disclosure.
  Preserve saved-work Undo and keyboard pane resizing.
- **Shared controls**: Reuse `src/ui`, native labels, visible focus, and generous touch
  targets. Avoid duplicate controls, inactive feature teasers, and decorative telemetry.
- **Companion**: Compad is a sage notebook character with cream page edges, a brass
  bookmark, and an ink face. Optional in active notebook workspaces, including mobile
  Sources and the desk. It rests in a lane the workspace reserves for it, clear of
  the conversation and the composer; on a phone the lane is a strip above the pane
  tabs. Then preserve the user's chosen placement and size within the viewport.
  Offer direct dragging, resizing, keyboard controls, and a position reset. Its
  compact chat shares the notebook conversation, draft, model, and sources. Keep the
  library free of the companion.
- **Compad reactions**: Compad answers what the student does, not a timer. It
  lifts under the pointer, tilts when dragged, and reacts to study cues sent with
  `cueCompad()` (`src/lib/activity.ts`): a right or missed answer, a card flipped
  or recalled, a finished deck or quiz, a focus session starting or ending. Lines
  are short and calm and never scold a miss. While a dialog is open and Compad is
  clear of it, Compad shows above the dim but takes no clicks.
- **Focus timer**: A pomodoro in the notebook header (`src/studio/FocusTimer.tsx`,
  logic in `src/lib/pomodoro.ts`). It runs on a deadline, so a reload or a sleeping
  tab keeps true time. Each phase waits for the student to start it. Four kept
  sessions earn a long break. Kept sessions feed milestones; a skipped one does not.
- **Milestones**: Marks of study craft (a first recall, a kept session, a full
  round), never streaks, XP or guilt.
- **Themes and motion**: Preserve Daylight, dark Lamplight, reading size, and reduced
  motion. Motion helps track a change and always leaves content immediately usable.
