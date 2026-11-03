/* Throwaway CDP smoke: boot Comtus studio in a headless browser, create a
   notebook, paste a source, send a chat message against a local mock
   OpenAI-compatible endpoint, and assert thinking + answer + citation.
   Then flip the Tauri flag and drive the desktop "desk" surface too. */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};

/* ── mock OpenAI-compatible endpoint ─────────────────────── */
let sseServed = 0;
const mock = http.createServer((req, res) => {
  // Preflight for POSTs carrying JSON + Authorization + SDK headers.
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      // Echo whatever the browser asked for (x-stainless-* etc.).
      "access-control-allow-headers": req.headers["access-control-request-headers"] || "authorization,content-type,x-title",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    });
    res.end();
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.method === "POST" && req.url?.includes("/chat/completions")) {
      sseServed++;
      res.writeHead(200, { "content-type": "text/event-stream", "access-control-allow-origin": "*" });
      const events = [
        { id: "1", object: "chat.completion.chunk", choices: [{ index: 0, delta: { reasoning_content: "Weighing the sources carefully." } }] },
        { id: "2", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: "Here is the plan: study by lamplight. See [Smoke Source]." } }] },
        { id: "3", object: "chat.completion.chunk", choices: [{ index: 0, delta: {} }], finish_reason: "stop" },
      ];
      for (const ev of events) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    if (req.method === "GET" && req.url?.endsWith("/models")) {
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(JSON.stringify({ object: "list", data: [{ id: "mock-mini" }] }));
      return;
    }
    res.writeHead(404);
    res.end("{}");
  });
});
await new Promise((r) => mock.listen(8787, r));

/* ── launch Edge headless over CDP ───────────────────────── */
const profile = join(tmpdir(), `comtus-smoke-${Date.now()}`);
mkdirSync(profile, { recursive: true });
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const child = spawn(edge, [
  "--headless=new",
  "--remote-debugging-port=9333",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-gpu",
  "--window-size=1440,900",
  "about:blank",
]);
process.on("exit", () => { try { child.kill(); } catch {} });

let target;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
    target = list.find((t) => t.type === "page");
    if (target) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}
if (!target) { check("CDP target reachable", false); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let mid = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") {
    consoleErrors.push(msg.params?.exceptionDetails?.exception?.description || "exception");
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
  if (r.result?.exceptionDetails) return `__EVAL_ERR__ ${r.result.exceptionDetails.text}`;
  return r.result?.result?.value;
}
async function until(expr, timeoutMs = 20000, everyMs = 400) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await evalJs(expr);
    if (v && v !== true) return v;
    if (v === true) return true;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  return null;
}

await send("Runtime.enable");
await send("Page.enable");

/** Boot the studio with optional persistent pre-paint hooks: the faked
 *  Tauri flag and the seeded settings must exist before any module runs,
 *  so they're injected via addScriptToEvaluateOnNewDocument. */
async function bootStudio(withTauriFlag) {
  if (withTauriFlag && !globalThis.__flagHookAdded) {
    globalThis.__flagHookAdded = true;
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
  }
  if (!globalThis.__settingsHookAdded) {
    globalThis.__settingsHookAdded = true;
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          try {
            const raw = localStorage.getItem("comtus-settings");
            const parsed = raw ? JSON.parse(raw) : {};
            parsed.state = {
              ...(parsed.state || {}),
              provider: "openai-compatible",
              compatBaseUrl: "http://localhost:8787/v1",
              compatModel: "mock-mini",
              compatKey: "",
              storedKeys: [],
            };
            parsed.version = 4;
            localStorage.setItem("comtus-settings", JSON.stringify(parsed));
          } catch {}
        })()`,
    });
  }
  await send("Page.navigate", { url: "http://127.0.0.1:5199/studio" });
  // Cold vite dev transform can take a while — poll for real app chrome.
  const booted = await until(
    `document.querySelector('button') && document.body.innerText.length > 40`,
    60000,
  );
  return booted;
}

/* ══ Part 1 — web studio surface (no Tauri flag) ═══════════ */
const bootedWeb = await bootStudio(false);
check("web studio boots with interactive UI", !!bootedWeb);

/* Create a notebook via the shelf's naming modal. */
const clickedNew = await evalJs(`
  (() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /new notebook/i.test(b.getAttribute("aria-label") || "") || /new notebook/i.test(b.textContent || "")
    );
    if (!btn) return false;
    btn.click();
    return true;
  })()
