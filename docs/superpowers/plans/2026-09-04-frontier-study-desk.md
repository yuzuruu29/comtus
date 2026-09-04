# Frontier Study Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Before editing UI in Phases 2–5, load `pbakaus/impeccable` `reference/craft-floor.md` and `reference/operate.md` (Persuade mode for Phase 4, Operate mode for Phases 2/3/5).

**Goal:** Make Comtus one coherent product — a scholar's desk lit by a single lamp — by deleting the two abandoned visual worlds (sapphire console, pixel arcade), collapsing three token/theming systems into one, fixing the functional defects found in the audit, and adding the learning engine (FSRS review, attempt memory, weak-spot targeting, sessions) that turns "chat with your PDFs" into a study tool.

**Architecture:** Six phases, each independently shippable and each ending green on the gates in Spec §8. Phase 0 fixes what is broken and removes what is dead so every later diff is small. Phase 1 replaces the styling foundation (tokens, type, motion, breakpoints) without touching component structure. Phase 2 introduces the primitive kit (`src/ui/*`) and migrates the studio onto it. Phase 3 restructures the shells and the desk. Phase 4 rebuilds the landing. Phase 5 unifies desktop. Phase 6 adds the learning engine on Dexie v3. Phases 4 and 6 are independent of each other and can run in parallel after Phase 3.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, Tailwind v4 (`@theme` tokens), `motion/react`, `@phosphor-icons/react`, Dexie 4, zustand 5, Vitest 4 + Testing Library + `fake-indexeddb`, `ts-fsrs` 5.4.2 (new, MIT), `@fontsource-variable/literata` (new).

**Spec:** `docs/superpowers/specs/2026-09-04-frontier-study-desk-design.md` — the plan argues from the spec; read both. Section references below (`Spec §4`) point there.

## Global Constraints

- No new runtime dependencies except `ts-fsrs@^5.4.2` and `@fontsource-variable/literata@^5.3.0`. Remove `lucide-react`, `gsap`, `lenis`, `@fontsource-variable/fraunces`, `@fontsource-variable/inter`, `@fontsource/instrument-serif` when their last import goes.
- Colors only via tokens (`var(--brass)`, `text-muted`, `color-mix(in srgb, var(--ink) 62%, var(--surface))`). Hex literals are allowed **only** in `src/styles/tokens.css` and in SVG sprite data files (`src/components/pixel/*Frames.tsx`, `src/components/icons/StudyGlyph.tsx`).
- Type sizes only via the ladder in Spec §5.2. No `text-[Npx]` outside `src/landing/`.
- Icons only from `@phosphor-icons/react`, weight `regular`, sizes 16/20.
- Copy follows Spec §5.3–5.5: sentence case, no eyebrows, no ` · ` joiners, no `→`, no exclamation marks, no invented metrics, glossary words only (desk / shelf / notebook / source / citation / thinking / work / Today / Lamplight / Daylight).
- Motion only via `--dur-*` / `--ease-*` tokens; no bounce easings; no `transition: width|height`.
- `prefers-reduced-motion` three-tier doctrine in `index.css` stays.
- Every task ends with `pnpm exec tsc --noEmit && pnpm lint` green and the task's named tests passing; every phase ends with `bash scripts/launch-check.sh` green.
- Commit per task with the message given. Do not squash phases.
- Route paths do not change (`/`, `/studio`, `/studio/:notebookId`, static pages, `/checkout`, `/auth/openrouter/callback`); `/studio/today` and `/guide/models` are added.
- Persisted data is never lost: Dexie v3 migrates `cardProgress`; localStorage key migration runs once (Task 3.7).

---

## Phase 0 — Stop the bleeding (defects, dead code, test gate)

### Task 0.1: Make the test suite a usable gate

**Files:**
- Modify: `vitest.config.ts`
- Modify: `src/test/setup.ts`
- Modify: `scripts/launch-check.sh`
- Create: `mobile/vitest.config.ts`
- Modify: `package.json` (scripts)

**Why:** The full suite takes > 9 min on a cold sandbox (measured 2026-09-04 per directory: `src/lib` 216 s — 132 s of it jsdom environment boot for 23 files that mostly never touch the DOM; `src/landing` 83 s; `api` 62 s; `src/components` 58 s; `src/studio` did not finish inside a 240 s budget). `launch-check.sh` assumes ~20 s. The `react-native` alias in the root config also makes every root test resolve mobile mocks.

- [ ] **Step 1: Split environments with Vitest projects**

Vitest 4.1 (installed) has no `environmentMatchGlobs`; use `test.projects`. Replace `vitest.config.ts` with:

```ts
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const shared = {
  globals: false,
  setupFiles: ["./src/test/setup.ts"],
  testTimeout: 15_000,
  hookTimeout: 15_000,
  teardownTimeout: 8_000,
  exclude: [...configDefaults.exclude, "promo/**", "mobile/**"],
};

export default defineConfig({
  plugins: [react()],
  test: {
    ...shared,
    pool: "threads",
    projects: [
      {
        // Pure logic: no DOM, no jsdom boot cost.
        extends: true,
        test: {
          ...shared,
          name: "node",
          environment: "node",
          include: ["src/lib/**/*.test.ts", "api/**/*.test.ts", "src/styles/**/*.test.ts"],
          exclude: [...shared.exclude, "src/lib/{theme,settings,backup,storageStats,useSmoothText,voice,desktop}.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          ...shared,
          name: "dom",
          environment: "jsdom",
          include: [
            "src/**/*.test.tsx",
            "src/studio/**/*.test.ts",
            "src/landing/**/*.test.ts",
            "src/lib/{theme,settings,backup,storageStats,useSmoothText,voice,desktop}.test.ts",
          ],
        },
      },
    ],
  },
});
```

Any `src/lib/*.test.ts` that fails in the `node` project because it touches `window`/`localStorage`/`document` moves to the `dom` include list (run Step 3 to find them; the seven named above were identified by `rg 'document\.|window\.|localStorage' src/lib/*.test.ts`).

- [ ] **Step 2: Give mobile its own config**

Create `mobile/vitest.config.ts`:

```ts
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "react-native": resolve(__dirname, "src/test/react-native-mock.ts") } },
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"] },
});
```

Add to root `package.json` scripts: `"test:mobile": "vitest run --config mobile/vitest.config.ts"`.

- [ ] **Step 3: Run per directory and record timings**

Run: `for d in src/lib src/styles src/components src/landing src/studio api; do /usr/bin/time -f "$d %es" pnpm exec vitest run "$d" --reporter=dot; done`
Expected: every directory green; total under 120 s. If a `node`-environment test fails on a DOM global, add the `@vitest-environment jsdom` directive to that file only.

- [ ] **Step 4: Make launch-check honest**

In `scripts/launch-check.sh`, replace the vitest line with:

```bash
start=$(date +%s)
pnpm exec vitest run --reporter=dot
echo "vitest wall time: $(( $(date +%s) - start ))s (budget 120s)"
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts mobile/vitest.config.ts src/test/setup.ts scripts/launch-check.sh package.json
git commit -m "test: split vitest environments so the suite runs under two minutes"
```

### Task 0.2: Delete unreachable landing code and the shim

**Files:**
- Delete: `src/landing/ComtusShowcase.tsx`, `src/landing/comtus-showcase.css`, `src/landing/PixelPlayerShowcase.tsx`, `src/landing/PixelPlayerShowcase.test.tsx`, `src/landing/pixel-player.css`, `src/landing/PixelDeskHeroScene.tsx`, `src/landing/Hero.tsx`, `src/landing/ProductDemo.tsx`, `src/landing/StudioShowcase.tsx`, `src/landing/LearningLoop.tsx`, `src/landing/Method.tsx`, `src/landing/WhyComtus.tsx`, `src/landing/UseCases.tsx`, `src/landing/TrustPrivacy.tsx`, `src/landing/AcademicIntegrity.tsx`, `src/landing/BringStack.tsx`, `src/landing/Marquee.tsx`, `src/landing/Boards.tsx`, `src/landing/DesktopApp.tsx`, `src/components/pixel/PixelLampCompanion.tsx`, `src/components/pixel/PixelLampCompanion.test.tsx`, `src/components/pixel/pixelLampFrames.tsx`
- Modify: `src/landing/Landing.test.tsx` (drop the `ComtusShowcase` import and its `describe` block), `src/styles/palette.test.ts` (remove the `ComtusShowcase` allow entry), `src/landing/CantorShowcase.tsx` (remove the `Boards` import/usage — it is deleted in Task 4.1 anyway), `src/components/pixel/index.ts` (drop lamp exports), `src/index.css:305` (delete the `DesktopApp` comment)

