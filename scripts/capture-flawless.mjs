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
  "--remote-debugging-port=9457",
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
    const list = await (await fetch("http://127.0.0.1:9457/json/list")).json();
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

/* Fake Tauri Desktop Flag & Seed Default BYOK LocalStorage */
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

      // Initialize clean BYOK state (NOT Pro)
      localStorage.setItem("comtus-settings", JSON.stringify({
        state: {
          provider: "openai-compatible",
          anthropicKey: "",
          compatKey: "sk-or-v1-free-demo-key",
          compatBaseUrl: "https://openrouter.ai/api/v1",
          compatModel: "deepseek/deepseek-r1:free",
          effort: "medium",
          isPro: false,
          planTier: "free",
          tokenBalance: 0,
          tokensUsed: 0,
          activePassCode: "",
          recentModels: ["deepseek/deepseek-r1:free"]
        },
        version: 6
      }));
    })()`,
});

/* ── 1. Navigate to App ──────────────────────────────────────────── */
console.log("Navigating to App in BYOK Mode...");
await send("Page.navigate", { url: "http://127.0.0.1:5199/" });
await new Promise((r) => setTimeout(r, 1500));

// Seed IndexedDB
console.log("Seeding notebooks and sources in IndexedDB...");
await evalJs(`
  new Promise((resolve, reject) => {
    const req = indexedDB.open("comtus");
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(["notebooks", "sources", "messages", "chatSessions", "generations"], "readwrite");
      const nbStore = tx.objectStore("notebooks");
      
      const titles = [
        "Philippine Bar Exam Review (Civil & Remedial Law)",
        "Nursing Licensure Examination (NLE Core Concepts)",
        "AI Architecture & Large Language Models Deep Dive",
        "Certified Public Accountant (CPA) Auditing Theory"
      ];
      
      for (let i = 0; i < titles.length; i++) {
        nbStore.put({
          id: "nb-" + (i + 1),
          name: titles[i],
          createdAt: Date.now() - (i + 1) * 3600000 * 24,
          updatedAt: Date.now() - (i + 1) * 3600000,
        });
      }

      const sStore = tx.objectStore("sources");
      sStore.put({
        id: "src-1",
        notebookId: "nb-1",
        title: "Civil Code Obligations & Contracts.pdf",
        kind: "pdf",
        content: "Obligations arise from law, contracts, quasi-contracts, acts or omissions punished by law, and quasi-delicts.",
        tokens: 5400,
        createdAt: Date.now() - 3600000,
      });
      sStore.put({
        id: "src-2",
        notebookId: "nb-1",
        title: "Special Civil Actions (Rule 65 Certiorari).docx",
        kind: "docx",
        content: "Rule 65 Certiorari standard.",
        tokens: 3800,
        createdAt: Date.now() - 3600000,
      });
      sStore.put({
        id: "src-3",
        notebookId: "nb-1",
        title: "Supreme Court En Banc Rulings on Novation.md",
        kind: "md",
        content: "Novation doctrine.",
        tokens: 4200,
        createdAt: Date.now() - 3600000,
      });

      const csStore = tx.objectStore("chatSessions");
      csStore.put({
        id: "sess-1",
        notebookId: "nb-1",
        title: "Novation & Civil Law Requisites",
        createdAt: Date.now() - 120000,
        updatedAt: Date.now() - 60000,
      });

      const mStore = tx.objectStore("messages");
      mStore.put({
        id: "msg-1",
        notebookId: "nb-1",
        sessionId: "sess-1",
        role: "user",
        content: "What are the essential requisites for extinctive novation under the Philippine Civil Code, and how does it differ from modificatory novation?",
        createdAt: Date.now() - 100000,
      });
      mStore.put({
        id: "msg-2",
        notebookId: "nb-1",
        sessionId: "sess-1",
        role: "assistant",
        content: "Under **Article 1292 of the Philippine Civil Code**, extinctive novation requires four essential elements:\\n\\n1. **A previous valid obligation** that is being extinguished or modified.\\n2. **Agreement of all parties** to create a new contract or extinguish the prior relation.\\n3. **Extinguishment of the old obligation**, either expressly or through total incompatibility.\\n4. **Validity of the new obligation** succeeding the prior agreement.\\n\\n> *Key distinction:* Extinctive novation completely extinguishes the original tie and its accessories, whereas modificatory novation only adjusts incidental terms.",
        thinking: "Analyzing Civil Code provisions on modes of extinguishing obligations. Referencing Article 1292.",
        citations: [
          {
            sourceId: "src-1",
            sourceTitle: "Civil Code Obligations & Contracts.pdf",
            citedText: "Novation extinguishes obligations when a valid previous obligation is extinguished by a valid new obligation.",
          }
        ],
        createdAt: Date.now() - 90000,
      });

      const gStore = tx.objectStore("generations");
      gStore.put({
        id: "gen-1",
        notebookId: "nb-1",
        kind: "audio-overview",
        title: "Audio Overview: Key Tensions in Philippine Civil Law",
        payload: {
          title: "Audio Overview: Key Tensions in Philippine Civil Law",
          summary: "A deep dive discussion between Alex and Sam exploring contract validity and procedural remedies.",
          script: [
            { speaker: "Alex", text: "Welcome to today's study deep dive on Philippine Civil Law." },
            { speaker: "Sam", text: "Today we are analyzing extinctive versus modificatory novation." }
          ],
          duration: 180,
        },
        createdAt: Date.now() - 60000,
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  })
`);

await send("Page.reload");
await new Promise((r) => setTimeout(r, 1500));

// Capture BYOK Desktop Home Screenshot (Shows BYOK badge, NOT Pro)
console.log("Capturing BYOK Desktop Home screenshot...");
const homeShotByok = await send("Page.captureScreenshot", { format: "png" });
const homeDataByok = homeShotByok.result?.data || homeShotByok.data;
writeFileSync(join(artifactDir, "desktop_home_byok.png"), Buffer.from(homeDataByok, "base64"));
console.log("Saved desktop_home_byok.png");

// Now simulate user availing Anthropic Pro Plan (Scholar Pass with 1.5M tokens)
console.log("Activating Anthropic Pro Plan with 1,500,000 paid tokens...");
await evalJs(`
  (() => {
    localStorage.setItem("comtus-settings", JSON.stringify({
      state: {
        provider: "anthropic",
        anthropicKey: "comtus-pass-7x99a41b",
        anthropicBaseUrl: "https://api.anthropic.com",
        anthropicModel: "claude-opus-5",
        compatKey: "",
        compatBaseUrl: "https://openrouter.ai/api/v1",
        compatModel: "deepseek/deepseek-r1:free",
        effort: "high",
        isPro: true,
        planTier: "scholar",
        tokenBalance: 1500000,
        tokensUsed: 14500,
        activePassCode: "comtus-pass-7x99a41b",
        recentModels: ["claude-opus-5"]
      },
      version: 6
    }));
  })()
`);

await send("Page.reload");
await new Promise((r) => setTimeout(r, 1500));

// Capture Pro Desktop Home Screenshot (Shows PRO · 1.5M tok)
console.log("Capturing Pro Desktop Home screenshot...");
const homeShotPro = await send("Page.captureScreenshot", { format: "png" });
const homeDataPro = homeShotPro.result?.data || homeShotPro.data;
writeFileSync(join(artifactDir, "desktop_home.png"), Buffer.from(homeDataPro, "base64"));
console.log("Saved desktop_home.png (Pro active)");

// Open Settings Modal to show Plan & Token Balance Status
console.log("Opening Settings Modal to show Token Balance Meter...");
await evalJs(`
  (() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent && b.textContent.includes("Settings"));
    if (btn) btn.click();
  })()
