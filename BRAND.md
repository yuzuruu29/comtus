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
`--dur-med 220ms`. Glows become soft warm washes at lower opacity in Daylight.

- **Signature gradient:** `linear-gradient(92deg, var(--brassdeep), var(--brasspale))`.
- **Glows (dark):** warm `rgba(227,176,75,0.14)` and cool `rgba(42,54,84,0.35)`.
- **Thinking panel tint (app):** moon wash with a moon left-rule.

## 4 · Typography

All three families are self-hosted via `@fontsource` (Fraunces and Inter variable, JetBrains Mono static). No Google Fonts CDN.

| Role | Family | Usage |
|---|---|---|
| Display | **Fraunces** (variable serif, optical size / `opsz` auto) | Headlines, notebook titles, big numbers. Weight 340–560. *Italics* for emphasized words. Tokens: `text-display`, `text-title`. |
| Body | **Inter** | Paragraphs, UI text, chat. Tokens: `text-heading`, `text-body`. |
| Label | **JetBrains Mono** | Eyebrows (`.label-mono`), indices, chips, stats. Token: `text-label`. |

Landing scale: hero `clamp(2.8rem, 7.5vw, 6.8rem)` · section titles `clamp(2.1rem, 4.6vw, 3.8rem)`
· statement `clamp(2.4rem, 6vw, 5.2rem)` · body 16px.

## 5 · Motion — "Light Behaves Like Light"

Same engineering discipline as Exorsus, different soul. Motion is warm, slow to start,
silent at the end. Nothing bounces except where a lamp would flicker.

- **House easings:** out `cubic-bezier(0.22, 1, 0.36, 1)` · in-out `cubic-bezier(0.76, 0, 0.24, 1)`
- **Stack:** GSAP 3 + ScrollTrigger + Lenis (npm, not CDN), custom cursor (brass dot +
  lagging ring), magnetic buttons, velocity-reactive marquee, film grain at 4–5% opacity.
- **Signature moves:** line-mask headline reveals · word-by-word scroll-scrubbed manifesto ·
  gradient rules that draw in (`scaleX`) · glows that bloom with scroll · hero canvas of
  motes drifting through a lamp cone with a pointer-reactive constellation of idea-nodes.
- **Reduced motion:** `prefers-reduced-motion` renders everything instantly — no parallax,
  no scrub, static canvas frame. Content is never hidden behind an animation.

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
