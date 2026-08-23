import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const artifactDir = "C:/Users/uzzie/.gemini/antigravity/brain/df31abd4-689e-42f0-9fe1-251fd0293c50";

console.log("Launching Edge headless...");
const profile = join(tmpdir(), `comtus-shot-${Date.now()}`);
mkdirSync(profile, { recursive: true });
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const child = spawn(edge, [
  "--headless=new",
  "--remote-debugging-port=9448",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-gpu",
  "--window-size=1440,920",
  "about:blank",
]);

process.on("exit", () => {
  try { child.kill(); } catch {}
});

let target;
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9448/json/list")).json();
    target = list.find((t) => t.type === "page");
    if (target) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}

if (!target) {
  console.error("Could not reach Edge CDP target");
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let mid = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++mid;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
}

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 2,
  mobile: false,
});

/* Fake Tauri Desktop Flag */
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    (() => {
      const listeners = new Map();
      const callbacks = new Map();
      const internals = {
        metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
        plugins: {},
        transformCallback: (callback, once) => {
          const id = window.crypto.getRandomValues(new Uint32Array(1))[0];
          callbacks.set(id, (data) => {
            if (once) callbacks.delete(id);
            return callback && callback(data);
          });
          return id;
        },
        unregisterCallback: (id) => callbacks.delete(id),
        runCallback: (id, data) => { const cb = callbacks.get(id); if (cb) cb(data); },
        callbacks,
        invoke: async () => null,
      };
      Object.defineProperty(window, "__TAURI_INTERNALS__", { value: internals, configurable: true });
      Object.defineProperty(window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
        value: { unregisterListener: (event, id) => callbacks.delete(id) },
        configurable: true,
      });
    })()`,
});

/* ── 1. Navigate to Home ─────────────────────────────────────────── */
console.log("Navigating to Home...");
await send("Page.navigate", { url: "http://127.0.0.1:5199/" });
await new Promise((r) => setTimeout(r, 2000));

async function createNotebookWithName(title) {
  // Click Create new
  await evalJs(`
    (() => {
      const btn = [...document.querySelectorAll("button")].find(b => /create new/i.test(b.textContent || ""));
      if (btn) btn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 400));

  // Type title in modal
  await evalJs(`
    (async () => {
      const inp = document.querySelector('input[placeholder*="notebook" i], input[type="text"]:not([placeholder*="Search" i])');
      if (inp) {
        inp.focus();
        inp.value = ${JSON.stringify(title)};
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 300));

  // Click Submit Create button
  await evalJs(`
    (() => {
      const btn = [...document.querySelectorAll("div[role='dialog'] button, .fixed button, button")].find(
        b => /^create$/i.test(b.textContent.trim()) && !b.disabled
      );
      if (btn) btn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));
}

// 1. Create first notebook: Bar Exam Review
console.log("Creating Philippine Bar Exam Review...");
await createNotebookWithName("Philippine Bar Exam Review (Civil & Remedial Law)");

// In Workspace, add sources
console.log("Adding sources in workspace...");
await evalJs(`
  (async () => {
    // Add paste source 1
    const pasteBtn = [...document.querySelectorAll("button")].find(b => /paste/i.test(b.textContent || ""));
    if (pasteBtn) {
      pasteBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const titleInp = document.querySelector('input[placeholder*="Lecture notes" i], input[placeholder*="Title" i]');
      const ta = document.querySelector('textarea[placeholder*="Paste" i]');
      if (titleInp && ta) {
        titleInp.focus();
        titleInp.value = "Civil Code Obligations & Contracts (Articles 1156-1304)";
        titleInp.dispatchEvent(new Event('input', { bubbles: true }));
        titleInp.dispatchEvent(new Event('change', { bubbles: true }));

        ta.focus();
        ta.value = "An obligation is a juridical necessity to give, to do or not to do. Obligations arise from law, contracts, quasi-contracts, acts or omissions punished by law, and quasi-delicts. Novation extinguishes obligations when a valid previous obligation is extinguished by a valid new obligation.";
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await new Promise(r => setTimeout(r, 300));
      const addBtn = [...document.querySelectorAll("button")].find(b => /add source/i.test(b.textContent || "") && !b.disabled);
      if (addBtn) addBtn.click();
    }
  })()
`);
await new Promise((r) => setTimeout(r, 1200));