**Why:** 5,532 lines reachable from no route (Spec §2.3 A1); tests were asserting on dead components.

- [ ] **Step 1: Prove they are unreachable**

Run: `for b in ComtusShowcase PixelPlayerShowcase PixelDeskHeroScene ProductDemo StudioShowcase LearningLoop Method WhyComtus UseCases TrustPrivacy AcademicIntegrity BringStack Marquee; do rg -l "\b$b\b" src --glob '!*.test.*' --glob "!**/$b.tsx"; done`
Expected: no output (Hero is imported by nothing; Boards only by CantorShowcase; DesktopApp only by a CSS comment).

- [ ] **Step 2: Delete the files listed above**

Run: `git rm` on each path. Edit the four "Modify" files so nothing references the deleted modules. In `src/components/pixel/index.ts` keep only `PixelBatteryCompanion`, `PixelSprite`, `PixelUI` exports.

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm exec vitest run src/landing src/components src/styles`
Expected: green. `pnpm build` must also succeed.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "chore(landing): delete 5.5k lines of unreachable showcase components and the lamp shim"
```

### Task 0.3: Remove forbidden CRT scanlines and the console bezel styling

**Files:**
- Modify: `src/studio/ConsoleShell.tsx` (delete the `<div className="console-screen-scanlines" />` element)
- Modify: `src/studio/console-shell.css` (delete `.console-screen-scanlines` and its `html[data-theme="light"]` override; delete the `2px solid` chassis border and `0 12px 32px rgba(0,0,0,.25)` shadow — set `.console-chassis { border: 0; box-shadow: none; border-radius: 0; }`)
- Modify: `src/landing/scholar-deck.css` (delete the "CRT Screen Display" and "Scanline Overlay" blocks, lines ~123–160, and the elements using them in `src/landing/ScholarConsoleDeck.tsx`)
- Test: `src/studio/console-shell.test.ts` (create)

**Why:** `BRAND.md §5` forbids CRT overlays; the overlay sits at `z-index:40` over the whole workspace.

- [ ] **Step 1: Write the failing guard test**

