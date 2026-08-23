/* Read-only smoke against a running Windows Tauri WebView2 instance.
   Launch with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334,
   then run `node scripts/smoke-tauri-cdp.mjs 9334`. */

const portArg = process.argv.slice(2).find((value) => /^\d+$/.test(value));
const port = Number(portArg || 9334);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && /^https?:/.test(item.url));
if (!target) throw new Error(`No Tauri page target found on CDP port ${port}.`);

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let id = 0;
const pending = new Map();
const errors = [];
let documentCsp = "";
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === "Runtime.exceptionThrown") {
    errors.push(message.params?.exceptionDetails?.exception?.description || "runtime exception");
  }
  if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
    errors.push(message.params.entry.text);
  }
  if (message.method === "Network.responseReceived" && message.params?.type === "Document") {
    const headers = message.params.response?.headers ?? {};
    const entry = Object.entries(headers).find(
      ([name]) => name.toLowerCase() === "content-security-policy",
    );
    documentCsp = typeof entry?.[1] === "string" ? entry[1] : "";
  }
};

function send(method, params = {}) {
  return new Promise((resolve) => {
    const requestId = ++id;
    pending.set(requestId, resolve);
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.result?.exceptionDetails) {
    throw new Error(
      response.result.exceptionDetails.exception?.description ||
        response.result.exceptionDetails.text ||
        "Evaluation failed",
    );
  }
  return response.result?.result?.value;
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Page.enable");
await send("Page.reload", { ignoreCache: true });
for (let attempt = 0; attempt < 40; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (await evaluate('document.documentElement.dataset.shell === "desktop"')) break;
}

const state = JSON.parse(
  await evaluate(`(async () => JSON.stringify({
    href: location.href,
    tauri: Boolean(window.isTauri || window.__TAURI_INTERNALS__ || window.__TAURI__),
    shell: document.documentElement.dataset.shell || "",
    home: !!document.querySelector('button[aria-label="Comtus home"]'),
    studio: /Studio bench|Recent saved work/.test(document.body.innerText),
    body: document.body.innerText.slice(0, 240),
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || "",
    registrations: "serviceWorker" in navigator
      ? (await navigator.serviceWorker.getRegistrations()).length
      : 0,
    shellCaches: "caches" in window
      ? (await caches.keys()).filter((name) => name.startsWith("comtus-shell-")).length
      : 0,
  }))()`),
);
const isDevServer = /^http:\/\/(?:127\.0\.0\.1|localhost):/.test(state.href);
const effectiveCsp = state.csp || documentCsp;

check("native Tauri globals are injected", state.tauri, state.href);
check("native desktop shell is selected", state.shell === "desktop", `shell=${state.shell || "missing"}`);
check("native desktop Home is interactive", state.home && state.studio, state.body.replace(/\s+/g, " "));
check("legacy service workers are absent", state.registrations === 0, `registrations=${state.registrations}`);
check("legacy Comtus shell caches are absent", state.shellCaches === 0, `caches=${state.shellCaches}`);
check(
  "native CSP uses recognized directives",
  isDevServer ||
    (effectiveCsp.includes("default-src") &&
      effectiveCsp.includes("connect-src") &&
      !effectiveCsp.includes("defaultSrc")),
  isDevServer ? "verified in packaged-build smoke" : "",
);
check(
  "native CSP permits custom HTTPS and local model endpoints",
  isDevServer ||
    (effectiveCsp.includes("https:") &&
      effectiveCsp.includes("http://localhost:*") &&
      effectiveCsp.includes("http://127.0.0.1:*")),
  isDevServer ? "verified in packaged-build smoke" : "",
);
check(
  "native reload adds no runtime/CSP directive errors",
  errors.every((message) => !/unrecognized|module script|mime type|uncaught/i.test(message)),
  errors.join(" | ").slice(0, 240),
);

ws.close();
process.exit(results.every((result) => result.ok) ? 0 : 2);