`);
await new Promise((r) => setTimeout(r, 1200));

// Capture Settings Modal screenshot
console.log("Capturing Settings Plan Status screenshot...");
const settingsShot = await send("Page.captureScreenshot", { format: "png" });
const settingsData = settingsShot.result?.data || settingsShot.data;
writeFileSync(join(artifactDir, "settings_plan_status.png"), Buffer.from(settingsData, "base64"));
console.log("Saved settings_plan_status.png");

// Close Settings Modal
await evalJs(`
  (() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent && b.textContent.includes("Done"));
    if (btn) btn.click();
  })()
`);
await new Promise((r) => setTimeout(r, 600));

// Navigate to Studio Workspace
console.log("Navigating to Studio Workspace...");
await evalJs(`
  (() => {
    const card = [...document.querySelectorAll("button, h3, h2, span")].find(
      (el) => el.textContent && el.textContent.includes("Philippine Bar Exam")
    );
    if (card) {
      card.closest("button")?.click() || card.click();
    }
  })()
`);
await new Promise((r) => setTimeout(r, 2000));

// Capture Studio Workspace Screenshot
console.log("Capturing Studio Workspace screenshot...");
const studioShot = await send("Page.captureScreenshot", { format: "png" });
const studioData = studioShot.result?.data || studioShot.data;
writeFileSync(join(artifactDir, "studio_workspace.png"), Buffer.from(studioData, "base64"));
console.log("Saved studio_workspace.png");

console.log("All screenshots captured successfully!");
try { ws.close(); } catch {}
try { child.kill(); } catch {}
setTimeout(() => {
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
}, 500);