```ts
// src/studio/console-shell.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("brand: no CRT chrome", () => {
  it("ships no scanline classes anywhere in src", () => {
    const files = ["src/studio/console-shell.css", "src/landing/scholar-deck.css", "src/studio/ConsoleShell.tsx", "src/landing/ScholarConsoleDeck.tsx"];
    const hits = files.filter((f) => /scanline|crt/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `pnpm exec vitest run src/studio/console-shell.test.ts`

- [ ] **Step 3: Delete the scanline element, CSS blocks, and chassis bevel as listed**

- [ ] **Step 4: Run it, expect PASS; run `pnpm exec vitest run src/studio/ConsoleShell.test.tsx` too**

- [ ] **Step 5: Commit** — `git commit -am "fix(brand): remove CRT scanlines and console bevel (BRAND §5 forbidden motion)"`

### Task 0.4: Fix the dead Settings gear and the false status copy

**Files:**
- Modify: `src/studio/Workspace.tsx:401` (type) and `:501,507,519,524,546` (handlers)
- Modify: `src/studio/NotebookList.tsx:220` (`modelLabel="Local SQLite / Dexie"` → `modelLabel="On this device"`)
- Test: `src/studio/workspace-settings.test.tsx` (create)

**Why:** `WorkspaceHeader` receives `openSettings(tab: SettingsTab = "settings")` but types the prop as `() => void`; `onClick={onSettings}` therefore calls it with a `MouseEvent` as `tab`, and `SettingsModal` renders `open && tab === "settings"` → never true (Spec §2.6 F1). The app does not use SQLite.

- [ ] **Step 1: Write the failing test**

```tsx
// src/studio/workspace-settings.test.tsx
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { db } from "../lib/db";
import Workspace from "./Workspace";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</> };
});
vi.mock("./ConsoleShell", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("./companion/DeskLife", () => ({ default: () => null }));

afterEach(cleanup);

describe("workspace header", () => {
  it("opens the Settings dialog from the gear button", async () => {
    await db.notebooks.put({ id: "nb1", name: "Pharm", createdAt: 1, updatedAt: 1 });
    render(<MemoryRouter initialEntries={["/studio/nb1"]}><Workspace notebookId="nb1" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** (no dialog found).

- [ ] **Step 3: Fix the type and the call sites**

In `Workspace.tsx` change the `WorkspaceHeader` prop type to `onSettings: (tab?: SettingsTab) => void;` and change the five `onClick={onSettings}` to `onClick={() => onSettings()}`; the model/effort chip (`:501`) and BYOK/Pro badges (`:519,524`) become `onClick={() => onSettings("models")}`. Change the `NotebookList.tsx:220` label.

- [ ] **Step 4: Run it, expect PASS.** Also verify in the browser: `/studio/:id` → click gear → dialog opens.

- [ ] **Step 5: Commit** — `git commit -am "fix(studio): settings gear passed a MouseEvent as the tab; stop claiming SQLite"`

### Task 0.5: One icon library

**Files:**
- Modify: every file importing `lucide-react` (27 files: `rg -l 'from "lucide-react"' src`)
- Modify: `package.json`, `vite.config.ts` (`vendor-icons` chunk → `["@phosphor-icons/react"]`)

- [ ] **Step 1: Map icons.** For each lucide import, pick the Phosphor equivalent (`X`→`X`, `Plus`→`Plus`, `Settings`→`GearSix`, `Search`→`MagnifyingGlass`, `ChevronDown`→`CaretDown`, `Trash2`→`Trash`, `Loader2`→`CircleNotch`, `Check`→`Check`, `ArrowRight`→`ArrowRight`, `FileText`→`FileText`, `Upload`→`UploadSimple`, `Link`→`LinkSimple`, `Mic`→`Microphone`, `Sparkles`→`Sparkle`, `BookOpen`→`BookOpen`, `Clock`→`Clock`). Use `weight="regular"` everywhere; sizes 16 or 20.
- [ ] **Step 2: `pnpm remove lucide-react`**; update the manual chunk.
- [ ] **Step 3: Guard test** — add to `src/styles/palette.test.ts` a second `it` that fails if any file under `src` matches `/from "lucide-react"/`.
- [ ] **Step 4: `pnpm exec tsc --noEmit && pnpm lint && pnpm build`** green.
- [ ] **Step 5: Commit** — `git commit -am "refactor(icons): Phosphor everywhere; drop lucide-react"`

### Task 0.6: Repository hygiene

**Files:**
- Delete from git (keep on disk if needed): `desktop-releases/*` (37 MB) → publish via GitHub Releases; `minimax-ad-assets/` (4.3 MB); `design-mockups/*.png` except `option-b-console-deck.png` (the approved composer reference)
- Delete: `la-quiz.pdf`, `nursing-guide.pdf` — these are **not fixtures**: `src/lib/pdfExport.test.ts` calls `savePdf(..., "la-quiz")`/`"nursing-guide"` and `pdfExport.ts:406` runs jsPDF's `doc.save()` under jsdom, which writes the files into the CWD on every test run (the repo shows them as modified after `pnpm test`). Fix the test: `vi.mock("jspdf", …)` a `save` spy (mirror how `pptxExport.test.ts:48–51` asserts on `arg?.fileName`), then delete both PDFs and add `*.pdf` at the repo root to `.gitignore`.
- Modify: `.gitignore` (add `desktop-releases/`, `.hoplite/shots/`, `.pnpm-store/`, `/*.pdf`), `vite.config.ts` (`copyDesktopReleases` must tolerate a missing dir — it already does via `existsSync`), `.hoplite/settings.json` (already records `setup`/`run`/`check` commands and port 5199 — keep)
- Modify: `README.md` structure block (remove `src/desk` when Task 5.1 lands; note `docs/superpowers/` and `CONTEXT.md`)

- [ ] **Step 1:** `git rm -r --cached desktop-releases minimax-ad-assets la-quiz.pdf nursing-guide.pdf` and the mockup PNGs; add ignores.
- [ ] **Step 2:** `pnpm build` still succeeds (the plugin skips a missing `desktop-releases/`).
- [ ] **Step 3: Commit** — `git commit -am "chore(repo): stop versioning installers, ad renders, and stale mockups"`

**Phase 0 exit:** `bash scripts/launch-check.sh` green; `/studio/:id` Settings gear opens; no scanlines; suite < 120 s.

---

## Phase 1 — One foundation (tokens, type, motion, breakpoints)

### Task 1.1: `tokens.css` as the single source of truth

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/index.css` (replace the `:root`, `html[data-theme="light"]`, `html[data-theme="dark"]` blocks and the `@theme` color/font/duration entries with `@import "./styles/tokens.css"`; keep the `@theme` *mapping* of `--color-*` to the variables)
- Delete: `src/styles/pixel-palette.css` (349 lines) and its `@import`
- Modify: `BRAND.md §3` — rewrite the palette table from `tokens.css` (Spec §4), delete the `--px-*` layer and the texture/dither class list
- Test: `src/styles/tokens.test.ts` (create), `src/styles/contrast.test.ts` (create)

**Interfaces — Produces:** the CSS custom properties in Spec §4 (`--ground --surface --raised --ink --muted --hairline --hairline-strong --brass --brass-deep --brass-pale --leather --sage --rust --candle --moon`), elevation (`--elev-card --elev-lift --elev-modal`), radii (`--radius-control: 6px; --radius-field: 10px; --radius-dialog: 12px; --radius-pill: 999px`), motion (Spec §6.6), breakpoints (`--bp-sm: 640px; --bp-md: 900px; --bp-lg: 1200px`), and the Tailwind aliases `bg-ground … text-brass-pale`. Keep `--brasspale`/`--brassdeep` as deprecated aliases of `--brass-pale`/`--brass-deep` until Task 2.5 removes the last consumer.

- [ ] **Step 1: Write the failing tests**

```ts
// src/styles/tokens.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(dir, f));

describe("design tokens", () => {
  it("defines every semantic token once, in tokens.css", () => {
    const tokens = ["--ground", "--surface", "--raised", "--ink", "--muted", "--hairline", "--brass", "--moon", "--sage", "--rust", "--candle", "--leather"];
    for (const f of cssFiles("src")) {
      if (f.endsWith("styles/tokens.css")) continue;
      const src = readFileSync(f, "utf8");
      const redefined = tokens.filter((t) => new RegExp(`^\\s*${t}:`, "m").test(src));
      expect(redefined, `${f} redefines ${redefined.join(", ")}`).toEqual([]);
    }
  });

  it("keeps hex literals out of component CSS", () => {
    const offenders = cssFiles("src")
      .filter((f) => !f.endsWith("styles/tokens.css"))
      .filter((f) => /#[0-9a-f]{3,8}\b/i.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")));
    expect(offenders).toEqual([]);
  });
});
```

```ts
// src/styles/contrast.test.ts — WCAG ratio for the pairs we ship
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/tokens.css", "utf8");
const block = (sel: string) => css.slice(css.indexOf(sel));
const hex = (blk: string, name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(blk)![1];
const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe.each([["Daylight", ":root"], ["Lamplight", 'html[data-theme="dark"]']])("%s contrast", (_, sel) => {
  const b = block(sel);
  it("every text token reads on every ground it sits on", () => {
    for (const fg of ["--ink", "--muted", "--moon", "--sage", "--rust"])
      for (const bg of ["--ground", "--surface", "--raised"]) {
        expect(ratio(hex(b, fg), hex(b, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
  });
  it("filled controls carry legible text", () => {
    // Spec §4 rule 6: text on a brass fill is --ground, never --brass-deep.
    for (const fill of ["--brass", "--brass-deep"]) {
      expect(ratio(hex(b, "--ground"), hex(b, fill)), `--ground on ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(hex(b, "--leather"), hex(b, "--candle")), "--leather on --candle").toBeGreaterThanOrEqual(4.5);
  });
  it("brass reads as a text and icon color", () => {
    for (const bg of ["--ground", "--surface"]) {
      expect(ratio(hex(b, "--brass"), hex(b, bg)), `--brass on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
```

- [ ] **Step 2: Run both, expect FAIL** (tokens redefined in `pixel-desk.css`, `pixel-landing.css`; hex in 9 CSS files).

- [ ] **Step 3: Write `tokens.css`** from Spec §4 / §5.2 / §6.6 exactly (two theme blocks, radii, elevation, motion, breakpoints as custom properties, and the `@theme` Tailwind mapping). Move the safe-area and `--desk-*` layout vars from `index.css` into it. Delete `pixel-palette.css`. Replace hex literals in the remaining CSS files with `var(--…)` or `color-mix(…)`; any color that cannot be expressed from the palette is a design defect — remove the rule.

- [ ] **Step 4: Run tests, expect PASS.** `pnpm build` green. Screenshot `/studio/:id` in both themes and compare against `.hoplite/shots/studio-02-workspace.png` — colors must be unchanged except where `--px-*` drift was corrected.

- [ ] **Step 5: Commit** — `git commit -am "feat(tokens): single tokens.css; delete the px-* layer; contrast and single-definition guards"`

### Task 1.2: Retire the pixel theming attributes

**Files:**
- Modify: `src/lib/theme.ts` (`applyPixelDesk` → `applyChrome(on: boolean)` setting `html[data-chrome="pixel"]`), `src/lib/settings.ts` (`pixelDesk` stays as the persisted key; default `false` for new installs via the `migrate` default), `src/studio/DeskShell.tsx` (`usePixelDeskEffect` → `useChromeEffect`)
- Modify: `src/studio/pixel-desk.css` → rename `src/styles/chrome-pixel.css`; keep **only** rules scoped to `.companion-*`, `.px-sprite`, and display headings (`h1, h2` → `font-family: var(--font-pixel)`); delete every token remap (`--ink: var(--px-ink)` etc.), every `!important`, the grid background at `:65`
- Delete: `src/landing/pixel-landing.css` (Task 4.1 rebuilds the landing without it; until then, remove the token remap block lines 30–56 and the `--radius-*: 2px` override so the landing renders on base tokens)
- Modify: `src/landing/pixelMotion.ts` / `src/landing/LandingPage.tsx` (`applyLandingPixel` deleted)
- Test: extend `src/styles/tokens.test.ts` — fails if any CSS contains `data-pixel` or `data-landing-pixel`

- [ ] **Step 1:** add the guard `it("has no legacy pixel theme hooks", …)`; run, expect FAIL.
- [ ] **Step 2:** perform the renames/deletions above. `SettingsModal` toggle label becomes "Pixel accent chrome".
- [ ] **Step 3:** tests + `pnpm build` green; visually confirm the desk with chrome off and on (only companion + headings change).
- [ ] **Step 4: Commit** — `git commit -am "refactor(theme): pixel look is an accent chrome attribute, never a token remap"`

### Task 1.3: Typography — two faces, one ladder

**Files:**
- Modify: `package.json` (`pnpm add @fontsource-variable/literata`; `pnpm remove @fontsource-variable/fraunces @fontsource-variable/inter @fontsource/instrument-serif`)
- Modify: `src/index.css` imports (`@import "@fontsource-variable/literata"; @import "@fontsource-variable/instrument-sans"; @import "@fontsource/jetbrains-mono/400.css"; @import "@fontsource/jetbrains-mono/500.css"; @import "@fontsource-variable/pixelify-sans";`)
- Modify: `src/styles/tokens.css` — `--font-read: "Literata Variable", Literata, Georgia, serif; --font-ui: "Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif; --font-mono: "JetBrains Mono", ui-monospace, monospace; --font-pixel: "Pixelify Sans Variable", "Pixelify Sans", sans-serif;` plus the `--text-*` ladder from Spec §5.2. Keep `--font-display`/`--font-body` as aliases (`--font-display: var(--font-read); --font-body: var(--font-ui)`) until Task 2.5.
- Rewrite: `src/lib/fontPresets.ts` → export `READING_SIZES = ["compact","comfortable","large"] as const` mapping to `--text-read` of `1rem / 1.0625rem / 1.1875rem`; `src/styles/font-presets.css` → `html[data-reading="compact"] { --text-read: 1rem } …`
- Modify: `src/lib/settings.ts` (`fontPreset` → `reading: "compact" | "comfortable" | "large"`, default `"comfortable"`, migration maps any old preset to `"comfortable"`), `src/lib/theme.ts` (`applyFontPreset` → `applyReading`), `src/studio/SettingsModal.tsx` Typography section (three-way segmented control with a live Literata sample paragraph)
- Modify: `src/lib/fontPresets.test.ts`, `src/lib/theme.test.ts`
- Modify: `BRAND.md §4` from Spec §5
- Test: `src/styles/scale.test.ts` (create): counts `text-\[[0-9.]+px\]` in every `src/**/*.tsx` outside `src/landing/` and asserts `count <= CEILING`. `CEILING` starts at the measured baseline (833 on 2026-09-04) so the test is green now and can only ratchet down; Task 2.5 sets `CEILING = 0`.

- [ ] **Step 1:** tests for `READING_SIZES` and `applyReading` (red → green).
- [ ] **Step 2:** fonts and tokens as above; the `.md` reading styles in `studio.css` use `font-family: var(--font-read); font-size: var(--text-read); max-width: 68ch`.
- [ ] **Step 3:** `pnpm build`; check the network panel loads exactly four font families.
- [ ] **Step 4: Commit** — `git commit -am "feat(type): Literata for reading, Instrument Sans for UI, one fixed scale; retire font presets"`

### Task 1.4: Motion tokens and the anti-pattern sweep

**Files:**
- Modify: `src/studio/studio.css` (replace the 7 `cubic-bezier(0.34,1.56,0.64,1)` with `var(--ease-out)`; delete `@keyframes effort-bounce` and its use at `:1065`; replace `transition: width` at `:812,1132` with `grid-template-columns` transitions on the parent or `clip-path`; `.md blockquote` border-left → `1px solid var(--hairline-strong)` with a `--brass` 2 px *top* rule only when quoting a source)
- Modify: `src/index.css` (`.text-lamp` → solid `color: var(--brass)`; `:471,:557` easings → tokens; `:384` `transition: width,height` → `transform`)
- Modify: `src/landing/cantor-theme.css:513,535`, `src/landing/scholar-deck.css:242` (same substitutions — these files are deleted in Task 4.1, so do the minimum)
- Modify: `src/studio/fx.tsx` — `SOFT` spring becomes `{ type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] }`
- Modify: `scripts/launch-check.sh` — append `pnpm dlx impeccable@3.6.1 detect --json src/ | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const w=JSON.parse(s).filter(f=>f.severity==="warning");if(w.length){console.error(w);process.exit(1)}})'`

- [ ] **Step 1:** Run `pnpm dlx impeccable@3.6.1 detect --json src/` → expect the 20 findings from Spec §1.2.
- [ ] **Step 2:** Apply the substitutions.
- [ ] **Step 3:** Re-run the detector → **0 warnings** (advisories about grid backgrounds are removed by Task 1.2/4.1). Run `pnpm exec vitest run src/studio/fx.test.tsx src/studio/pixel-desk.test.ts` — update `pixel-desk.test.ts` expectations that asserted the old file name.
- [ ] **Step 4: Commit** — `git commit -am "style(motion): one easing vocabulary; remove bounce, gradient text, side-stripes, width transitions"`

### Task 1.5: `useBreakpoint()` and one breakpoint ladder

**Files:**
- Create: `src/lib/useBreakpoint.ts`, `src/lib/useBreakpoint.test.ts`
- Modify: `src/studio/Workspace.tsx:256` (replace the imperative `matchMedia` check with `bp >= "md"`), `src/studio/DeskShell.tsx` (`compact` derives from `useBreakpoint() === "sm"`), `src/studio/ConsoleShell.tsx`, `src/studio/companion/DeskLife.tsx` (battery scale), CSS `@media` queries in `studio.css`, `companion.css`, `console-shell.css` → `640px / 900px / 1200px` only

**Interfaces — Produces:**

```ts
export type Breakpoint = "sm" | "md" | "lg" | "xl";       // <640 | <900 | <1200 | ≥1200
export function useBreakpoint(): Breakpoint;              // subscribes to matchMedia change
export function bpAtLeast(bp: Breakpoint, min: Breakpoint): boolean;
```

- [ ] **Step 1: Failing test** — mock `window.matchMedia` with a controllable `matches` + `change` dispatch; assert the hook re-renders from `"xl"` to `"sm"` without remount.
- [ ] **Step 2:** implement with three `matchMedia` listeners (`(min-width: 640px)`, `(min-width: 900px)`, `(min-width: 1200px)`).
- [ ] **Step 3:** replace call sites; open the desk at 1440, resize the window to 390 **without reload** → mobile layout appears (fixes Spec §2.6 F2).
- [ ] **Step 4: Commit** — `git commit -am "feat(layout): useBreakpoint hook and a single sm/md/lg ladder"`

**Phase 1 exit:** launch-check green; impeccable 0 warnings; `tokens.test`, `contrast.test`, `useBreakpoint.test` green; screenshots of shelf/desk in both themes at 1440 and 390 stored under `.hoplite/shots/phase1-*`.

---

## Phase 2 — The primitive kit and studio migration

### Task 2.1: `src/ui` primitives

**Files:**
- Create: `src/ui/Button.tsx`, `src/ui/IconButton.tsx`, `src/ui/Chip.tsx`, `src/ui/Field.tsx`, `src/ui/Input.tsx`, `src/ui/Textarea.tsx`, `src/ui/Segmented.tsx`, `src/ui/Menu.tsx`, `src/ui/Sheet.tsx`, `src/ui/Dialog.tsx` (moves `Modal` from `src/studio/ui.tsx`), `src/ui/Skeleton.tsx`, `src/ui/Empty.tsx`, `src/ui/Toast.tsx` (moves `src/studio/Toast.tsx`), `src/ui/index.ts`
- Create: `src/ui/ui.css` (component classes using only tokens), `src/ui/Button.test.tsx`, `src/ui/Sheet.test.tsx`, `src/ui/Segmented.test.tsx`
- Modify: `src/studio/ui.tsx` → re-export from `src/ui` (delete after Task 2.5)

**Interfaces — Produces:**

```tsx
// Button.tsx
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; size?: ButtonSize; loading?: boolean;
  icon?: React.ReactNode; iconEnd?: React.ReactNode;
}
export function Button(props: ButtonProps): JSX.Element;
// IconButton.tsx — requires aria-label
export function IconButton(props: ButtonProps & { "aria-label": string }): JSX.Element;
// Chip.tsx — selectable/removable facts
export function Chip(props: { selected?: boolean; onRemove?: () => void; tone?: "neutral" | "brass" | "moon" | "sage" | "rust" | "candle"; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element;
// Segmented.tsx
export function Segmented<T extends string>(props: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: React.ReactNode }[]; "aria-label": string }): JSX.Element;
// Sheet.tsx — right-side panel, focus-trapped, Escape closes, portal to body
export function Sheet(props: { open: boolean; onClose: () => void; title: string; width?: "md" | "lg"; children: React.ReactNode }): JSX.Element;
// Dialog.tsx — the existing Modal API (open, onClose, title, wide, children)
// Skeleton.tsx — <Skeleton lines={3} /> and <Skeleton.Card />
// Empty.tsx — <Empty title body action={<Button/>} />: one teaching sentence, one action
```

Design rules baked into `ui.css`: primary = `--brass` fill + `--ground` text (Spec §4 rule 6; `--brass-deep` is the pressed fill, never a text color) + ink-press physics (`.btn-ink-press` from `BRAND.md §5`); secondary = surface + hairline-strong; ghost = transparent; all states (hover, focus-visible ring `2px solid var(--brass)` offset 2px, active, disabled 55% opacity, loading with `CircleNotch` spinning at `--dur-slow`); radii from tokens only; no backdrop-filter except `Sheet`/`Dialog` scrims.

- [ ] **Step 1: Failing tests** — `Button` renders `aria-busy` when loading and ignores clicks; `Sheet` traps Tab and closes on Escape; `Segmented` has `role="radiogroup"` and arrow-key navigation.
- [ ] **Step 2:** implement; re-export `Modal as Dialog` for old callers.
- [ ] **Step 3:** `pnpm exec vitest run src/ui` green; Storybook is not in the stack — instead add `src/ui/__preview__/KitPreview.tsx` mounted at `/studio/kit` **only when `import.meta.env.DEV`** so reviewers can screenshot every state in both themes.
- [ ] **Step 4: Commit** — `git commit -am "feat(ui): primitive kit (Button, Chip, Segmented, Sheet, Dialog, Skeleton, Empty, Toast)"`

### Task 2.2: Shelf on primitives (`NotebookList.tsx`)

**Files:**
- Modify: `src/studio/NotebookList.tsx` (741 lines → split into `Shelf.tsx` ~250, `NotebookCard.tsx`, `NewNotebookDialog.tsx`)
- Modify: `src/studio/notebook-create.test.tsx`, `src/studio/notebookLoad.test.tsx`

Spec §6.2 anatomy: one header (`Comtus` wordmark, "Your notebooks", `Today (n)` chip when Task 6.1 lands — until then omit, gear, `New notebook` primary); search + view toggle row; grid of `NotebookCard` (leather spine, title in `--text-lg`, two facts: source count and last opened); a single `Empty` when there are no notebooks ("Your shelf is empty. Make a notebook for the course you are studying." → `New notebook`). Remove: console status bar (Task 3.1 deletes `ConsoleShell` entirely), the duplicate create tile, the milestone counter, the BYOK badge.

- [ ] **Step 1:** keep the two existing tests green throughout; add `Shelf.test.tsx` asserting exactly one `New notebook` control and the `Empty` copy at zero notebooks.
- [ ] **Step 2:** rebuild with `Button/IconButton/Input/Segmented/Skeleton/Empty`; card focus ring visible; grid `repeat(auto-fill, minmax(240px, 1fr))`.
- [ ] **Step 3:** screenshots 1440/390 both themes.
- [ ] **Step 4: Commit** — `git commit -am "feat(shelf): rebuild the notebook shelf on the primitive kit"`

### Task 2.3: Sources pane on primitives

**Files:**
- Modify: `src/studio/SourcesPane.tsx` (717 lines → `SourcesPane.tsx` list + `AddSourceMenu.tsx` + `SourceReader.tsx` reader)
- Test: `src/studio/SourcesPane.test.tsx` (create): renders empty state copy; adding a pasted text source appears in the list; clicking a source opens the reader.

Copy: empty state "Add a chapter, your notes, or a link. Every answer will cite the page it came from." Single `Add source` primary with a `Menu` (Upload file · Paste text · Web address). Rows: Phosphor kind icon, title, one fact (pages or words) in `--text-xs` mono. Reader: Literata at `--text-read`, `max-width: 68ch`, page markers in the margin (Task 6.5 anchors citations to them).

- [ ] Steps: red test → rebuild → green → screenshots → `git commit -am "feat(sources): sources pane and reader on the kit"`

### Task 2.4: Chat pane and composer on primitives

**Files:**
- Modify: `src/studio/ChatPane.tsx` (1,649 lines → `ChatPane.tsx` ~300, `Composer.tsx`, `MessageList.tsx`, `AssistantMessage.tsx`, `ThinkingDrawer.tsx`, `CitationList.tsx`, `SessionMenu.tsx`)
- Modify: `src/studio/composerControls.ts`, `src/studio/ComposerSideRail.tsx`
- Test: `src/studio/Composer.test.tsx` (create): Enter sends, Shift+Enter newlines; `Think` chip hidden when `capabilities.thinking === false` (Task 3.3 supplies the flag; until then accept a prop).

Keep the approved console-deck anatomy (context strip → textarea → action rail; phase pill; cardless answers; always-visible Save to note / Copy) — it is the one part of the incumbent that was designed against the spec. Change: the composer glow is **the lamp** (`--brass-pale` at 14% radial, breathing at `--beat-lamp` only while streaming); remove `Spotlight` cursor tracking; citations render as `[n]` mono footnotes with a `CitationList` under the answer; thinking drawer text in `--moon`.

- [ ] Steps: red test → split and rebuild → green → screenshots (idle, focused, streaming with the mock LLM `scripts/mock-llm.mjs`) → `git commit -am "feat(chat): split ChatPane; composer is the desk's lamp"`

### Task 2.5: Studio rail, generators, settings on primitives; retire aliases

**Files:**
- Modify: `src/studio/StudioPane.tsx` (rail = `Your work` heading; 2×3 generator tile grid `Quiz · Mock exam · Flashcards · Essay feedback · Study guide · Slides`; **remove Audio Overview**; saved work list with `Skeleton`)
- Modify: `src/studio/generators/*.tsx` (config forms use `Field/Input/Segmented/Button`; result views use `--text-read`), `src/studio/generators/AidsFlow.tsx` split into `DocGenerator.tsx` (guide/brief/faq/timeline), `FlashcardsFlow.tsx`, `SlidesFlow.tsx`
- Modify: `src/studio/SettingsModal.tsx` (1,682 lines → `settings/SettingsSheet.tsx` using `Sheet`, `settings/AppearanceSection.tsx`, `settings/TypographySection.tsx`, `settings/ModelsSection.tsx`, `settings/KeyVault.tsx`, `settings/SignIns.tsx`, `settings/PlanSection.tsx`, `settings/DataSection.tsx`) — `SettingsTab` type and `open/initialTab/onClose` props unchanged so `Workspace`/`DeskShell` callers compile
- Delete: `src/studio/ui.tsx` (after all imports point at `src/ui`), the `--font-display/--font-body/--brasspale/--brassdeep` aliases in `tokens.css`
- Modify: `src/styles/scale.test.ts` → un-skip, ceiling 0 outside `src/landing/`; `src/styles/tells.test.ts` (create) per Spec §8 (no `uppercase` outside `<kbd>`, no ` · ` in TSX strings, no `→` in button text, no `label-mono`)

- [ ] **Step 1:** write `tells.test.ts`; run → FAIL with counts (138 / 124 / 7 / 46).
- [ ] **Step 2:** migrate file by file; every uppercase label becomes sentence case `--text-sm --muted`; every ` · ` becomes a second `Chip` or a comma; `label-mono` removed.
- [ ] **Step 3:** `scale.test`, `tells.test`, `palette.test`, `tokens.test` all green; `pnpm build`; the `/studio` chunk should already drop below 1 MB because the settings sheet is lazy (`lazy(() => import("./settings/SettingsSheet"))`).
- [ ] **Step 4: Commit** — `git commit -am "feat(studio): rail, generators, and settings on the kit; guard tests for type scale and generated-UI tells"`

**Phase 2 exit:** launch-check green (including impeccable 0 warnings); `/studio/kit` renders every primitive state in both themes; before/after screenshots for shelf, sources, chat, rail, settings.

---

## Phase 3 — Shells, header, capabilities, state

### Task 3.1: One shell, one header

**Files:**
- Delete: `src/studio/ConsoleShell.tsx`, `src/studio/console-shell.css`, `src/studio/ConsoleShell.test.tsx`, `src/studio/console-shell.test.ts` (from Task 0.3 — replace its assertion with the file-absence check in `tells.test.ts`)
- Create: `src/studio/DeskHeader.tsx` (back to shelf · editable title · notebook menu `⋯` (Rename, Analytics, Share, Export, Delete) · session timer slot (Task 6.4) · model chip → `openSettings("models")` · gear → `openSettings()`), `src/studio/DeskHeader.test.tsx`
- Modify: `src/studio/Workspace.tsx` (remove `WorkspaceHeader` + `ConsoleShell`; pane grid via CSS `grid-template-columns: var(--pane-sources) 1fr var(--pane-studio)` animated with `--ease-inout`), `src/studio/DeskShell.tsx` (owns theme/chrome/reading effects, shortcuts, palette, companion mount **inside the Sources pane footer slot**), `src/studio/Titlebar.tsx` (Tauri-only, unchanged behavior)
- Modify: `src/studio/studio-route.test.tsx` (drop the `ConsoleShell` mock)

- [ ] **Step 1:** `DeskHeader.test.tsx`: renders ≤ 5 buttons; gear opens `Settings`; model chip opens `AI models`.
- [ ] **Step 2:** build; verify the mobile bottom tab bar (Sources / Chat / Work) at `sm` with `env(safe-area-inset-bottom)`.
- [ ] **Step 3: Commit** — `git commit -am "refactor(shell): one DeskShell and one DeskHeader; ConsoleShell removed"`

### Task 3.2: Companion as a quiet accent

**Files:**
- Modify: `src/studio/companion/DeskLife.tsx` (mount point = Sources footer slot; default `companion: false` for new installs in `settings.ts` migrate; max sprite height 56 px; no overlap possible), `src/components/pixel/PixelBatteryCompanion.tsx` (remove drag-to-anywhere; keep moods), `src/studio/companion/StudyFocusDock.tsx` (ring colors → `brass / moon / sage / candle` tokens only; remove the `palette.test.ts` allow-list entry), `src/studio/companion/companion.css`
- Modify: `src/components/pixel/PixelBatteryCompanion.test.tsx`, `src/studio/companion/lampPos.test.ts` (delete — position persistence is gone), `src/lib/milestones.ts` copy to voice rules

- [ ] Steps: update tests → implement → `git commit -am "feat(companion): docked, optional, token-colored"`

### Task 3.3: Capability-aware composer

**Files:**
- Create: `src/lib/capabilities.ts`, `src/lib/capabilities.test.ts`
- Modify: `src/studio/Composer.tsx` (hide `Think` when `!caps.thinking`; hide `Web` when `!caps.web`; hide mic when `!caps.voice`), `src/studio/generators/QuizFlow.tsx`/`ExamFlow.tsx` (offer `solution` format only when `caps.vision`)

**Interfaces — Produces:**

```ts
export interface Capabilities { thinking: boolean; vision: boolean; web: boolean; voice: boolean }
export function capabilitiesFor(cs: CallSettings, env: { hasSearchRelay: boolean; hasSpeech: boolean }): Capabilities;
// anthropic + claude-oauth: thinking true, vision true; codex: thinking true (effort), vision true for gpt-5.x;
// openai-compatible: thinking false unless model id matches /o[0-9]|reason|r1|thinking/i, vision false unless /vision|omni|4o|gemini|claude|gpt-5/i
```

- [ ] Steps: table-driven test over the four `ProviderId`s → implement → wire → `git commit -am "feat(models): capability flags drive the composer"`

### Task 3.4: Split `llm.ts` by provider

**Files:**
- Create: `src/lib/llm/index.ts` (re-exports the current public API: `MODELS, EFFORTS, COMPAT_PRESETS, CallSettings, streamChat, generateJSON, generateMarkdown, checkSolution, validateConnection, listCompatModels, friendlyError, isAbort, parseJSON, modelLabelFor, effortLabelFor, extractTextCitations`), `src/lib/llm/anthropic.ts`, `src/lib/llm/codex.ts`, `src/lib/llm/compat.ts`, `src/lib/llm/prompts.ts` (`CHAT_SYSTEM`, `CHAT_SYSTEM_COMPAT`, `CHECK_SYSTEM`), `src/lib/llm/json.ts` (`parseJSON` + a fenced-JSON extractor with one unit test per failure shape: code fence, leading prose, trailing commas)
- Delete: `src/lib/llm.ts`; every `from "../lib/llm"` import keeps working via the folder index.

- [ ] Steps: move code without behavior change; `pnpm exec vitest run src/lib` green; `git commit -am "refactor(llm): split by provider; shared prompts and JSON parsing"`

### Task 3.5: Remove stub UI and dead settings

**Files:**
- Modify: `src/studio/StudioPane.tsx` (Audio Overview card gone — done in 2.5; confirm), `src/studio/generators/AudioOverviewFlow.tsx` → delete with its `GenerationKind` `"audio-overview"` kept in the type for old rows (render as a plain note), `src/lib/types.ts` comment
- Modify: `src/studio/UsageLimitsPanel.tsx`, `FreeLimitWarningModal.tsx` copy to voice rules

- [ ] `git commit -am "chore(studio): remove the audio-overview stub"`

### Task 3.6: Split `Workspace.tsx` responsibilities

Already reduced by 3.1; ensure `Workspace.tsx` < 300 lines: layout grid + pane composition only. Drag-and-drop import moves to `src/studio/useDropImport.ts`. Analytics/Share move to `src/studio/NotebookMenu.tsx`.

- [ ] `git commit -am "refactor(desk): Workspace composes panes; drop-import and notebook menu extracted"`

### Task 3.7: One preferences module

**Files:**
- Create: `src/lib/prefs.ts`, `src/lib/prefs.test.ts`
- Modify: every `localStorage.getItem/setItem("comtus…")` call site (21 keys; `rg -n "comtus[:_-]" src`)

**Interfaces — Produces:**

```ts
export const PREF_KEYS = {
  layout: "comtus:layout", lastNotebook: "comtus:last-notebook", lastChat: "comtus:last-chat:",
  sourcesWidth: "comtus:sources-width", studioWidth: "comtus:studio-width",
  onboardingSeen: "comtus:onboarding-seen", freeLimitHit: "comtus:free-limit-hit",
  sfxVol: "comtus:sfx-vol", ambientVol: "comtus:ambient-vol", ambientType: "comtus:ambient-type",
  audioMuted: "comtus:audio-muted", railCollapsed: "comtus:rail-collapsed",
  kickstart: "comtus:kickstart", orVerifier: "comtus:or-verifier",
  claudeOAuth: "comtus:claude-oauth", codexOAuth: "comtus:codex-oauth",
  chunkReloadAt: "comtus:chunk-reload-at",
} as const;
export function readPref<T>(key: PrefKey, parse: (raw: string) => T, fallback: T): T;
export function writePref(key: PrefKey, value: string): void;
export function migrateLegacyPrefs(): void; // maps comtus_kickstart→comtus:kickstart, comtus-layout→comtus:layout, etc.; idempotent
```

Deleted keys: `comtus:battery_pos`, `comtus:lamp_pos`, `comtus:ignite`, `comtus:focus-changed` (event names move to `activity.ts` constants).

- [ ] Steps: red test for `migrateLegacyPrefs` → implement → replace call sites → `git commit -am "refactor(prefs): typed key registry with one-time legacy migration"`

### Task 3.8: Route-level code splitting

**Files:**
- Modify: `src/studio/StudioPane.tsx` (`lazy()` each generator flow), `src/studio/ExportMenu.tsx` (dynamic `import("../lib/pdfExport")`, `import("../lib/pptxExport")`), `src/lib/markdownMath.ts` (lazy `katex` CSS/plugins behind a `hasMath(text)` check), `vite.config.ts` manual chunks (`vendor-export: ["jspdf","pptxgenjs"]`, `vendor-math: ["katex","rehype-katex","remark-math"]`)

- [ ] **Verify:** `pnpm build` → `/studio` entry chunk < 600 kB gzip; record sizes in the commit body. `git commit -am "perf(studio): lazy generators, exports, and math"`

**Phase 3 exit:** launch-check green; desk screenshots (1440/390, both themes); bundle sizes recorded.

---

## Phase 4 — Landing rebuilt (Persuade mode)

### Task 4.1: Replace the landing

**Files:**
- Delete: `src/landing/{CantorShowcase,CantorShowcase.test,CantorCircuitStream,CantorPixelTransition,CantorStringsCanvas,CognitiveTelemetryGrid,ScholarConsoleDeck,SectionTorch,TorchLayer,Preloader,PreLandingOnboarding,PreLandingOnboarding.test,OnboardingModal,OnboardingModal.test,LandingPlay,TiltCard,Magnetic?}.tsx`, `src/landing/{cantor-theme,scholar-deck,pixel-landing,landing}.css`, `src/landing/pixel-landing.test.ts`, `src/landing/pixelMotion.ts`, `src/components/CustomCursor.tsx`, `src/components/PixelTorch.tsx`, `src/components/Magnetic.tsx` (check `fx.tsx` import first — inline the 50 lines if the studio still uses `Magnetic`), `src/lib/torchState.ts`
- Create: `src/landing/LandingPage.tsx` (rewrite), `src/landing/LandingHero.tsx`, `src/landing/DeskDemo.tsx` (read-only desk with two bundled sample sources and a canned streamed answer from `src/landing/demoTranscript.ts` — no key required), `src/landing/HowItGoes.tsx`, `src/landing/WhatItMakes.tsx`, `src/landing/StaysOnDevice.tsx`, `src/landing/landing.css` (rewrite, < 250 lines), `src/landing/Landing.test.tsx` (rewrite)
- Modify: `src/landing/Nav.tsx` (three links: Guide, Privacy, `Open the desk`), `src/landing/FAQSection.tsx` (restyle only; question set kept), `src/landing/Footer.tsx`, `src/landing/FinalCTA.tsx`, `src/landing/Statement.tsx` (fold into `LandingHero` or delete), `src/landing/SectionHead.tsx` (delete — no eyebrows), `src/landing/SectionDivider.tsx` (single hairline)
- Modify: `src/landing/OpenRouterByokSection.tsx` → move to `src/guide/ModelsGuide.tsx` at route `/guide/models` (Read mode, Literata prose, a plain table of free models with copyable ids, **no emoji, no tiers-as-buttons**); `src/App.tsx` adds the route
- Modify: `package.json` (`pnpm remove gsap lenis`), `vite.config.ts` (drop `vendor-gsap`)
- Modify: `public/sitemap.xml`, `index.html` meta description to the new tagline

Anatomy and rules: Spec §6.1. Copy for the hero (final; do not paraphrase into marketing): headline **Rough thought, polished.** Sub: **Study from your own sources. Every answer cites the page it came from.** Button: **Open the desk**. Sentence under the button: **Bring your own key, or sign in with Claude or ChatGPT.** Section headings: **How a night at the desk goes** · **What the desk makes for you** · **Your sources stay on this device** · **Questions students ask**.

- [ ] **Step 1:** `Landing.test.tsx` red: renders the four headings above; no element with `text-transform: uppercase` in the hero; exactly one primary button in the hero; no `img[alt=""]` decorative-only heroes (the demo is real DOM).
- [ ] **Step 2:** implement; the only ambient motion is `DeskDemo` streaming its transcript (respects reduced motion by rendering the finished answer).
- [ ] **Step 3:** `pnpm exec vitest run src/landing`, `pnpm build` (landing chunk < 250 kB gzip), impeccable 0 warnings, Lighthouse-style check: `pnpm dlx impeccable@3.6.1 detect http://127.0.0.1:5199/` via the running preview.
- [ ] **Step 4:** screenshots 1440/390, Daylight/Lamplight.
- [ ] **Step 5: Commit** — `git commit -am "feat(landing): rebuild as one scholar's desk; delete console/pixel worlds, gsap, lenis"`

### Task 4.2: Static pages on the reading measure

**Files:** `src/landing/StaticPages.tsx` (About, Privacy, Terms, Responsible AI, Contact, Study Companion Guide) → Literata `--text-read`, `68ch`, one shared `ReadPage` layout; copy pass for voice rules (no "cognitive infrastructure").

- [ ] `git commit -am "feat(pages): static pages on the reading measure"`

**Phase 4 exit:** launch-check green; landing before/after screenshots; `/guide/models` renders.

---

## Phase 5 — Desktop uses the same desk

### Task 5.1: Delete `src/desk`

**Files:**
- Delete: `src/desk/DeskApp.tsx`, `src/desk/DeskHome.tsx`, `src/desk/LibraryRail.tsx`, `src/desk/NotebookDesk.tsx`
- Modify: `src/studio/StudioApp.tsx` (remove the `isDeskShell()` branch; Tauri renders `Shelf`/`Workspace` like the web), `src/studio/DeskShell.tsx` (Tauri-only concerns remain: `Titlebar`, `useUpdater`, `UpdateToast`, native file dialogs via `desk.requestImport`), `src/studio/studio-route.test.tsx` (drop the `../desk/DeskApp` mock), `README.md` structure block, `scripts/smoke-tauri-cdp.mjs` selectors

- [ ] `pnpm exec tsc --noEmit && pnpm lint && pnpm test`; `pnpm build:tauri` compiles; `git commit -am "refactor(desktop): one product surface; delete src/desk"`

**Phase 5 exit:** launch-check green; `pnpm build:tauri` green.

---

## Phase 6 — Learning engine (Dexie v3)

### Task 6.1: FSRS cards, review log, and the Today queue

**Files:**
- Modify: `package.json` (`pnpm add ts-fsrs@^5.4.2`)
- Modify: `src/lib/types.ts` (add `Card`, `ReviewLog`, `Attempt`, `StudySession` exactly as Spec §7.1; keep `CardProgress` for the migration only)
- Modify: `src/lib/db.ts` (`this.version(3).stores({ …existing, cards: "id, notebookId, generationId, due, state", reviewLogs: "id, cardId, notebookId, review", attempts: "id, notebookId, generationId, topic, answeredAt", sessions: "id, notebookId, startedAt" }).upgrade(convertCardProgress)`; `deleteNotebook` cascades the new tables)
- Create: `src/lib/srs.ts`, `src/lib/srs.test.ts`
- Create: `src/studio/today/TodayPage.tsx`, `src/studio/today/ReviewCard.tsx`, `src/studio/today/Today.test.tsx`; route `/studio/today` in `src/App.tsx`
- Modify: `src/studio/generators/FlashcardsFlow.tsx` (from Task 2.5): on generation, `db.cards.bulkPut(cards.map(toNewCard))`; the in-notebook review uses the same `rate()`
- Modify: `src/studio/Shelf.tsx` (`Today (n)` chip → `/studio/today`), `src/studio/StudioPane.tsx` (`Today: n due` line above the generator grid)

**Interfaces — Produces:**

```ts
// src/lib/srs.ts
import { createEmptyCard, fsrs, Rating, type Grade } from "ts-fsrs";
export const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true });
export function toNewCard(input: { id: string; notebookId: string; generationId: string; front: string; back: string; topic?: string; sourceId?: string; startChar?: number; endChar?: number }, now?: Date): Card;
export function rateCard(card: Card, grade: Grade, now?: Date): { card: Card; log: ReviewLog };  // wraps scheduler.next(card, now, grade)
export function previewIntervals(card: Card, now?: Date): Record<Grade, number>;                 // scheduled_days per grade for the four buttons
export async function dueCards(now?: Date, notebookId?: string): Promise<Card[]>;               // db.cards.where("due").belowOrEqual(now) sorted by due
export function convertCardProgress(cp: CardProgress, flash: Flashcard, notebookId: string): Card; // ease→difficulty: clamp(11 - ease*2, 1, 10); intervalDays→stability; dueAt→due; reps→reps; state = reps>0 ? 2 : 0
export { Rating };
```

- [ ] **Step 1: Failing tests** for `rateCard` (Good on a new card yields `state` Learning/Review and `due` > now; Again keeps `due` within a day; `log.rating` recorded), `previewIntervals` (monotonic Again < Hard < Good < Easy), `convertCardProgress` (a reviewed SM-2 card maps to `state 2` with `stability === intervalDays`), and the v3 upgrade using `fake-indexeddb` (seed one `cardProgress` row on a v2 db, open v3, expect one `cards` row).
- [ ] **Step 2:** implement `srs.ts` and the migration.
- [ ] **Step 3:** `TodayPage`: one card, flip on Space, rate with `1–4` or buttons showing `previewIntervals` (`in 1d`, `in 4d`…), progress line `7 of 12`, end summary listing notebooks/topics with the most `Again` ratings and a single sentence: "Tomorrow: 9 cards due." `Today.test.tsx`: seeds three due cards, rates them, asserts the summary and that `reviewLogs` has three rows.
- [ ] **Step 4:** screenshots of Today at 1440/390.
- [ ] **Step 5: Commit** — `git commit -am "feat(srs): FSRS scheduling with review log and a cross-notebook Today queue (Dexie v3)"`

### Task 6.2: Persist attempts

**Files:**
- Modify: `src/studio/generators/QuizFlow.tsx` (in the check handler that calls `isCorrect(q, picked[idx], typed[idx])` at ~`:426` and the solution path at `:215`, write one `Attempt` via `recordAttempt`), `src/studio/generators/ExamFlow.tsx` (on `setFinished(true)` at `:404`, write one `Attempt` per item)
- Create: `src/lib/attempts.ts`, `src/lib/attempts.test.ts`

```ts
export async function recordAttempt(a: Omit<Attempt, "id" | "answeredAt">): Promise<void>;
export async function topicAccuracy(notebookId: string, sinceMs?: number): Promise<{ topic: string; attempts: number; accuracy: number }[]>; // accuracy = sum(credit)/attempts, topics with ≥ 3 attempts, ascending
```

- [ ] Steps: red tests (record → topicAccuracy orders weakest first; ignores topics with < 3 attempts) → implement → wire → `git commit -am "feat(attempts): persist quiz and exam outcomes"`

### Task 6.3: Weak spots and targeted generation

**Files:**
- Create: `src/studio/WeakSpots.tsx` (in the `Your work` rail under Today: up to five topics with accuracy as a plain number and a `Drill` button), `src/studio/WeakSpots.test.tsx`
- Modify: `src/studio/generators/common.ts` (`buildSourceBlock(notebookId, query, opts?: { topics?: string[] })` → adds `Focus these topics: …` to the user prompt), `QuizFlow.tsx`/`ExamFlow.tsx` config forms accept `initialTopics`; `Drill` opens the quiz form with the topic prefilled
- Modify: chat starter "Make me a 10-item quiz on the hardest part" → when `topicAccuracy` is non-empty, expands to the weakest topic names

- [ ] `git commit -am "feat(study): weak spots derived from attempts and card ratings; targeted drills"`

### Task 6.4: Study sessions

**Files:**
- Create: `src/lib/sessions.ts` (`startSession(notebookId?)`, `endSession()`, `activeSession()` in zustand, `bump("cardsReviewed" | "itemsAttempted")`), `src/lib/sessions.test.ts`
- Modify: `src/studio/DeskHeader.tsx` (session slot: `Start session` ghost button → running `mm:ss` in mono with a quiet `End`), `src/lib/srs.ts` and `src/lib/attempts.ts` (bump counters), `src/lib/milestones.ts` (derive `night-watch`, `seven-nights`, `ten-works` from `sessions`/`attempts` instead of localStorage heuristics), `src/studio/companion/StudyFocusDock.tsx` (delete the hidden Pomodoro; the header owns the timer)

- [ ] `git commit -am "feat(sessions): study sessions with a header timer; milestones derive from real activity"`

### Task 6.5: Page-anchored citations

**Files:**
- Modify: `src/lib/import.ts` (`chunkText` returns `{ text, startChar, endChar }`; PDF path records `page` per chunk from `pdfjs` page boundaries; PPTX/DOCX leave `page` undefined), `src/lib/types.ts` (`Chunk.page?`, `Chunk.startChar`, `Chunk.endChar` — non-breaking: v3 upgrade backfills `startChar/endChar` from `idx` by re-chunking `Source.content`)
- Modify: `src/lib/retrieval.ts` (`GroundingDoc` carries `anchors: { page?: number; startChar: number; endChar: number }[]` for the stitched chunks), `src/lib/llm/index.ts` (`extractTextCitations` resolves `startChar/endChar` from the anchor set), `src/studio/SourceReader.tsx` (scroll to `startChar`, highlight with `--brass-pale` at 25% fading over `--dur-settle`; page marker shows `p. 112`)
- Tests: `src/lib/import.test.ts` (chunk offsets are contiguous and cover the text), `src/lib/retrieval.test.ts` (anchors preserved), `src/studio/SourceReader.test.tsx` (navigating to a citation sets the highlight on the right span)

- [ ] `git commit -am "feat(citations): chunks carry page and character anchors; the reader opens the exact passage"`

**Phase 6 exit:** launch-check green; Today, weak spots, session timer, and anchored citations verified in the browser with screenshots and a short recording of: add source → ask → click `[1]` → reader highlights → make flashcards → rate three in Today.

---

## Verification (whole plan)

1. `bash scripts/launch-check.sh` — tsc, lint, vitest (< 120 s), build, impeccable 0 warnings.
2. `pnpm build` sizes: `/studio` entry < 600 kB gzip, landing < 250 kB gzip.
3. Browser pass on `pnpm dev` (port 5199), both themes, 1440 and 390:
   `/` · `/guide/models` · `/studio` · `/studio/:id` (empty, with sources, streaming via `scripts/mock-llm.mjs`, citation click) · `/studio/today` · settings sheet · `/studio/kit` (dev only).
4. Keyboard-only pass: Tab order through DeskHeader → Sources → Composer → Work; Escape closes Sheet/Dialog; `1–4` rate in Today; `Ctrl/⌘+K` palette; `Ctrl/⌘+,` settings.
5. Reduced-motion pass: OS setting on → no ambient loops; demo transcript renders complete.
6. Data migration pass: load a v2 database (export from current `main` via Settings → Data → Export), open the new build, confirm notebooks, sources, chat, and converted cards appear; Today lists due cards.
7. Update `BRAND.md` (§2 motif, §3 palette, §4 typography, §8 surfaces) and create `CONTEXT.md` with the Spec §5.5 glossary and an ADR list (`docs/adr/0001-single-token-source.md`, `0002-fsrs-scheduling.md`, `0003-one-product-surface.md`) so `docs/agents/domain.md` has something to read.

## Self-review against the spec

- Spec §2.1 T1–T7 → Tasks 1.1, 1.2, 1.3, 2.5. §2.2 B1–B8 → 0.3, 1.4, 2.5, 4.1. §2.3 A1–A9 → 0.1, 0.2, 0.5, 0.6, 3.1, 3.4, 3.6, 3.7, 5.1. §2.4 P1–P7 → 3.3, 3.5, 6.1–6.5. §2.5 → 2.5 tells test + 4.1/4.2 copy. §2.6 F1–F3 → 0.4, 1.5, 3.8. §6.1–6.8 → 4.1, 2.2, 3.1/2.3/2.4/2.5, 6.1, 2.5 settings, 1.4, 1.5, 2.1. §7 → Phase 6. §8 gates → 0.1, 1.1, 1.4, 2.5, 3.8.
- Names used across tasks: `Card`, `ReviewLog`, `Attempt`, `StudySession` (6.1–6.4 ↔ Spec §7.1); `useBreakpoint`/`Breakpoint` (1.5 ↔ 3.1); `Capabilities`/`capabilitiesFor` (3.3 ↔ 2.4); `Sheet`/`Dialog`/`Button` (2.1 ↔ 2.2–2.5, 3.1); `openSettings(tab?: SettingsTab)` (0.4 ↔ 3.1); `PREF_KEYS` (3.7 ↔ 3.1/3.2); `toNewCard`/`rateCard`/`dueCards` (6.1 ↔ 6.3/6.4).
