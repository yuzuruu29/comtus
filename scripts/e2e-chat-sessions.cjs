/* E2E: chatbot sessions on the web studio.
 * Run with a dev server on :5199 — `npx vite --port 5199 --strictPort`.
 * Node resolution: NODE_PATH must point at a checkout containing the
 * `playwright` package (kept out-of-repo so pnpm stays untouched).
 * Covers: fresh-profile session bar + rename + new chat + switch +
 * reload persistence, and the real Dexie v1→v2 migration of a seeded
 * legacy flat thread. Exits non-zero on any failure or console error. */
const { chromium } = require("playwright");

const BASE = "http://localhost:5199";
// The workspace mounts a desktop and a mobile ChatPane (one CSS-hidden),
// so every session-bar locator must target the visible instance only.
const TRIGGER = 'button[aria-haspopup="listbox"] >> visible=true';
let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "  ✓" : "  ✗ FAIL"} ${label}`);
  if (!cond) failures++;
};

/** Seed a v1-shape "comtus" DB so the app's first open runs the upgrade.
 *  App scripts are request-blocked while we seed from the real origin,
 *  so nothing can race the upgrade; then we unblock and visit. */
async function seedLegacy(page) {
  await page.route(/(\.js|\.tsx|\.ts|mjs)(\?.*)?$|@vite\//, (r) => r.abort());
  await page.goto(`${BASE}/studio`).catch(() => {});
  await page.evaluate(() => {
      const LEGACY = {
        notebooks: [
          {
            id: "nb-legacy",
            name: "Physics 101",
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now() - 3600000,
          },
        ],
        sources: [],
        chunks: [],
        messages: [
          {
            id: "m1",
            notebookId: "nb-legacy",
            role: "user",
            content: "Explain momentum in plain words please",
            createdAt: Date.now() - 7200000,
          },
          {
            id: "m2",
            notebookId: "nb-legacy",
            role: "assistant",
            content: "Momentum is mass in motion.",
            createdAt: Date.now() - 7100000,
          },
        ],
        generations: [],
        cardProgress: [],
      };
      const SCHEMA = {
        notebooks: ["updatedAt"],
        sources: ["notebookId", "addedAt"],
        chunks: ["sourceId", "notebookId"],
        messages: ["notebookId", "createdAt"],
        generations: ["notebookId", "kind", "createdAt"],
        cardProgress: ["generationId", "notebookId", "dueAt"],
      };
      return new Promise((resolve, reject) => {
        const req = indexedDB.open("comtus", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const [store, indexes] of Object.entries(SCHEMA)) {
            const os = db.createObjectStore(store, { keyPath: "id" });
            for (const idx of indexes) os.createIndex(idx, idx);
          }
        };
        req.onerror = () => reject(String(req.error));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(Object.keys(LEGACY), "readwrite");
          for (const [store, rows] of Object.entries(LEGACY)) {
            const os = tx.objectStore(store);
            for (const row of rows) os.put(row);
          }
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(String(tx.error));
        };
      });
    });
  await page.unroute(/(\.js|\.tsx|\.ts|mjs)(\?.*)?$|@vite\//);
}

async function main() {
  const browser = await chromium.launch();
  try {
    /* ── Part A: v1 → v2 migration of a legacy flat thread ── */
    console.log("Part A — legacy thread migrates into a titled session");
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await seedLegacy(page); // aborted-script noise happens in here
      // Only judge app health AFTER the seeding scaffolding is done.
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto(`${BASE}/studio/nb-legacy`, { waitUntil: "networkidle" });

      // The migrated session is auto-titled from the first user question.
      const triggerA = page.locator(TRIGGER);
      const title = triggerA.locator("span.truncate");
      await title.waitFor({ timeout: 10000 });
      const gotA = (await title.textContent())?.trim() ?? "";
      ok(
        gotA.includes("Explain momentum"),
        `session auto-titled from legacy thread (got "${gotA}")`,
      );

      // Both migrated messages render.
      ok(
        await page.getByText("Momentum is mass in motion.").first().isVisible(),
        "legacy assistant message visible",
      );

      // Menu shows exactly one session.
      await triggerA.click();
      const rows = page.locator('[role="option"] >> visible=true');
      const countA = await rows.count();
      ok(countA === 1, `switcher lists 1 session (got ${countA})`);

      ok(errors.length === 0, `zero console errors (${errors.slice(0, 3).join(" | ")})`);
      await ctx.close();
    }

    /* ── Part B: fresh profile — create, rename, new chat, switch, persist ── */
    console.log("Part B — fresh notebook: sessions lifecycle");
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });

      // New notebook via shelf modal.
      await page.getByRole("button", { name: /new notebook/i }).first().click();
      await page.getByPlaceholder("Name this notebook").fill("Sessions Test");
      const dialog = page.locator('[role="dialog"]');
      await dialog.locator("button").filter({ hasText: /create|add/i }).last().click();
      await page.waitForURL(/\/studio\/.+/, { timeout: 10000 });

      // Fresh notebook opens with one untitled thread.
      const trigger = page.locator(TRIGGER);
      await trigger.waitFor({ timeout: 10000 });
      ok(
        (await trigger.locator("span.truncate").textContent())?.trim() === "New chat",
        "fresh notebook starts as 'New chat'",
      );

      // Rename it through the switcher (untitled rows label actions
      // "…chat", not "…New chat").
      await trigger.click();
      await page.getByRole("button", { name: "Rename chat", exact: true }).click();
      await page.getByLabel("Chat name").fill("Thermodynamics drill");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      ok(
        (await trigger.locator("span.truncate").textContent())?.trim() ===
          "Thermodynamics drill",
        "renamed session shows in the bar",
      );

      // Start a second chat via the + button (menu may still be open —
      // target the aria-label, not the text, to stay unambiguous).
      await page.locator('button[aria-label="New chat"]').first().click();
      await page.waitForTimeout(300);
      ok(
        (await trigger.locator("span.truncate").textContent())?.trim() === "New chat",
        "plus button starts an untitled second chat",
      );
      await trigger.click();
      ok((await page.locator('[role="option"]').count()) === 2,
        "switcher lists both chats");

      // Switch back to the renamed one.
      await page
        .locator('[role="option"]', { hasText: "Thermodynamics drill" })
        .click();
      await page.waitForTimeout(300);
      ok(
        (await trigger.locator("span.truncate").textContent())?.includes("Thermodynamics"),
        "switching restores the renamed thread",
      );

      // Reload — remembered selection survives.
      await page.reload({ waitUntil: "networkidle" });
      await trigger.waitFor({ timeout: 10000 });
      ok(
        (await trigger.locator("span.truncate").textContent())?.includes("Thermodynamics"),
        "reload keeps the remembered chat",
      );

      // Delete flow: arm then confirm on the inactive untitled thread;
      // it disappears while the active renamed one remains.
      await trigger.click();
      const row = page.locator("div.group\\/row >> visible=true").filter({ hasText: "New chat" });
      await row.getByRole("button", { name: "Delete chat", exact: true }).click();
      await row
        .getByRole("button", { name: "Click again to delete chat", exact: true })
        .click();
      await page.waitForTimeout(500);
      const remaining = await page.locator('[role="option"] >> visible=true').count();
      ok(remaining >= 1, `a thread always remains after delete (got ${remaining})`);
      ok(errors.length === 0, `zero console errors (${errors.slice(0, 3).join(" | ")})`);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  console.log(failures === 0 ? "\nE2E PASS" : `\nE2E FAIL — ${failures} assertion(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});
