import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = join(tmpdir(), `comtus-shot-${Date.now()}`);
mkdirSync(profile, { recursive: true });
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const child = spawn(edge, [
  "--headless=new",
  "--remote-debugging-port=9459",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-gpu",
  "--window-size=1440,920",
  "about:blank",
]);

let target;
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9459/json/list")).json();
    target = list.find((t) => t.type === "page");
    if (target) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
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
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    (() => {
      const internals = { metadata: { currentWindow: { label: "main" } }, invoke: async () => null };
      Object.defineProperty(window, "__TAURI_INTERNALS__", { value: internals, configurable: true });
      localStorage.setItem("comtus-settings", JSON.stringify({
        state: { provider: "openai-compatible", compatKey: "sk-free", compatBaseUrl: "https://openrouter.ai/api/v1", compatModel: "deepseek/deepseek-r1:free", isPro: false, planTier: "free", tokenBalance: 0, tokensUsed: 0 },
        version: 6
      }));
    })()`,
});

await send("Page.navigate", { url: "http://127.0.0.1:5199/" });
await new Promise((r) => setTimeout(r, 2000));

const proElements = await evalJs(`
  (() => {
    const all = [...document.querySelectorAll("*")];
    const matching = all.filter(el => el.children.length === 0 && el.textContent && el.textContent.trim() === "PRO");
    return matching.map(el => ({
      tag: el.tagName,
      className: el.className,
      outerHTML: el.outerHTML,
      parentHTML: el.parentElement?.outerHTML
    }));
  })()
`);
console.log("PRO ELEMENTS FOUND:", JSON.stringify(proElements, null, 2));

const storeState = await evalJs(`
  (() => {
    const raw = localStorage.getItem("comtus-settings");
    return JSON.parse(raw);
  })()
`);
console.log("STORE STATE IN LOCALSTORAGE:", JSON.stringify(storeState, null, 2));

try { ws.close(); } catch {}
try { child.kill(); } catch {}
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
