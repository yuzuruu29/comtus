import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CRISP, DUR, SPRING } from "../studio/fx";

/** The motion contract, enforced.
 *
 *  Three things a reader cannot check by eye:
 *
 *  1. The ambient-loop list in the "minimal" tier and the ambient-loop list
 *     under prefers-reduced-motion are the same list. They are written twice
 *     because CSS cannot share a selector list across a media query, so
 *     without this they would drift: a loop added to one tier and not the
 *     other would keep moving for the visitors who asked it to stop.
 *
 *  2. Every exported spring is critically damped. BRAND.md 5 forbids bounce,
 *     and a spring with a damping ratio below 1 overshoots — a panel that
 *     springs past its resting place is exactly the bounce the brand refuses.
 *
 *  3. The motion ladder the JS layer uses matches the CSS ladder, so a
 *     menu and a menu item settle at the same speed.
 */

const INDEX_CSS = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
const TOKENS_CSS = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function tsxFiles(): string[] {
  return readdirSync(join(process.cwd(), "src"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((rel) => `src/${rel.split("\\").join("/")}`);
}

/** Selectors of the ambient loops: the lamp, the dust, the thinking
 *  shimmer, the waiting dots, the answer's caret. Informational loops (the
 *  button spinner, the skeleton shimmer, the toast fuse, progress bars) are
 *  not ambient — they carry information, so they keep running in every tier. */
const AMBIENT = [
  ".breathe",
  ".send-halo",
  ".bar-sheen",
  ".studio-motes span",
  ".thinking-live",
  ".typing-harmonic-dot",
  ".stream-typing-beacon",
];

/** Pulls the selector list out of a rule block by its anchor selector. */
function selectorsIn(anchor: string, scope?: string): string[] {
  const scopeAt = scope ? INDEX_CSS.indexOf(scope) : 0;
  expect(scopeAt, `no ${scope ?? anchor} block in src/index.css`).toBeGreaterThan(-1);
  const start = INDEX_CSS.indexOf(anchor, scopeAt);
  expect(start, `no ${anchor} selector in src/index.css`).toBeGreaterThan(-1);
  const open = INDEX_CSS.indexOf("{", start);
  const body = INDEX_CSS.slice(start, open);
  return body
    .split(",")
    .map((selector) => selector.trim().replace(/^html\[data-motion="[^"]+"\]\s*/, ""))
    .filter(Boolean);
}

describe("motion tiers", () => {
  it("stops the same ambient loops under the minimal tier and under reduced motion", () => {
    const minimal = selectorsIn('html[data-motion="minimal"] .breathe', 'html[data-motion="minimal"] .breathe');
    const reduced = selectorsIn(".breathe", "@media (prefers-reduced-motion: reduce)");
    expect(minimal.sort()).toEqual(reduced.sort());
  });

  it("lists every ambient loop the contract names", () => {
    const minimal = selectorsIn('html[data-motion="minimal"] .breathe', 'html[data-motion="minimal"] .breathe');
    for (const selector of AMBIENT) {
      expect(minimal, `${selector} is missing from the ambient list`).toContain(selector);
    }
  });

  it("keeps informational loops running in every tier", () => {
    const minimal = selectorsIn('html[data-motion="minimal"] .breathe', 'html[data-motion="minimal"] .breathe');
    for (const selector of [".btn-spinner", ".skeleton", ".toast-fuse"]) {
      expect(minimal).not.toContain(selector);
    }
  });
});

describe("house springs", () => {
  const zeta = (spring: { stiffness: number; damping: number; mass?: number }) => {
    const mass = spring.mass ?? 1;
    return spring.damping / (2 * Math.sqrt(spring.stiffness * mass));
  };

  it.each([
    ["SPRING", SPRING],
    ["CRISP", CRISP],
  ])("%s does not overshoot", (_name, spring) => {
    // A damping ratio of 1 is critically damped: it settles without ever
    // passing its target. Anything below 0.98 shows a visible bounce.
    expect(zeta(spring)).toBeGreaterThanOrEqual(0.98);
  });

  it("keeps every inline spring override non-overshooting", () => {
    // A spring written inline is not covered by the exports above, and an
    // inline spring is exactly where a bounce sneaks back in.
    const inline = /stiffness:\s*([0-9.]+)\s*,\s*damping:\s*([0-9.]+)(?:\s*,\s*mass:\s*([0-9.]+))?/g;
    const offenders: string[] = [];
    for (const rel of tsxFiles()) {
      const source = readFileSync(join(process.cwd(), rel), "utf8");
      for (const match of source.matchAll(inline)) {
        const stiffness = Number(match[1]);
        const damping = Number(match[2]);
        const mass = match[3] ? Number(match[3]) : 1;
        if (zeta({ stiffness, damping, mass }) < 0.98) {
          offenders.push(`${rel}: stiffness ${stiffness}, damping ${damping}, mass ${mass}`);
        }
      }
    }
    expect(offenders, "inline springs that overshoot").toEqual([]);
  });
});

describe("motion ladder", () => {
  it("matches the CSS duration tokens", () => {
    const ladder: [keyof typeof DUR, string][] = [
      ["fast", "--dur-fast"],
      ["med", "--dur-med"],
      ["slow", "--dur-slow"],
      ["glow", "--dur-glow"],
      ["settle", "--dur-settle"],
    ];
    for (const [step, token] of ladder) {
      const declared = new RegExp(`${token}:\\s*([0-9]+)ms`).exec(TOKENS_CSS);
      expect(declared, `${token} is not declared in tokens.css`).not.toBeNull();
      expect(DUR[step]).toBeCloseTo(Number(declared![1]) / 1000, 5);
    }
  });
});
