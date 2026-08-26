# Comtus — Brand Kit

> The essential brand kit. Every design decision in the product defers to this file.
> Inspired by the *craft* of the Exorsus site (motion discipline, section rhythm,
> grain, reduced-motion care) — never its palette, type, or metaphor.

---

## 1 · Name & Story

**Comtus** — from Latin *comptus*: "adorned, polished, refined; carefully arranged."
Past participle of *comere*, "to care for, to arrange." Kin to *computus*, the medieval
scholarly discipline of careful reckoning.

**The story we tell:** study is a craft. Rough thought — highlights, half-questions,
messy notes — is worked and reworked until it shines. That work happens in one place:
the library at midnight, one lamp lit, everything quiet except the thinking.

- **Keystone tagline:** **Rough thought, polished.**
- **Supporting line:** Study in a warmer light.
- **Pronunciation:** KOM-tus

## 2 · Motif — The Lamp & The Margin

Two images carry the whole identity:

1. **The lamp** — light as understanding. The warm circle where thinking happens.
   Visually: soft radial glows, drifting dust motes in a light cone, brass rules
   that "ignite" on scroll, glows that bloom rather than snap.
2. **The margin** — the scholar's dialogue with the text. Visually: hairline rules,
   numbered mono section indices (`01 — THE METHOD`), underline strokes like pencil
   marks, citation chips like footnote markers.

## 3 · Palette — "Lamplight Study" + "Daylight Study"

Two themes share one semantic layer. Dark (Lamplight) is the default. Light (Daylight)
applies only to app surfaces (`/studio`, desk). The landing stays dark.

### Semantic tokens (app)

| Token | Dark (Lamplight) | Light (Daylight) | Role |
|---|---|---|---|
| `ground` | `#0B0F1A` | `#F5F1E8` | Page ground |
| `surface` | `#121828` | `#FCFAF4` | Raised surfaces, cards |
| `raised` | `#1A2136` | `#EAE4D6` | Hover / active surfaces |
| `ink` | `#F2EDE3` | `#1B2334` | Primary text |
| `muted` | `#8E96AB` | `#5A6274` | Muted text, labels at rest |
| `hairline` | `rgba(242,237,227,0.09)` | `rgba(27,35,52,0.12)` | Borders and dividers |
| `brass` | `#E3B04B` | `#A5731C` | Primary accent |
| `moon` | `#7FA8C9` | `#3D6E9E` | Secondary accent |
| `sage` | `#8FBF98` | `#4F8A5A` | Success / correct |
| `rust` | `#C96A5E` | `#B2554A` | Error / incorrect |

Landing keeps the literal names (`night`, `study`, `shelf`, `parchment`, `faded`) so the
marketing page never follows Daylight.

Elevation: `--shadow-card`, `--shadow-lift`, `--shadow-modal`. Motion: `--dur-fast 120ms`,
`--dur-med 220ms`, `--dur-slow 360ms`, `--dur-glow 480ms`, `--dur-settle 700ms`.
Glows become soft warm washes at lower opacity in Daylight.

- **Signature gradient:** `linear-gradient(92deg, var(--brassdeep), var(--brasspale))`.
- **Glows (dark):** warm `rgba(227,176,75,0.14)` and cool `rgba(42,54,84,0.35)`.
- **Thinking panel tint (app):** moon wash with a moon left-rule.

## 4 · Typography

All families are self-hosted via `@fontsource`. No Google Fonts CDN.

| Role | Family | Usage |
|---|---|---|
| Display (landing) | **Pixelify Sans Variable** | Every landing surface: hero, nav, body, captions, buttons, footer. Sized ≥12px labels, ≥14–16px body. Never Press Start 2P. |
| Display (Pixel desk) | **Pixelify Sans Variable** | Every studio/desk line when Pixel is on: titles, chat, notes, markdown, settings, composer, buttons. Sized ≥14px body, ≥12px labels. |
| Display (Scholar desk) | **Fraunces** (variable serif, optical size / `opsz` auto) | Scholar-mode notebook titles only. Weight 340–560. *Italics* for emphasized words. Tokens: `text-display`, `text-title`. |
| Body (studio) | **Pixelify Sans Variable** (Pixel, default) · **Inter** (Scholar) | Pixel: chat, notes, markdown, settings, composer. Scholar restores Inter. Tokens: `text-heading`, `text-body`. |
| Label (studio) | **Pixelify Sans Variable** (Pixel) · **JetBrains Mono** (Scholar) | Pixel restyles chrome labels to Pixelify at ≥12px. Scholar keeps JetBrains for code/IDs. Token: `text-label`. |

Landing scale: hero `clamp(2.8rem, 7.5vw, 6.8rem)` · section titles `clamp(2.1rem, 4.6vw, 3.8rem)`
· statement `clamp(2.4rem, 6vw, 5.2rem)` · body 16px. Pixelify via `@fontsource-variable/pixelify-sans`.

## 5 · Motion — "Light Behaves Like Light"

Same engineering discipline as Exorsus, different soul. Motion is warm, slow to start,
silent at the end. Nothing bounces except where a lamp would flicker.

