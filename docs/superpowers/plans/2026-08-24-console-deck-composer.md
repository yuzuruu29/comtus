# Console Deck Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the studio chat composer as a three-band console (context strip → textarea → action rail) with a streaming phase pill, and make assistant answers cardless with always-visible Save-to-note/Copy actions.

**Architecture:** All UI work lands in `src/studio/ChatPane.tsx` (composer JSX restructure + a new `FocusMenu` component + `MessageBubble` restyle) with a small CSS append to `src/studio/studio.css`. `Workspace.tsx` passes three new props through. No data-layer changes; focus continues to live in localStorage via `src/studio/focus.ts`.

**Tech Stack:** React 19, Tailwind v4 (inline utilities + existing token classes), motion/react, Phosphor icons, Vitest.

## Global Constraints

- Keep the lamp identity: `.composer-shell`, `BorderBeam`, `Spotlight`, `composer-ambience`, `send-halo`, send/stop morph all stay.
- No new dependencies. Icons only from `@phosphor-icons/react` (already a dep).
- Theme-safe colors only — use token classes (`text-brasspale`, `border-hairline`, `bg-ink/[0.05]`…) or `color-mix` with vars; never hardcode hex in new CSS.
- Copy must never claim "bring your Anthropic key" (product truth memory).
- Enter sends, Shift+Enter newline (existing textarea behavior preserved).
- Existing tests `src/studio/layout.test.ts`, `src/studio/shortcuts.test.ts` must keep passing; `pnpm build` must pass.

---

### Task 1: ChatPane props + Workspace wiring

**Files:**
- Modify: `src/studio/ChatPane.tsx` (component signature, ~line 62)
- Modify: `src/studio/Workspace.tsx` (two `<ChatPane …>` render sites, lines 141 and 182)

**Interfaces:**
- Produces: `ChatPane` accepts `modelLabel?: string`, `onOpenSettings?: () => void`, `onAddSources?: () => void`. Later tasks render these behind the new UI.

- [ ] **Step 1: Extend ChatPane's props**

In `ChatPane.tsx`, change the component signature to:

```tsx
export default function ChatPane({
  notebook,
  sourcesVersion,
  onNavigateSources,
  modelLabel,
  onOpenSettings,
  onAddSources,
}: {
  notebook: Notebook | null;
  sourcesVersion: number;
  onNavigateSources: (sourceId: string, startChar?: number) => void;
  modelLabel?: string;
  onOpenSettings?: () => void;
  onAddSources?: () => void;
}) {
```

- [ ] **Step 2: Wire Workspace**

In `Workspace.tsx`, both `<ChatPane … />` occurrences (desktop ~line 141, mobile ~line 182) become:

```tsx
<ChatPane
  notebook={desk.notebook}
  sourcesVersion={desk.sourcesVersion}
  onNavigateSources={openSource}
  modelLabel={modelLabel}
  onOpenSettings={() => setSettingsOpen(true)}
  onAddSources={() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      desk.setLayout(panes.studio ? "standard" : "reading");
    } else {
      setMobilePane("sources");
    }
  }}
/>
```

