# Chat & Composer — Console Deck redesign

Date: 2026-08-24
Status: approved by user (chosen from visual options)
Mockups: `design-mockups/composer-chat-options.html` (Option B base), captures in `design-mockups/*.png`

## Decision

Rework the studio chat pane around **Option B — Console Deck**, with two amendments the
user requested on top:

1. **A's streaming phase pill** — the "reading → thinking → answering" pill docked to the
   composer shell's top edge.
2. **Much clearer Save-to-note / Copy** — always-visible, labeled action buttons with
   explicit success feedback on every completed answer (not hover-only gutter icons).

The lamp-lit identity is kept: `.composer-shell` surface, BorderBeam on
focus/streaming, Spotlight, composer ambience pool, breathing send halo, send/stop morph.

## Composer anatomy (top to bottom, all inside the shell)

```
┌─ .composer-shell ──────────────────────────────────────────────┐
│ ⌾ phase pill (streaming only, docked to top edge)              │
│ [context strip]  (model chip ▾) (focus: N of M sources ▾)  ··  │
│ ───────────────────────────── hairline ──────────────────────  │
│ [textarea — auto-grow 36..160px]                               │
│ [action rail]  (+) (Quiz me)(Flashcards)(Outline)  ··  ~N tk ⎋ │
└────────────────────────────────────────────────────────────────┘
   below the shell: centered follow-up rail (subtle pills)
```

- **Context strip** (top band, separated by hairline):
  - *Model chip* — brass-tinted chip showing the active model label (reuse the
    `modelLabel` logic already computed in `Workspace.tsx`, passed down as a prop).
    Click opens Settings (`onOpenSettings` prop → `setSettingsOpen(true)`).
  - *Focus chip* — `focus: N of M sources` (or `all M sources` when no focus set).
    Click opens a small popover listing the notebook's sources with checkboxes;
    writes through `saveFocus`/`loadFocus` (`src/studio/focus.ts`). "All sources"
    entry clears focus. Popover reuses the sessions-dropdown visual pattern
    (AnimatePresence + SOFT, `rounded-[var(--radius-dialog)]` surface).
  - Right side: `grounded` microcopy when sources exist; nothing when zero.
- **Textarea band** — unchanged behavior (auto-grow, Enter sends, Shift+Enter
  newline, caret-brass). Placeholder stays "Ask, or say what to drill…".
- **Action rail** (bottom band):
  - Left: `(+)` button — "Add sources". Wired via new `onAddSources` prop
    (desktop: expand sources pane via `desk.setLayout`; mobile: `setMobilePane("sources")`).
  - Drill chips: **Quiz me**, **Flashcards**, **Outline** — send canned prompts
    through the existing `send()` path (same as STARTERS/FOLLOW_UPS today).
    Hidden while streaming.
  - Right: token estimate `~N tk` (draft + conversation history, chars/4, shown
    when > 0) and the send button — keeps the existing send/stop morph, halo,
    and grad-lamp styling (square-ish `rounded-[12px]` per B).
- **Phase pill** (from A) — absolutely positioned at the shell's top edge
  (`top: -11px`), visible only while `streaming`. Mono uppercase label driven by
  `streaming.phase`: `reading sources` / `thinking` / `answering`, pulsing brass
  dot, brass hairline border. Replaces the loose pulsing status row.
- **Below the shell** — a single centered rail of follow-up pills (existing
  FOLLOW_UPS), shown only when not streaming and the thread has at least one
  answer. Slightly quieter styling than today.

### Removed

- The two loose meta rows under the composer (kbd hints row, "answers cite your
  sources · key stays local" row). "Key stays local" microcopy moves into the
  focus popover footer.
- The old left-aligned follow-up chip row.
- The `3 sources` counter inside the textarea row (superseded by focus chip).

## Messages

- **User message** — compact right-aligned bubble, neutral ink tint
  (`bg-ink/[0.05]`, `border-hairline-strong`) instead of brass, per B.
- **Assistant answer — cardless**: drop the bordered `.answer-card` box. Answers
  sit directly on the ground with the existing `.md` typography. The thinking
  drawer (moon-styled, collapsible) is kept as-is above the content.
- **Citations** — keep dedupe logic; render as B-style pills under the answer:
  `1 · Alvarez · Ch. 4` (mono, brass-pale, hover brass). Click still navigates
  via `onNavigateSources`.
- **Answer action bar (the clarity ask)** — directly under every completed
  answer, always visible (no hover gating):
  - `Save to note` — bookmark icon + label, brass-tinted pill
    (`border-brass/35 bg-brass/[0.08] text-brasspale`), the visually primary
    action. On click: saves via existing `createCustomNote` flow, then the
    button itself morphs to `Saved ✓` in sage for ~2s (in addition to the
    existing toast).
  - `Copy` — copy icon + label, neutral pill. On click: morphs to `Copied ✓`
    (sage) for ~2s.
  - Both: `rounded-full border px-3 py-1 text-[12px]`, success state swaps icon
    to `Check` and sets `aria-live="polite"` on the bar.
- **Jump to latest** — floating pill (bottom-right, above composer) when the
  user has scrolled up during streaming (`stickBottom` false). Click scrolls to
  bottom and re-sticks. Requires lifting `stickBottom` into state (keep the ref
  for scroll math, mirror to state for rendering).
- **Error card** — unchanged (rust card in the scroll area).

## Wiring changes

- `ChatPane` gains props: `modelLabel: string`, `onOpenSettings: () => void`,
  `onAddSources: () => void` (all optional-with-default safe, but both render
  sites in `Workspace.tsx` pass them).
- `Workspace.tsx` passes `modelLabel` (already computed), `onOpenSettings={() =>
  setSettingsOpen(true)}`, and `onAddSources` (desktop: `desk.setLayout(...)` to
  show sources pane; mobile: `setMobilePane("sources")`).
- New CSS in `studio.css`: `.console-strip`, `.phase-pill`, `.answer-actions`,
  `.jump-latest` (names indicative).

## States & edge cases

- No sources in notebook: focus chip reads `no sources yet`, popover shows a
  hint to add sources (and the `(+)` rail button is the affordance).
- Streaming: drill chips hidden, send morphs to stop (existing), phase pill
  visible, follow-up rail hidden, jump pill appears when scrolled up.
- Empty draft: send disabled (existing), token estimate hidden.
- Abort: phase pill unmounts with `streaming` (AnimatePresence fade).
- Reduced motion: pill dot uses existing global reduced-motion override; no new
  ambient animation beyond the existing beam/halo vocabulary.

## Testing & verification

- Existing vitest suites (`layout.test.ts`, `shortcuts.ts` tests) must pass.
- `pnpm build` (tsc + vite) must pass.
- Visual check against the running dev build via Playwright: composer bands,
  phase pill during a mocked stream, answer action bar states, jump pill.
- No new unit tests required (pure UI rearrangement); token estimate stays
  inline (chars/4) — if extracted later, test then.

## Out of scope

- File attach uploads from the composer (`+` opens the Sources pane instead).
- Slash commands, mic input, source context chips (Option D ideas — not chosen).
- Model switching inside the composer popover (chip opens Settings where model
  selection already lives).