- **House easings:** out `cubic-bezier(0.22, 1, 0.36, 1)` · in-out `cubic-bezier(0.76, 0, 0.24, 1)`
- **Stack:** GSAP 3 + ScrollTrigger + Lenis (npm, not CDN), custom cursor (brass dot +
  lagging ring), magnetic buttons, velocity-reactive marquee, film grain at 4–5% opacity.
- **Signature moves:** line-mask headline reveals · stepped pixel hops · brass ignite blooms ·
  arcade press on cards and CTAs · word-by-word scroll-scrubbed manifesto ·
  gradient rules that draw in (`scaleX`) · glows that bloom with scroll · pokeable hero lamp ·
  hero canvas of motes drifting through a lamp cone with a pointer-reactive constellation.
- **Reduced motion:** `prefers-reduced-motion` renders everything instantly — no parallax,
  no scrub, static canvas frame. Content is never hidden behind an animation.

### App surfaces (studio · desk)

The landing's cinematic toolkit stops at the studio door. App motion follows the same
soul with quieter means:

- **Split of duties** — continuous/micro-state motion is tokenized CSS (`.anim-*`,
  `.card-wake`, breathing loops, stepped lamp hops); enter/exit orchestration is `motion/react`
  (`AnimatePresence` + house springs). GSAP stays landing-only, never imported by
  studio or desk code. Pixel desk uses `steps()` for lamp and arcade press, not bounce easing.
- **House springs** — `SPRING` (380/34) for placed-feeling moves (bubbles, morphs),
  `SOFT` (240/26) for popover/toast travel; both live in `src/studio/fx.tsx` next to
  distance constants `RISE_1/2/3`, `DRIFT_X` (mirrors `--rise-*`, `--drift-x`;
  keyframes take numbers, never `var()` strings).
- **Stagger** — `--stagger-step` 30ms per item, capped at 10 items everywhere
  (`.cite-chip`, source rows, context menus).
- **Decision rule for enter vs exit** — conditional render inside the chat transcript,
  composer, or any overlay → `AnimatePresence`; persistent-region visibility toggles →
  keep-mounted class/attribute flips (`.collapse-grid`, `data-dropping`); content
  arriving into a region that is itself moving (pane widths, mobile tabs) → CSS
  entrance only, no exit.
- **Reduced motion, three tiers** — ambient loops stop and rest visibly (the streaming
  beacon becomes a static caret); entrances keep a plain opacity fade; everything else
  resolves in one frame. Springs collapse via `MotionPrefs` (`MotionConfig`). Animated
  numbers are display-only — raw values always feed ARIA.
- **Focus is sacred** — every keyboard-reachable control shows the brass focus ring;
  outlines may only be suppressed where a visible alternative exists (composer inset
  ring, `inputCls` border/shadow wake).

## 6 · Voice

A warm scholar, not a hype startup. Second person. Plain, precise words. No exclamation
marks in product UI. Never "revolutionary", "supercharge", "unleash".

- Buttons are verbs: "Open the studio", "Add sources", "Grade my essay".
- Empty states teach: "Every answer traces back to a source you added."
- Errors are honest and calm: "The lamp flickered — check your API key and try again."

## 7 · Product Principles

1. **Grounded or silent** — answers cite sources; no sources, no confident answers.
2. **Thinking is visible** — reasoning is a first-class UI surface, not a loading spinner.
3. **Local first** — notebooks, sources, and history live on the user's device (IndexedDB);
   the API key never leaves it.
4. **Craft is the feature** — the tool should feel like a well-bound book: quiet, precise,
   warm under the hand.

## 8 · Desk life — color, the lamp, milestones

Study sits for hours. The studio should feel lit, not grey: brass, moon, sage, and rust
carry tool kinds and states; dust motes and a warmer lamp wash keep the desk alive
without turning it into a game.

- **Pixel landing** (`/`) is always a lamp-arcade overlay: Pixelify on every font,
  16px brass grid, scanlines, stepped hops, arcade press, pokeable lamp, desk diorama.
  Scoped with `html[data-landing-pixel="on"]` in `src/landing/pixel-landing.css` so
  studio Scholar/Pixel is untouched. GSAP stays landing-only.
- **Pixel desk** (default) is the same overlay in the app: Pixelify on every desk
  line (chat, notes, markdown, settings, composer), 16px brass grid, faint scanlines,
  stepped CSS motion, arcade press on cards and chrome. **Scholar** in Settings
  restores Fraunces + Inter and the quieter radii. Toggle is studio-only
  (`html[data-pixel]` via DeskShell).
- **The lamp** (pixel companion, bottom-right by default) hops on a stepped beat, sparks when
  poked or celebrated, sleeps when the desk is idle about four minutes, and may
  chime once. Drag it anywhere; double-click returns it to the corner. Placement
  is stored on-device. Mute lives in Settings. Reduced-motion rests the loops.
- **Milestones** are study-craft marks derived from the on-device library
  ("The first page"), never XP. Existing work is seeded silently; only new marks toast.
- Copy stays the warm scholar: no exclamation marks, skippable delight.