(The `window.matchMedia` check avoids duplicating the responsive branch; `panes` is already in scope at the desktop site and harmless at the mobile site.)

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/studio/ChatPane.tsx src/studio/Workspace.tsx
git commit -m "feat(studio): pass model/settings/add-sources wiring into ChatPane"
```

---

### Task 2: Composer console bands, phase pill, focus menu, token meter

**Files:**
- Modify: `src/studio/ChatPane.tsx` (composer block ~lines 611–754; add `FocusMenu` component + imports)
- Modify: `src/studio/studio.css` (append phase-pill + halo radius)

**Interfaces:**
- Consumes: `modelLabel`, `onOpenSettings`, `onAddSources` (Task 1); `loadFocus`/`saveFocus` from `./focus`; `db.sources` for the source list; existing `send(prompt)`, `streaming.phase`.
- Produces: composer renders three bands inside `.composer-shell`; `FocusMenu` (local component) manages its own popover.

- [ ] **Step 1: Add imports in ChatPane.tsx**

Add `Sparkle` and `Stack` to the `@phosphor-icons/react` import. Add `useMemo` to the react import. Add:

```tsx
import { loadFocus, saveFocus } from "./focus";
```

(replacing the existing `import { loadFocus } from "./focus";`)

- [ ] **Step 2: Append CSS to studio.css**

```css
/* ── Console-deck composer ────────────────────────────────── */
.phase-pill {
  position: absolute;
  top: -11px;
  left: 16px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--brasspale);
  background: color-mix(in srgb, var(--surface) 92%, var(--ground));
  border: 1px solid color-mix(in srgb, var(--brass) 35%, transparent);
  border-radius: 999px;
  padding: 3px 10px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.phase-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--brass);
  animation: breathe 1.4s ease-in-out infinite;
}
```

Also change `.send-halo`'s `border-radius: 999px;` to `border-radius: 12px;` (send button becomes the console's rounded-square per Option B; halo must match).

- [ ] **Step 3: Add the FocusMenu component (bottom of ChatPane.tsx, above `dedupeCitations`)**

```tsx
function FocusMenu({
  notebook,
  sourcesVersion,
}: {
  notebook: Notebook;
  sourcesVersion: number;
}) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<{ id: string; title: string }[]>([]);
  const [focus, setFocus] = useState<string[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void db.sources
      .where("notebookId")
      .equals(notebook.id)
      .toArray()
      .then((rows) => setSources(rows.map((r) => ({ id: r.id, title: r.title }))));
    setFocus(loadFocus(notebook.id));
  }, [notebook.id, sourcesVersion]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (id: string) => {
    const effective = focus ?? sources.map((s) => s.id);
    const next = effective.includes(id)
      ? effective.filter((x) => x !== id)
      : [...effective, id];
    const all = next.length === sources.length;
    const value = all || next.length === 0 ? null : next;
    setFocus(value);
    saveFocus(notebook.id, value);
  };

  const label =
    sources.length === 0
      ? "no sources yet"
      : focus === null
        ? `all ${sources.length} sources`
        : `${focus.length} of ${sources.length} sources`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Choose which sources answers ground in"
        className="flex items-center gap-1.5 rounded-full border border-hairline bg-ink/[0.03] px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] text-muted transition-colors hover:border-brass/40 hover:text-brasspale"
      >
        <Stack size={11} weight="light" />
        {label}
        <CaretDown size={9} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={SOFT}
            role="listbox"
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-[var(--radius-dialog)] border border-hairline bg-surface p-1 shadow-modal"
          >
            <div className="max-h-60 overflow-y-auto py-1">
              {sources.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted">
                  Add sources on the left to ground your answers.
                </div>
              )}
              {sources.map((s) => {
                const checked = focus === null || focus.includes(s.id);
                return (
                  <button
                    key={s.id}
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(s.id)}
                    className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[12.5px] text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
                        checked ? "border-brass/60 bg-brass/25 text-brasspale" : "border-hairline-strong"
                      }`}
                    >
                      {checked && <Check size={9} weight="bold" />}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-hairline px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted/70">
              Answers cite your sources · key stays local
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: Restructure the composer JSX**

Replace the entire composer block (from `{/* Composer — the lamp-lit writing instrument…` through the closing `</div>` of the follow-up row, currently lines ~611–754) with:

```tsx
      {/* Composer — console deck. Three bands inside the lamp-lit
          shell: context strip, textarea, action rail. Wakes on
          focus with beam + lamplight as before. */}
      <div className="relative shrink-0 px-4 pb-[calc(0.9rem+var(--sab))] pt-2 sm:px-5 sm:pb-[0.95rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-7 h-7 bg-gradient-to-b from-transparent to-ground"
        />
        <div
          aria-hidden
          className={`composer-ambience pointer-events-none absolute inset-x-6 -top-12 bottom-0 ${
            focused || streaming ? "is-lit" : ""
          }`}
        />
        <Spotlight radius={230} className="mx-auto w-full max-w-3xl rounded-[var(--radius-dialog)]">
          <motion.div
            data-focused={focused ? "" : undefined}
            data-streaming={streaming ? "" : undefined}
            animate={{ y: focused || streaming ? -2 : 0 }}
            transition={{ duration: 0.34, ease: HOUSE }}
            className="composer-shell relative"
          >
            {(focused || streaming) && (
              <BorderBeam size={84} duration={streaming ? 3.4 : 5} />
            )}
            <AnimatePresence>
              {streaming && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
                  transition={SOFT}
                  className="phase-pill"
                  role="status"
                >
                  <span className="phase-dot" />
                  {streaming.phase === "thinking"
                    ? "thinking"
                    : streaming.phase === "answering"
                      ? "answering"
                      : "reading sources"}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative z-[2]">
              {/* Context strip */}
              <div className="flex items-center gap-1.5 px-3.5 pb-2 pt-2.5">
                <button
                  onClick={() => onOpenSettings?.()}
                  title="Change model in Settings"
                  className="flex items-center gap-1.5 rounded-full border border-brass/35 bg-brass/[0.07] px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] text-brasspale transition-colors hover:bg-brass/[0.14]"
                >
                  <Sparkle size={10} weight="fill" className="text-brass" />
                  <span className="max-w-[11rem] truncate">{modelLabel ?? cs.model}</span>
                  <CaretDown size={9} />
                </button>
                {notebook && <FocusMenu notebook={notebook} sourcesVersion={sourcesVersion} />}
                <span className="flex-1" />
                {sourceCount > 0 && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted/60">
                    grounded
                  </span>
                )}
              </div>
              <div className="mx-3.5 border-t border-hairline" />

              {/* Textarea band */}
              <div className="px-3.5 pb-1.5 pt-2.5">
                <textarea
                  ref={taRef}
                  aria-label="Ask Comtus"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Ask, or say what to drill…"
                  className="min-h-9 w-full resize-none bg-transparent text-[16px] leading-relaxed text-ink caret-brass outline-none placeholder:text-muted/55 sm:text-[14px]"
                />
              </div>

              {/* Action rail */}
              <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
                <button
                  onClick={() => onAddSources?.()}
                  title="Add sources"
                  aria-label="Add sources"
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
                >
                  <Plus size={14} weight="light" />
                </button>
                {!streaming && (
                  <>
                    <span className="mx-0.5 h-4 w-px bg-hairline" />
                    {(
                      [
                        ["Quiz me", "Make me a 10-item quiz on the hardest part of my sources"],
                        ["Flashcards", "Turn the key concepts in my sources into flashcards, front and back"],
                        ["Outline", "Build me a structured study outline from my sources"],
                      ] as const
                    ).map(([label, prompt]) => (
                      <button
                        key={label}
                        onClick={() => void send(prompt)}
                        className="rounded-full border border-hairline bg-ink/[0.03] px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-brass/40 hover:bg-brass/[0.08] hover:text-brasspale"
                      >
                        {label}
                      </button>
                    ))}
                  </>
                )}
                <span className="flex-1" />
                {tkEstimate > 0 && (
                  <span className="mr-1 font-mono text-[9.5px] tracking-[0.06em] text-muted/60">
                    ~{tkEstimate.toLocaleString()} tk
                  </span>
                )}
                <AnimatePresence mode="popLayout" initial={false}>
                  {streaming ? (
                    <motion.button
                      key="stop"
                      initial={{ opacity: 0, scale: 0.55, rotate: -90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.55, rotate: 90 }}
                      transition={SPRING}
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.88 }}
                      onClick={() => abortRef.current?.abort()}
                      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline-strong text-ink transition-colors duration-fast hover:border-rust/60 hover:bg-rust/[0.09] hover:text-rust"
                      aria-label="Stop generating"
                      title="Stop"
                    >
                      <Stop size={13} weight="fill" />
                    </motion.button>
                  ) : (
                    <motion.button
                      key="send"
                      data-armed={hasText}
                      initial={{ opacity: 0, scale: 0.55, rotate: 90 }}
                      animate={{ opacity: hasText ? 1 : 0.45, scale: 1, rotate: 0 }}
                      whileHover={hasText ? { scale: 1.08 } : undefined}
                      whileTap={{ scale: 0.88 }}
                      transition={SPRING}
                      onClick={() => void send()}
                      disabled={!hasText}
                      className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[12px] grad-lamp text-night disabled:cursor-not-allowed"
                      aria-label="Send"
                    >
                      <span aria-hidden className="send-halo" />
                      <AnimatePresence mode="wait" initial={false}>
                        {hasText ? (
                          <motion.span
                            key="plane"
                            initial={{ opacity: 0, y: 9, scale: 0.5 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -9, scale: 0.5 }}
                            transition={{ duration: 0.17, ease: HOUSE }}
                            className="relative z-[1] flex"
                          >
                            <PaperPlaneRight size={15} weight="bold" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="up"
                            initial={{ opacity: 0, y: -9, scale: 0.5 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 9, scale: 0.5 }}
                            transition={{ duration: 0.17, ease: HOUSE }}
                            className="relative z-[1] flex"
                          >
                            <ArrowUp size={16} weight="bold" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </Spotlight>

        {/* Follow-up rail — only once there is an answer to follow up on */}
        {!streaming && messages.some((m) => m.role === "assistant") && (
          <div className="relative mx-auto mt-2 flex w-full max-w-3xl items-center justify-center gap-2 overflow-x-auto scroll-thin">
            {FOLLOW_UPS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void send(prompt)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/[0.04] px-3 py-1 text-[11.5px] text-muted transition-colors hover:bg-brass/10 hover:text-brasspale"
              >
                <span className="max-w-[20rem] truncate">{prompt}</span>
                <ArrowRight size={11} className="shrink-0 opacity-60" />
              </button>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 5: Add the token estimate (inside the component, near `hasText`)**

```tsx
  const tkEstimate = useMemo(
    () =>
      Math.round(
        (input.length + messages.reduce((n, m) => n + m.content.length, 0)) / 4,
      ),
    [input, messages],
  );
```

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (If `bg-hairline` is not a valid utility, use `bg-hairline-strong` or `bg-ink/10` for the rail divider.)

- [ ] **Step 7: Commit**

```bash
git add src/studio/ChatPane.tsx src/studio/studio.css
git commit -m "feat(studio): console-deck composer — context strip, action rail, phase pill, focus menu"
```

---

### Task 3: Cardless answers + always-visible Save/Copy action bar

**Files:**
- Modify: `src/studio/ChatPane.tsx` (`MessageBubble`, lines ~775–917)

**Interfaces:**
- Consumes: existing `onSaveToNote`, `onCite`, `dedupeCitations`, `Collapse`, thinking drawer.

- [ ] **Step 1: Restyle the user bubble**

In `MessageBubble`, the user branch bubble className becomes:

```tsx
className="max-w-[82%] rounded-2xl bg-ink/[0.05] border border-hairline-strong px-4 py-3 text-[14px] leading-relaxed text-ink shadow-sm"
```

- [ ] **Step 2: Add local `saved` state**

Next to `const [copied, setCopied] = useState(false);` add:

```tsx
  const [saved, setSaved] = useState(false);
```

- [ ] **Step 3: De-box the assistant wrapper**

The assistant `motion.div` className changes from the bordered card to:

```tsx
className="space-y-3"
```

(drop `rounded-2xl border border-hairline/80 bg-surface/70 p-4 shadow-sm`)

- [ ] **Step 4: Restyle citations as B-pills**

The citations container loses its border-top; pill labels become `N · Title`:

```tsx
      {citations.length > 0 && !streaming && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Quotes size={13} weight="light" className="text-muted/60 mr-1" />
          {citations.map((c, i) => (
            <button
              key={i}
              onClick={() => c.sourceId && onCite(c.sourceId, c.startChar)}
              title={c.citedText.slice(0, 160)}
              className="rounded-md border border-hairline bg-ink/[0.03] px-2 py-0.5 font-mono text-[10.5px] text-brasspale hover:border-brass/40 hover:bg-brass/10 transition-colors"
            >
              {i + 1} · {c.sourceTitle.length > 24 ? `${c.sourceTitle.slice(0, 24)}…` : c.sourceTitle}
            </button>
          ))}
        </div>
      )}
```

- [ ] **Step 5: Replace the action footer with the clear action bar**

```tsx
      {!streaming && msg.content && (
        <div aria-live="polite" className="flex items-center justify-between pt-1">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted opacity-60">
            {timeAgo(msg.createdAt)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (saved) return;
                const title = deriveSessionTitle(msg.content) || "Saved note";
                onSaveToNote?.(title, msg.content);
                setSaved(true);
                setTimeout(() => setSaved(false), 2400);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
                saved
                  ? "border-sage/40 bg-sage/[0.12] text-sage"
                  : "border-brass/35 bg-brass/[0.08] text-brasspale hover:bg-brass/[0.16]"
              }`}
              title="Save this answer to Studio Notes"
            >
              {saved ? <Check size={13} weight="bold" /> : <BookmarkSimple size={13} />}
              <span>{saved ? "Saved ✓" : "Save to note"}</span>
            </button>
            <button
              onClick={copyText}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
                copied
                  ? "border-sage/40 bg-sage/[0.12] text-sage"
                  : "border-hairline text-muted hover:border-hairline-strong hover:text-ink"
              }`}
              title="Copy answer"
            >
              {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
              <span>{copied ? "Copied ✓" : "Copy"}</span>
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/studio/ChatPane.tsx
git commit -m "feat(studio): cardless answers with always-visible Save to note / Copy actions"
```

---

### Task 4: Jump-to-latest pill

**Files:**
- Modify: `src/studio/ChatPane.tsx` (state + `onScroll` + composer wrapper)

- [ ] **Step 1: Add state and reset effect**

Near the other state declarations add:

```tsx
  const [showJump, setShowJump] = useState(false);
```

And after the `streaming`-related effects add:

```tsx
  useEffect(() => {
    if (!streaming) setShowJump(false);
  }, [streaming]);
```

- [ ] **Step 2: Track scroll-up in onScroll**

`onScroll` becomes:

```tsx
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const stuck = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickBottom.current = stuck;
    setShowJump(!stuck);
  };
```

- [ ] **Step 3: Render the pill**

Inside the composer's outer `relative` wrapper (the div with `px-4 pb-[calc(0.9rem+var(--sab))]…`), directly after the ambience div, add:

```tsx
        <AnimatePresence>
          {streaming && showJump && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
              transition={SOFT}
              onClick={() => {
                const el = scrollRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                stickBottom.current = true;
                setShowJump(false);
              }}
              className="absolute -top-9 right-4 z-20 flex items-center gap-1.5 rounded-full border border-hairline-strong bg-raised px-3 py-1.5 text-[11.5px] text-ink shadow-modal"
            >
              <ArrowDown size={11} weight="light" />
              Jump to latest
              <span className="h-1 w-1 rounded-full bg-brass" />
            </motion.button>
          )}
        </AnimatePresence>
```

Add `ArrowDown` to the Phosphor import. If `bg-raised` is not a token utility, use `bg-surface`.

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/studio/ChatPane.tsx
git commit -m "feat(studio): jump-to-latest pill while streaming scrolled up"
```

---

### Task 5: Full verification

- [ ] **Step 1: Tests + build**

Run: `pnpm exec vitest run && pnpm build`
Expected: all suites pass; build succeeds.

- [ ] **Step 2: Visual check**

Start `pnpm dev`, open the studio in Playwright, create/choose a notebook, and screenshot: (a) composer idle, (b) composer focused with the focus popover open, (c) an answer's action bar if a message exists. Compare against `design-mockups/option-b-console-deck.png`.

- [ ] **Step 3: Fix any visual defects, then final commit if needed**