await evalJs(`
  (async () => {
    // Add paste source 2
    const pasteBtn = [...document.querySelectorAll("button")].find(b => /paste/i.test(b.textContent || ""));
    if (pasteBtn) {
      pasteBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const titleInp = document.querySelector('input[placeholder*="Lecture notes" i], input[placeholder*="Title" i]');
      const ta = document.querySelector('textarea[placeholder*="Paste" i]');
      if (titleInp && ta) {
        titleInp.focus();
        titleInp.value = "Rules of Court on Special Civil Actions (Rule 65)";
        titleInp.dispatchEvent(new Event('input', { bubbles: true }));
        titleInp.dispatchEvent(new Event('change', { bubbles: true }));

        ta.focus();
        ta.value = "Certiorari, Prohibition and Mandamus require a showing of grave abuse of discretion amounting to lack or excess of jurisdiction. The petition must be filed not later than 60 days from notice.";
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await new Promise(r => setTimeout(r, 300));
      const addBtn = [...document.querySelectorAll("button")].find(b => /add source/i.test(b.textContent || "") && !b.disabled);
      if (addBtn) addBtn.click();
    }
  })()
`);
await new Promise((r) => setTimeout(r, 1500));

// Make sure any stray modal backdrop is closed
await evalJs(`
  (() => {
    const closeBtn = document.querySelector('button[aria-label="Close"], button[aria-label="close"]');
    if (closeBtn) closeBtn.click();
  })()
`);
await new Promise((r) => setTimeout(r, 600));

// Capture Studio Workspace Screenshot
console.log("Capturing Studio Workspace screenshot...");
const studioShot = await send("Page.captureScreenshot", { format: "png" });
const studioData = studioShot.result?.data || studioShot.data;
writeFileSync(join(artifactDir, "studio_workspace.png"), Buffer.from(studioData, "base64"));
console.log("Saved studio_workspace.png");

// Return home to seed remaining notebooks
console.log("Returning to Home...");
await evalJs(`document.querySelector('button[aria-label="Comtus home"]')?.click()`);
await new Promise((r) => setTimeout(r, 1200));

// Create 3 more notebooks
console.log("Creating Nursing Licensure Exam notebook...");
await createNotebookWithName("Nursing Licensure Examination (NLE Core Concepts)");
await evalJs(`document.querySelector('button[aria-label="Comtus home"]')?.click()`);
await new Promise((r) => setTimeout(r, 1000));

console.log("Creating AI Architecture notebook...");
await createNotebookWithName("AI Architecture & Large Language Models Deep Dive");
await evalJs(`document.querySelector('button[aria-label="Comtus home"]')?.click()`);
await new Promise((r) => setTimeout(r, 1000));

console.log("Creating CPA Board Review notebook...");
await createNotebookWithName("Certified Public Accountant (CPA) Auditing Theory");
await evalJs(`document.querySelector('button[aria-label="Comtus home"]')?.click()`);
await new Promise((r) => setTimeout(r, 1500));

// Capture Home Screenshot with full grid
console.log("Capturing Desktop Home screenshot...");
const homeShot = await send("Page.captureScreenshot", { format: "png" });
const homeData = homeShot.result?.data || homeShot.data;
writeFileSync(join(artifactDir, "desktop_home.png"), Buffer.from(homeData, "base64"));
console.log("Saved desktop_home.png");

console.log("All screenshots captured successfully!");
try { ws.close(); } catch {}
try { child.kill(); } catch {}
setTimeout(() => {
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
}, 500);