`);
check("new-notebook control found & clicked", !!clickedNew);

await until(`!!document.querySelector('input:not([type="password"])')`, 8000);
const named = await evalJs(`
  (async () => {
    const inp = [...document.querySelectorAll("input")].find(
      (i) => i.offsetParent !== null && i.type !== "password"
    );
    if (!inp) return "no-input";
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "Smoke Notebook");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    const create = [...document.querySelectorAll("button")].find(
      (b) => /^create$/i.test((b.textContent || "").trim()) && !b.disabled
    );
    if (!create) return "no-create";
    create.click();
    return "ok";
  })()
`);
check("naming modal completed", named === "ok", String(named));

const onWorkspace = await until(
  `/^\\/studio\\/[A-Za-z0-9-]+$/.test(location.pathname) && !!document.querySelector("textarea[placeholder*=\\"Ask\\" i]")`,
  15000,
);
check("workspace route + composer mounted", !!onWorkspace);

/* Paste a source through the import bar. */
const pasted = await evalJs(`
  (async () => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /paste/i.test(b.textContent || "")
    );
    if (!btn) return "no-paste-button";
    btn.click();
    await new Promise((r) => setTimeout(r, 800));
    const title = document.querySelector('input[placeholder^="Lecture notes" i]');
    if (!title) return "no-title-input";
    const iSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    iSet.call(title, "Smoke Source");
    title.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    const ta = document.querySelector('textarea[placeholder*="Paste notes" i]');
    if (!ta) return "no-textarea";
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, "The Comtus study method: read, question, drill. Review at spaced intervals.");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    const save = [...document.querySelectorAll("button")].find(
      (b) => /^add source$/i.test((b.textContent || "").trim()) && !b.disabled
    );
    if (!save) return "no-add-source";
    save.click();
    await new Promise((r) => setTimeout(r, 1500));
    return "ok";
  })()
`);
check("source pasted & saved", pasted === "ok", String(pasted));

/* Chat against the mock endpoint via the real Send button. */
const sent = await evalJs(`
  (async () => {
    const ta = document.querySelector('textarea[placeholder*="Ask" i]');
    if (!ta) return "no-composer";
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, "What is the study method?");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const held = ta.value;
    const sendBtn = [...document.querySelectorAll('button[aria-label="Send message"]')].find((b) => !b.disabled);
    if (!sendBtn) return "send-disabled-or-missing, textarea=" + JSON.stringify(held);
    sendBtn.click();
    return "ok:" + held;
  })()
`);
check("chat message dispatched", /^ok:.+/.test(String(sent)), String(sent));

let replyText = "";
for (let i = 0; i < 24; i++) {
  await new Promise((r) => setTimeout(r, 700));
  replyText = (await evalJs("document.body.innerText")) || "";
  if (/Here is the plan/.test(replyText)) break;
}
if (!/Here is the plan/.test(replyText)) {
  const errNote = await evalJs(
    `(() => { const els=[...document.querySelectorAll("[class*=error],[class*=Error],[role=alert]")].map(e=>e.innerText.trim()).filter(Boolean); return els.join(" | ").slice(0,300) || "(no error banner)"; })()`,
  );
  console.log(`DIAG error banners: ${errNote}`);
}
check("streamed answer rendered", /Here is the plan/.test(replyText));

/* The Reasoning panel renders only when thinking deltas arrived; expand
   it and verify the actual reasoning_content text is there. */
const thinkOpen = await evalJs(`
  (async () => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /reasoning/i.test(b.textContent || "")
    );
    if (!btn) return "no-panel";
    btn.click();
    await new Promise((r) => setTimeout(r, 600));
    return document.body.innerText.includes("Weighing the sources") ? "ok" : "empty";
  })()
`);
check("thinking surfaced (reasoning_content)", thinkOpen === "ok", String(thinkOpen));
check("inline citation mined", /\[Smoke Source\]/.test(replyText));
check("mock served SSE (web pass)", sseServed >= 1, `hits=${sseServed}`);

/* ══ Part 2 — desk surface (Tauri flag faked) ═══════════════ */
const preDeskErrors = consoleErrors.length;
const bootedDesk = await bootStudio(true);
check("desk boots under faked Tauri flag", !!bootedDesk);

const deskHome = await until(
  `/COMTUS/.test(document.body.innerText) && (/library/i.test(document.body.innerText) || /new notebook/i.test(document.body.innerText))`,
  15000,
);
check("desk chrome renders (header + library rail)", !!deskHome);

const railState = await evalJs(`
  JSON.stringify({
    hasRailLabel: !!document.body.innerText.match(/library/i),
    hasNew: [...document.querySelectorAll("button")].some(b => /new notebook/i.test(b.getAttribute("aria-label")||"")),
    hasHeader: !!document.body.innerText.match(/COMTUS/),
  })
