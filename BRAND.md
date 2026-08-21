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

## 3 · Palette — "Lamplight Study"

Deep ink-blue ground, warm parchment text, one brass accent. Cool moon-slate as the
secondary voice. Nothing pure black, nothing pure white.

| Token | Hex | Role |
|---|---|---|
| `night` | `#0B0F1A` | Page ground |
| `study` | `#121828` | Raised surfaces, cards |
| `shelf` | `#1A2136` | Hover / active surfaces |
| `parchment` | `#F2EDE3` | Primary text |
| `faded` | `#8E96AB` | Muted text, labels at rest |
| `brass` | `#E3B04B` | Primary accent — actions, ignition, highlights |
| `moon` | `#7FA8C9` | Secondary accent — cool information, links, thinking |
| `sage` | `#8FBF98` | Success / correct |
| `rust` | `#C96A5E` | Error / incorrect (muted, never alarm-red) |
| `hairline` | `rgba(242,237,227,0.09)` | All borders and dividers |

- **Signature gradient:** `linear-gradient(92deg, #C99236, #F0CE8C)` — deep brass to
  pale gold. Used for emphasized words, rules that draw in, and primary buttons.
- **Glows:** warm `rgba(227,176,75,0.14)` and cool `rgba(42,54,84,0.35)` — layered,
  never alone. The hero is lit from above like a reading lamp.
- **Thinking panel tint (app):** `rgba(127,168,201,0.06)` with a moon left-rule —
  reasoning is moonlight; answers are parchment; actions are brass.

## 4 · Typography

All three families from Google Fonts — one CDN, self-hostable later.

| Role | Family | Usage |
|---|---|---|
| Display | **Fraunces** (variable serif, optical size) | Headlines, notebook titles, big numbers. Weight 340–560, line-height 0.98–1.1, tracking −0.01em. *Italics* for emphasized words. |
| Body | **Inter** | Paragraphs, UI text, chat. 15–16px, line-height 1.6. |
| Label | **JetBrains Mono** | Eyebrows, indices, chips, stats. 10–12px, uppercase, tracking 0.2–0.34em. |

Scale: hero `clamp(2.8rem, 7.5vw, 6.8rem)` · section titles `clamp(2.1rem, 4.6vw, 3.8rem)`
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
