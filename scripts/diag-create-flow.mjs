/**
 * Diagnostic v2: watch the URL over time after create and check IndexedDB.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "https://comtus-ai.vercel.app/studio";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = join(process.cwd(), "scripts", "_diag-shots");
mkdirSync(SHOTS, { recursive: true });

const profile = join(tmpdir(), `comtus-diag-${Date.now()}`);
mkdirSync(profile, { recursive: true });

const child = spawn(EDGE, [
  "--headless=new",
  "--remote-debugging-port=9444",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-gpu",
  "--window-size=1440,900",
  "about:blank",
]);
process.on("exit", () => { try { child.kill(); } catch {} });

let target;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9444/json/list")).json();
    target = list.find((t) => t.type === "page");
    if (target) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}
if (!target) { console.error("FAIL: CDP target not reachable"); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let mid = 0;
const pending = new Map();
const consoleLog = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.consoleAPICalled") {
    const args = (msg.params?.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
    consoleLog.push(`[${msg.params?.type}] ${args}`);
  }
  if (msg.method === "Runtime.exceptionThrown") {
    const desc = msg.params?.exceptionDetails?.exception?.description ?? "?";
    consoleLog.push(`[EXCEPTION] ${desc}`);
    console.log(`  EXCEPTION: ${desc}`);
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
  if (r.result?.exceptionDetails) return `__ERR__ ${r.result.exceptionDetails.text ?? "eval error"}`;
  return r.result?.result?.value;
}
async function until(expr, timeoutMs = 20000, everyMs = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await evalJs(expr);
    if (v && v !== true) return v;
    if (v === true) return true;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  return null;
}
async function screenshot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const buf = Buffer.from(r.result?.data ?? "", "base64");
  writeFileSync(join(SHOTS, `${name}.png`), buf);
  console.log(`  → ${name}.png`);
}

await send("Runtime.enable");
await send("Page.enable");

// [1] Navigate
console.log(`\n[1] Navigating to ${BASE} …`);
await send("Page.navigate", { url: BASE });
await until(`document.readyState === "complete" && document.body?.innerText?.length > 20`, 40000);
console.log(`    URL: ${await evalJs("location.href")}`);
await screenshot("01-shelf");

// [2] Click Create new
console.log("\n[2] Clicking Create new …");
await evalJs(`
  (() => {
    const btn = [...document.querySelectorAll("button")].find(b => /create new/i.test(b.textContent||""));
    if (btn) btn.click(); else console.error("NO CREATE NEW BTN");
  })()
`);
await new Promise((r) => setTimeout(r, 1500));

// Wait for dialog
await until(`!!document.querySelector('[role="dialog"]')`, 8000);
await screenshot("02-modal-open");

// [3] Find modal input
console.log("\n[3] Examining modal …");
const modalState = await evalJs(`
  (() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return "NO_DIALOG";
    const inp = dialog.querySelector("input");
    return JSON.stringify({
      dialogTitle: dialog.querySelector('h2')?.textContent?.trim(),
      inputPlaceholder: inp?.placeholder,
      inputValue: inp?.value,
      buttons: [...dialog.querySelectorAll("button")].map(b => ({ text: (b.textContent||"").trim(), disabled: b.disabled })),
    });
  })()
`);
console.log(`    Modal: ${modalState}`);

// [4] Type in modal
console.log("\n[4] Typing notebook name …");
const notebookName = `Diag Notebook ${Date.now()}`;
const typeResult = await evalJs(`
  (async () => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return "NO_DIALOG";
    const inp = dialog.querySelector("input");
    if (!inp) return "NO_INPUT";
    inp.focus();
    await new Promise(r => setTimeout(r, 200));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "${notebookName}");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    const createBtn = [...dialog.querySelectorAll("button")].find(b =>
      /^create/i.test((b.textContent||"").trim())
    );
    return JSON.stringify({
      inputValue: inp.value,
      createBtnDisabled: createBtn?.disabled,
      createBtnText: createBtn?.textContent?.trim(),
    });
  })()
`);
console.log(`    After type: ${typeResult}`);
await screenshot("03-typed");

// [5] Click Create
console.log("\n[5] Clicking Create …");
const preClickUrl = await evalJs("location.href");
console.log(`    URL before click: ${preClickUrl}`);

await evalJs(`
  (async () => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const createBtn = [...dialog.querySelectorAll("button")].find(b =>
      /^create/i.test((b.textContent||"").trim()) && !b.disabled
    );
    if (!createBtn) {
      console.error("CREATE BTN DISABLED OR NOT FOUND");
      return;
    }
    createBtn.click();
  })()
`);

// [6] Track URL changes for 8 seconds
console.log("\n[6] Tracking URL for 8s …");
const urlHistory = [];
const t0 = Date.now();
while (Date.now() - t0 < 8000) {
  await new Promise((r) => setTimeout(r, 300));
  const url = await evalJs("location.href");
  const path = await evalJs("location.pathname");
  const hasWorkspace = await evalJs(
    `!!document.querySelector('textarea[placeholder*="Ask" i], textarea[placeholder*="Type" i], [data-testid="workspace"]')`
  );
  const hasShelf = await evalJs(
    `document.body?.innerText?.includes("Course Notebooks Shelf")`
  );
  const lastEntry = urlHistory[urlHistory.length - 1];
  if (!lastEntry || lastEntry.url !== url) {
    urlHistory.push({ t: Date.now() - t0, url, path, hasWorkspace, hasShelf });
    console.log(`    +${Date.now() - t0}ms url=${path} workspace=${hasWorkspace} shelf=${hasShelf}`);
  }
}

// [7] Check IndexedDB for notebook
console.log("\n[7] Checking IndexedDB …");
const dbCheck = await evalJs(`
  (async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open("comtus");
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(["notebooks"], "readonly");
        const store = tx.objectStore("notebooks");
        const all = store.getAll();
        all.onsuccess = () => resolve(JSON.stringify(all.result.map(n => ({ id: n.id, name: n.name }))));
        all.onerror = () => resolve("STORE_ERROR");
      };
      req.onerror = () => resolve("DB_ERROR");
    });
  })()
`);
console.log(`    IndexedDB notebooks: ${dbCheck}`);

await screenshot("07-final");

// Summary
const finalUrl = await evalJs("location.href");
const finalPath = await evalJs("location.pathname");
const navigatedSuccessfully = /\/studio\/.+/.test(String(finalPath));
const bouncedBack = urlHistory.some(e => /\/studio\/.+/.test(e.path)) && 
                    String(finalPath) === "/studio";

console.log("\n══════════════ SUMMARY ══════════════");
console.log(`Final URL: ${finalPath}`);
console.log(`URL history: ${urlHistory.map(e => e.path).join(" → ")}`);
console.log(`Navigated to /studio/:id: ${urlHistory.some(e => /\/studio\/.+/.test(e.path))}`);
console.log(`Bounced back to /studio: ${bouncedBack}`);
console.log(`Currently at /studio/:id: ${navigatedSuccessfully}`);
if (consoleLog.length) {
  console.log("\n[Console output]");
  consoleLog.forEach(l => console.log(" ", l));
}
console.log("═════════════════════════════════════");
process.exit(0);
