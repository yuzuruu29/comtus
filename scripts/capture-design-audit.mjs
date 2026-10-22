/* Design audit capture — the real artifact, not a proxy.
   Usage: node scripts/capture-design-audit.mjs [outDir]
   Captures landing, shelf, workspace and static pages at desktop + mobile,
   in Daylight and Lamplight. */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2] || "C:/Users/uzzie/AppData/Local/Temp/opencode/design-audit";
const PORT = process.env.PORT || "5199";
const CDP_PORT = 9451;

mkdirSync(OUT, { recursive: true });

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = join(tmpdir(), `comtus-audit-${Date.now()}`);
mkdirSync(profile, { recursive: true });

const child = spawn(edge, [
  "--headless=new",
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1440,900",
  "about:blank",
]);

process.on("exit", () => {
  try { child.kill(); } catch {}
});

let target;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
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
  if (r.result?.exceptionDetails) console.error("JS error:", r.result.exceptionDetails.text);
  return r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Runtime.enable");
await send("Page.enable");
await send("Log.enable").catch(() => {});
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});

/* The desk shell only renders when __TAURI_INTERNALS__ exists, which would
   hijack every web capture. Only shim when we explicitly want the desk. */
if (process.env.DESK === "1") {
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const callbacks = new Map();
      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        value: {
          metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
          plugins: {},
          transformCallback: (cb, once) => {
            const id = window.crypto.getRandomValues(new Uint32Array(1))[0];
            callbacks.set(id, (d) => { if (once) callbacks.delete(id); return cb && cb(d); });
            return id;
          },
          unregisterCallback: (id) => callbacks.delete(id),
          runCallback: (id, d) => { const cb = callbacks.get(id); if (cb) cb(d); },
          callbacks,
          invoke: async () => null,
        },
        configurable: true,
      });
      Object.defineProperty(window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
        value: { unregisterListener: (id) => callbacks.delete(id) }, configurable: true,
      });
    })()`,
  });
}

await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    try {
      const raw = localStorage.getItem("comtus-settings");
      const parsed = raw ? JSON.parse(raw) : {};
      const state = parsed.state || {};
      if (!state.theme) state.theme = "light";
      localStorage.setItem("comtus-settings", JSON.stringify({ state, version: parsed.version ?? 15 }));
    } catch {}
  })()`,
});

async function seed() {
  const ok = await evalJs(`new Promise((resolve) => {
    // No version arg: attach to the DB Dexie already created.
    const req = indexedDB.open("comtus");
    req.onerror = () => resolve("open-error");
    req.onblocked = () => resolve("blocked");
    req.onsuccess = () => {
      const d = req.result;
      const have = Array.from(d.objectStoreNames);
      const want = ["notebooks","sources","messages","generations","chatSessions"];
      const use = want.filter((n) => have.includes(n));
      if (!use.length) { resolve("no-stores:" + have.join(",")); return; }
      let tx;
      try { tx = d.transaction(use, "readwrite"); }
      catch (e) { resolve("tx-error:" + e.message); return; }
      const now = Date.now();
      const nb = tx.objectStore("notebooks");
      nb.put({ id: "nb-1", name: "Philippine Bar Exam Review (Civil & Remedial Law)", createdAt: now - 864e5*2, updatedAt: now - 7e6 });
      nb.put({ id: "nb-2", name: "Nursing Licensure Examination", createdAt: now - 864e5*5, updatedAt: now - 6e7 });
      nb.put({ id: "nb-3", name: "AI Architecture & Large Language Models", createdAt: now - 864e5*10, updatedAt: now - 864e5 });
      if (have.includes("sources")) {
        const s = tx.objectStore("sources");
        s.put({ id: "s-1", notebookId: "nb-1", title: "Civil Code Obligations & Contracts.pdf", kind: "pdf", content: "Obligations arise from law, contract, quasi-delict, or any other source.", chars: 17000, tokens: 4250, addedAt: now });
        s.put({ id: "s-2", notebookId: "nb-1", title: "Remedial Law Decisions 2025.docx", kind: "docx", content: "Jurisdiction over real actions.", chars: 32480, tokens: 8120, addedAt: now });
        s.put({ id: "s-3", notebookId: "nb-1", title: "Special Proceedings Notes.md", kind: "md", content: "Habeas corpus and amparo rules.", chars: 13600, tokens: 3400, addedAt: now });
        s.put({ id: "s-4", notebookId: "nb-1", title: "Rules of Court Evidence", kind: "note", content: "Rule 128 General Provisions.", chars: 7800, tokens: 1950, addedAt: now });
      }
      if (have.includes("messages")) {
        const m = tx.objectStore("messages");
        m.put({ id: "m-1", notebookId: "nb-1", sessionId: "sess-1", role: "user", content: "What are the essential requisites for a valid novation under Civil Law?", createdAt: now - 1e5 });
        m.put({ id: "m-2", notebookId: "nb-1", sessionId: "sess-1", role: "assistant", content: "Under Article 1292 of the Civil Code, novation requires four essential elements:\\n\\n1. **A previous valid obligation** that is being extinguished or modified.\\n2. **Agreement of all parties** to create a new contract or extinguish the prior relation.\\n3. **Extinguishment of the old obligation**, either expressly or through total incompatibility.\\n4. **Validity of the new obligation** succeeding the prior agreement.\\n\\n> Extinctive novation is never presumed; there must be clear intent or substantial incompatibility.", thinking: "Analyzing Civil Code provisions on modes of extinguishing obligations.", citations: [{ sourceId: "s-1", sourceTitle: "Civil Code Obligations & Contracts.pdf", citedText: "Novation requires a previous valid obligation..." }], createdAt: now - 95e3 });
      }
      if (have.includes("chatSessions")) {
        tx.objectStore("chatSessions").put({ id: "sess-1", notebookId: "nb-1", title: "Novation & Civil Law Requisites", createdAt: now - 1e5, updatedAt: now - 95e3 });
      }
      tx.oncomplete = () => resolve("ok");
      tx.onerror = () => resolve("tx-fail");
      tx.onabort = () => resolve("tx-abort");
    };
  })`);
  console.log("seed ->", ok);
}