`);
console.log(`DIAG rail: ${railState}`);

/* Open the existing notebook through the rail — retry until the
   liveQuery populates the list and the click lands us in a workspace. */
const deskOpened = await until(
  `(() => {
    if (document.querySelector('textarea[placeholder*="Ask" i]')) return true;
    const item = [...document.querySelectorAll("button")].find(
      (b) => b.title === "Smoke Notebook" || b.getAttribute("aria-label") === "Smoke Notebook"
    );
    if (item) item.click();
    return false;
  })()`,
  20000,
);
const deskChatReady = await evalJs(`!!document.querySelector('textarea[placeholder*="Ask" i]')`);
check("desk: notebook opens into chat surface", !!(deskOpened && deskChatReady));

/* Send one message on the desk too — same pipeline, different shell. */
const deskSent = await evalJs(`
  (async () => {
    const ta = document.querySelector('textarea[placeholder*="Ask" i]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, "Summarize the method.");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const sendBtn = [...document.querySelectorAll('button[aria-label="Send message"]')].find((b) => !b.disabled);
    if (!sendBtn) return false;
    sendBtn.click();
    return true;
  })()
`);
let deskReply = "";
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 700));
  deskReply = (await evalJs("document.body.innerText")) || "";
  if (/lamplight/.test(deskReply)) break;
}
check("desk: streamed chat works end-to-end", !!(deskSent && /lamplight/.test(deskReply)), `hits=${sseServed}`);

/* Rail collapse toggle round-trips. */
const collapsed = await until(
  `(() => {
    if (document.querySelector('button[aria-label="Expand library"]')) return true;
    const btn = document.querySelector('button[aria-label="Collapse library"]');
    if (btn) btn.click();
    return false;
  })()`,
  10000,
);
check("desk: rail collapse toggles", !!collapsed);

/* The native window supports 800×560. At that size the library must stay
   compact and only one companion pane may compete with Chat. */
await send("Emulation.setDeviceMetricsOverride", {
  width: 800,
  height: 560,
  deviceScaleFactor: 1,
  mobile: false,
});
await new Promise((r) => setTimeout(r, 700));
const compactLayout = JSON.parse(
  (await evalJs(`JSON.stringify((() => {
    const box = (selector) => document.querySelector(selector)?.getBoundingClientRect().width ?? 0;
    const sources = box('aside[aria-label="Sources"]');
    const studio = box('aside[aria-label="Studio"]');
    return {
      library: box('aside[aria-label="Library"]'),
      chat: box('main'),
      expandedCompanions: [sources, studio].filter((width) => width > 100).length,
    };
  })())`)) || "{}",
);
check("desk: compact window keeps library slim", compactLayout.library <= 60, JSON.stringify(compactLayout));
check("desk: compact window preserves usable chat", compactLayout.chat >= 350, JSON.stringify(compactLayout));
check("desk: compact window shows at most one companion pane", compactLayout.expandedCompanions <= 1, JSON.stringify(compactLayout));

const returnedHome = await evalJs(`
  (() => {
    const button = document.querySelector('button[aria-label="Comtus home"]');
    if (!button) return false;
    button.click();
    return true;
  })()
`);
const homeReady = await until(
  `!!document.querySelector('main[aria-labelledby="desk-home-title"]')`,
  10000,
);
check("desk: Home remains reachable from Studio", !!(returnedHome && homeReady));
const homeScroll = await evalJs(`
  (() => {
    const home = document.querySelector('main[aria-labelledby="desk-home-title"]');
    if (!home) return false;
    return getComputedStyle(home).overflowY === "auto" && home.scrollHeight > home.clientHeight;
  })()
`);
check("desk: Home scrolls at minimum height", !!homeScroll);

const newDeskErrors = consoleErrors.slice(preDeskErrors).length;
check("desk pass adds no runtime exceptions", newDeskErrors === 0, consoleErrors.slice(preDeskErrors).join(" | ").slice(0, 200));

console.log("\nSUMMARY:", JSON.stringify(results));
try { ws.close(); } catch {}
try { child.kill(); } catch {}
setTimeout(() => {
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  mock.close();
  process.exit(results.every((r) => r.ok) ? 0 : 2);
}, 800);
