import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const artifactDir = "C:/Users/uzzie/.gemini/antigravity/brain/df31abd4-689e-42f0-9fe1-251fd0293c50";

/* ── 1. Launch Edge Headless with CDP ────────────────────────────── */
console.log("Launching Edge headless...");
const profile = join(tmpdir(), `comtus-shot-${Date.now()}`);
mkdirSync(profile, { recursive: true });
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const child = spawn(edge, [
  "--headless=new",
  "--remote-debugging-port=9445",
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
    const list = await (await fetch("http://127.0.0.1:9445/json/list")).json();
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

/* ── 2. Navigate to Home ─────────────────────────────────────────── */
console.log("Navigating to Home...");
await send("Page.navigate", { url: "http://127.0.0.1:5199/" });
await new Promise((r) => setTimeout(r, 2000));

// Seed Dexie database using standard indexedDB operations
console.log("Seeding sample data...");
await evalJs(`
  new Promise((resolve) => {
    const req = indexedDB.open("comtus", 2);
    req.onsuccess = () => {
      const d = req.result;
      const tx = d.transaction(["notebooks", "sources", "messages", "generations", "chatSessions"], "readwrite");
      
      const nbStore = tx.objectStore("notebooks");
      nbStore.put({ id: "nb-1", name: "Philippine Bar Exam Review (Civil & Remedial Law)", createdAt: Date.now() - 3600000 * 24 * 2, updatedAt: Date.now() - 3600000 * 2 });
      nbStore.put({ id: "nb-2", name: "Nursing Licensure Examination (NLE Core Concepts)", createdAt: Date.now() - 3600000 * 24 * 5, updatedAt: Date.now() - 3600000 * 6 });
      nbStore.put({ id: "nb-3", name: "AI Architecture & Large Language Models Deep Dive", createdAt: Date.now() - 3600000 * 24 * 10, updatedAt: Date.now() - 3600000 * 24 });
      nbStore.put({ id: "nb-4", name: "Certified Public Accountant (CPA) Auditing Theory", createdAt: Date.now() - 3600000 * 24 * 15, updatedAt: Date.now() - 3600000 * 48 });

      const sStore = tx.objectStore("sources");
      sStore.put({ id: "s-1", notebookId: "nb-1", title: "Civil Code Obligations & Contracts.pdf", kind: "pdf", content: "Obligations arise from law...", tokens: 4250, createdAt: Date.now() });
      sStore.put({ id: "s-2", notebookId: "nb-1", title: "Remedial Law Supreme Court Decisions 2025.docx", kind: "docx", content: "Jurisdiction over real actions...", tokens: 8120, createdAt: Date.now() });
      sStore.put({ id: "s-3", notebookId: "nb-1", title: "Special Proceedings & Provisional Remedies.md", kind: "md", content: "Habeas corpus and amparo rules...", tokens: 3400, createdAt: Date.now() });
      sStore.put({ id: "s-4", notebookId: "nb-1", title: "Rules of Court Evidence Notes", kind: "note", content: "Rule 128 General Provisions...", tokens: 1950, createdAt: Date.now() });
      sStore.put({ id: "s-5", notebookId: "nb-1", title: "Lecture: Constitutional Limits on Police Power", kind: "paste", content: "Police power cannot be bargained away...", tokens: 2800, createdAt: Date.now() });

      const mStore = tx.objectStore("messages");
      mStore.put({ id: "m-1", notebookId: "nb-1", sessionId: "sess-1", role: "user", content: "What are the essential requisites for a valid novation under Civil Law?", createdAt: Date.now() - 100000 });
      mStore.put({
        id: "m-2",
        notebookId: "nb-1",
        sessionId: "sess-1",
        role: "assistant",
        content: "Under Article 1292 of the Civil Code, novation requires four essential elements:\\n\\n1. **A previous valid obligation** that is being extinguished or modified.\\n2. **Agreement of all parties** to create a new contract or extinguish the prior relation.\\n3. **Extinguishment of the old obligation**, either expressly or through total incompatibility.\\n4. **Validity of the new obligation** succeeding the prior agreement.\\n\\n> *Note:* Extinctive novation is never presumed; there must be clear intent or substantial incompatibility.",
        thinking: "Analyzing Civil Code provisions on modes of extinguishing obligations. Checking distinction between extinctive and modificatory novation.",
        citations: [
          { sourceId: "s-1", sourceTitle: "Civil Code Obligations & Contracts.pdf", citedText: "Novation requires a previous valid obligation..." }
        ],
        createdAt: Date.now() - 95000
      });

      const csStore = tx.objectStore("chatSessions");
      csStore.put({ id: "sess-1", notebookId: "nb-1", title: "Novation & Civil Law Requisites", createdAt: Date.now() - 100000, updatedAt: Date.now() - 95000 });

      const gStore = tx.objectStore("generations");
      gStore.put({
        id: "g-1",
        notebookId: "nb-1",
        kind: "audio-overview",
        title: "Audio Overview: Key Tensions in Philippine Civil Law",
        payload: {
          title: "Audio Overview: Key Tensions in Philippine Civil Law",
          summary: "A deep dive discussion between Alex and Sam exploring contract validity and procedural remedies.",
          script: [
            { speaker: "Alex", text: "Welcome to our deep dive on the Philippine Civil Code." },
            { speaker: "Sam", text: "That is right, Alex. The difference between void and voidable contracts determines whether prescription applies." }
          ],
          duration: 180
        },
        createdAt: Date.now() - 50000
      });
      gStore.put({
        id: "g-2",
        notebookId: "nb-1",
        kind: "note",
        title: "Novation & Quasi-Delict Requisites Summary",
        payload: {
          content: "Summary of requisites for Art. 2176 Quasi-Delict:\\n1. Damage suffered by plaintiff\\n2. Fault or negligence of defendant\\n3. Direct causal connection between fault and damage."
        },
        createdAt: Date.now() - 40000
      });
      gStore.put({
        id: "g-3",
        notebookId: "nb-1",
        kind: "study-guide",
        title: "Comprehensive Civil Law Study Guide",
        payload: {
          title: "Comprehensive Civil Law Study Guide",
          sections: []
        },
        createdAt: Date.now() - 30000
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    };
  })
`);

// Reload to refresh the live query
console.log("Reloading Home page to display seeded notebooks...");
await send("Page.reload");
await new Promise((r) => setTimeout(r, 2500));

// Capture Home Screenshot
console.log("Capturing Desktop Home screenshot...");
const homeShot = await send("Page.captureScreenshot", { format: "png" });
const homeData = homeShot.result?.data || homeShot.data;
writeFileSync(join(artifactDir, "desktop_home.png"), Buffer.from(homeData, "base64"));
console.log("Saved desktop_home.png");

/* ── 3. Open Notebook Studio Workspace & Capture ─────────────────── */
console.log("Opening Notebook Studio Workspace...");
await evalJs(`
  (async () => {
    const card = [...document.querySelectorAll("button, h3, h2, span")].find(
      (el) => el.textContent && el.textContent.includes("Philippine Bar Exam")
    );
    if (card) {
      card.closest("button")?.click() || card.click();
    }
  })()
`);

await new Promise((r) => setTimeout(r, 2500));

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