async function setTheme(theme) {
  await evalJs(`(() => {
    try {
      const raw = localStorage.getItem("comtus-settings");
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 15 };
      parsed.state = { ...(parsed.state || {}), theme: ${JSON.stringify(theme)} };
      localStorage.setItem("comtus-settings", JSON.stringify(parsed));
      document.documentElement.setAttribute("data-theme", ${JSON.stringify(theme)});
    } catch {}
  })()`);
}

async function goto(url, wait = 2600) {
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}${url}` });
  await sleep(wait);
}

/** Navigate and force the theme before the screenshot, so the capture is
    the real themed surface rather than a stale attribute. */
async function gotoThemed(url, theme, wait = 2600) {
  await setTheme(theme);
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}${url}` });
  await sleep(wait);
  await setTheme(theme);
  await sleep(500);
}

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const data = r.result?.data || r.data;
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  const text = await evalJs(`document.body.innerText`);
  console.log("saved", name, "|", String(text).replace(/\s+/g, " ").slice(0, 110));
}

async function setViewport(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile,
  });
}

async function run() {
  // Open the studio first so Dexie creates the schema, then seed into it.
  await goto("/studio", 3200);
  await seed();
  await send("Page.reload");
  await sleep(2800);
  await setTheme("light");

  const targets = [
    ["landing", "/", 3200],
    ["about", "/about", 2000],
    ["study-companion", "/study-companion", 2000],
    ["not-found", "/nope", 1800],
  ];

  for (const theme of ["light", "dark"]) {
    for (const [name, url, wait] of targets) {
      await gotoThemed(url, theme, wait);
      await shot(`${name}-${theme}`);
    }
  }

  // Studio surfaces need data + a real route.
  for (const theme of ["light", "dark"]) {
    await gotoThemed("/studio", theme, 3200);
    await shot(`shelf-${theme}`);

    await gotoThemed("/studio/nb-1", theme, 3400);
    await shot(`workspace-${theme}`);
  }

  // Mobile
  await setViewport(390, 844, true);
  for (const theme of ["light", "dark"]) {
    await gotoThemed("/", theme, 3000);
    await shot(`m-landing-${theme}`);
    await gotoThemed("/studio", theme, 3000);
    await shot(`m-shelf-${theme}`);
    await gotoThemed("/studio/nb-1", theme, 3200);
    await shot(`m-workspace-${theme}`);
  }
  await setViewport(1440, 900, false);

  console.log("DONE ->", OUT);
  try { ws.close(); } catch {}
  try { child.kill(); } catch {}
  setTimeout(() => {
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
    process.exit(0);
  }, 500);
}

run().catch((e) => {
  console.error(e);
  try { child.kill(); } catch {}
  process.exit(1);
});
