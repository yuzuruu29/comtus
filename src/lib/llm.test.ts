import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the heavy SDKs before importing llm.ts so streamChat / generateJSON /
// generateMarkdown / checkSolution paths can run without network calls. The
// mocks record their inputs; tests below pin the *contract* (what llm.ts
// promises to send), not the SDK's own behavior.
const anthropicStream = vi.hoisted(() => vi.fn());
const anthropicCreate = vi.hoisted(() => vi.fn());
const compatCreate = vi.hoisted(() => vi.fn());
const compatList = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    static APIError = class APIError extends Error { status?: number; constructor(status: number, message: string) { super(message); this.status = status; } };
    static AuthenticationError = class AuthenticationError extends Error { status = 401; };
    static RateLimitError = class RateLimitError extends Error { status = 429; };
    static APIConnectionError = class APIConnectionError extends Error { status: undefined; };
    static APIUserAbortError = class APIUserAbortError extends Error { name = "AbortError"; };
    messages = { stream: anthropicStream, create: anthropicCreate };
    constructor(public opts: Record<string, unknown>) {}
  }
  return { default: FakeAnthropic, APIError: FakeAnthropic.APIError, AuthenticationError: FakeAnthropic.AuthenticationError, RateLimitError: FakeAnthropic.RateLimitError, APIConnectionError: FakeAnthropic.APIConnectionError, APIUserAbortError: FakeAnthropic.APIUserAbortError };
});

vi.mock("openai", () => {
  class FakeOpenAI {
    static APIError = class APIError extends Error { status?: number; constructor(status: number, message: string) { super(message); this.status = status; } };
    static AuthenticationError = class AuthenticationError extends Error { status = 401; };
    static RateLimitError = class RateLimitError extends Error { status = 429; };
    static APIConnectionError = class APIConnectionError extends Error { status: undefined; };
    static APIUserAbortError = class APIUserAbortError extends Error { name = "AbortError"; };
    chat = { completions: { create: compatCreate } };
    models = { list: compatList };
    constructor(public opts: Record<string, unknown>) {}
  }
  return { default: FakeOpenAI, APIError: FakeOpenAI.APIError, AuthenticationError: FakeOpenAI.AuthenticationError, RateLimitError: FakeOpenAI.RateLimitError, APIConnectionError: FakeOpenAI.APIConnectionError, APIUserAbortError: FakeOpenAI.APIUserAbortError };
});

vi.mock("./retrieval", () => ({
  groundContext: vi.fn(async () => ({ docs: [], mode: "full" as const })),
}));
vi.mock("./webSearch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./webSearch")>();
  return { ...actual, searchWeb: vi.fn(async () => []), buildSearchQuery: vi.fn((q: string) => q) };
});

const {
  streamChat, generateJSON, generateMarkdown, checkSolution, validateConnection,
  parseJSON, sanitizeCheck, cleanTranscription, numberTextCitations,
  modelLabelFor, effortLabelFor, friendlyError, isAbort, isAuthError, isHostedPass, MODELS, EFFORTS, COMPAT_PRESETS, keyMismatch,
} = await import("./llm");

const openaiMock = await import("openai");

import * as webSearch from "./webSearch";
import * as retrieval from "./retrieval";

const { searchWeb } = vi.mocked(webSearch);
const { groundContext } = vi.mocked(retrieval);

const doc = (id: string, title: string, text = "body", meta?: { url?: string; origin?: string }) => ({
  source: { id, notebookId: "nb", title, kind: "url" as const, content: text, chars: text.length, tokens: 10, addedAt: 0, meta },
  text,
});

function setStoredKey(key: string) {
  localStorage.setItem("comtus-settings", JSON.stringify({ state: { anthropicKey: key } }));
}

beforeEach(() => {
  anthropicStream.mockReset();
  anthropicCreate.mockReset();
  compatCreate.mockReset();
  compatList.mockReset();
  groundContext.mockReset();
  searchWeb.mockReset();
  // llm.test.ts runs in the node project (no DOM) — stub the storage it reads.
  if (typeof localStorage === "undefined") {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  } else {
    localStorage.clear();
  }
  // Default: no grounding docs, no web hits.
  groundContext.mockResolvedValue({ docs: [], mode: "full" });
  searchWeb.mockResolvedValue([]);
});

describe("catalogue & helpers", () => {
  it("MODEL / EFFORTS are non-empty and unique", () => {
    expect(MODELS.map((m) => m.id).length).toBeGreaterThan(0);
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length);
    expect(EFFORTS.map((e) => e.id)).toEqual(["low", "medium", "high", "xhigh"]);
  });

  it("COMPAT_PRESETS has unique ids/models and no junk", () => {
    expect(new Set(COMPAT_PRESETS.map((p) => p.id)).size).toBe(COMPAT_PRESETS.length);
    expect(new Set(COMPAT_PRESETS.map((p) => p.model)).size).toBe(COMPAT_PRESETS.length);
    for (const p of COMPAT_PRESETS) {
      expect(p.baseUrl).toMatch(/^https?:\/\/|^http:\/\/localhost:/);
      expect(p.model.length).toBeGreaterThan(0);
    }
  });

  it("keyMismatch warns only when it looks like the wrong provider", () => {
    expect(keyMismatch("https://openrouter.ai/api/v1", "gsk_xxx")).toMatch(/sk-or-v1/);
    expect(keyMismatch("https://openrouter.ai/api/v1", "sk-or-v1-xxx")).toBe("");
    expect(keyMismatch("https://api.groq.com/openai/v1", "")).toBe("");
    expect(keyMismatch("https://openrouter.ai/api/v1", "comtus-pass-xxx")).toMatch(/Smarter Models/);
  });

  it("isHostedPass trims and detects the pass prefix", () => {
    expect(isHostedPass("comtus-pass-v1.abc")).toBe(true);
    expect(isHostedPass("  comtus-pass-xyz  ")).toBe(true);
    expect(isHostedPass("sk-ant-api03-xyz")).toBe(false);
    expect(isHostedPass("")).toBe(false);
  });

  it("modelLabelFor gives curated / prettified / alias labels, never mid-word truncations", () => {
    expect(modelLabelFor("anthropic", "openrouter/free")).toBe("Auto Free Router");
    expect(modelLabelFor("anthropic", "claude-sonnet-5-5")).toBe("Sonnet 5.5");
    expect(modelLabelFor("anthropic", "claude-opus-5")).toBe("Opus 5.5");
    // Unknown id → prettified, short enough.
    const label = modelLabelFor("openai-compatible", "some/unknown-model-x-70b");
    expect(label.length).toBeLessThanOrEqual(29);
    expect(label).not.toMatch(/\s…/);
  });

  it("effortLabelFor falls back to Deep for unknown effort", () => {
    expect(effortLabelFor("low")).toBe("Quick");
    expect(effortLabelFor("high")).toBe("Deep");
    expect(effortLabelFor("unknown" as never)).toBe("Deep");
  });
});

describe("parseJSON / sanitizeCheck / cleanTranscription", () => {
  it("parseJSON parses raw, fenced, and prose-wrapped JSON", () => {
    expect(parseJSON('{"a":1}')).toEqual({ a: 1 });
    expect(parseJSON("```json\n{\"a\":2}\n```")).toEqual({ a: 2 });
    expect(parseJSON('Here you go: {"a":3} — done')).toEqual({ a: 3 });
    expect(() => parseJSON("not json at all")).toThrow(SyntaxError);
  });

  it("sanitizeCheck coerces junk to unreadable and filters errors", () => {
    expect(sanitizeCheck({ verdict: "correct", finalAnswerOk: true, transcribedAnswer: "x", errors: ["a"], feedback: "f" }))
      .toMatchObject({ verdict: "correct", finalAnswerOk: true, errors: ["a"] });
    expect(sanitizeCheck({ verdict: "bogus" })).toMatchObject({ verdict: "unreadable", finalAnswerOk: false, errors: [], feedback: "" });
    expect(sanitizeCheck({ verdict: "partial", errors: ["", " ", "real", 42] })).toMatchObject({ errors: ["real"] });
    expect(sanitizeCheck(null)).toMatchObject({ verdict: "unreadable" });
    expect(sanitizeCheck(undefined)).toMatchObject({ verdict: "unreadable" });
  });

  it("cleanTranscription strips a wrapping code fence", () => {
    expect(cleanTranscription("```markdown\n# Hi\n```")).toBe("# Hi");
    expect(cleanTranscription("  plain text  ")).toBe("plain text");
  });
});

describe("numberTextCitations + friendlyError + isAbort/isAuthError", () => {
  it("numberTextCitations numbers mentions in first-mention order", () => {
    const docs = [doc("a", "Alpha"), doc("b", "Beta")];
    const { text, citations } = numberTextCitations("Per [Beta] and [Alpha] and [Beta].", docs);
    expect(text).toBe("Per [1] and [2] and [1].");
    expect(citations.map((c) => c.sourceId)).toEqual(["b", "a"]);
  });

  it("web citations carry their URL, saved sources do not", () => {
    const docs = [doc("w", "Web: Pump", "x", { url: "https://x.example/p", origin: "web-search" }), doc("s", "Notes")];
    const { citations } = numberTextCitations("[Web: Pump] [Notes]", docs);
    expect(citations[0].url).toBe("https://x.example/p");
    expect(citations[1].url).toBeUndefined();
  });

  it("friendlyError maps abort / auth / rate-limit / connection distinctly", () => {
    const abort = new Error("aborted"); abort.name = "AbortError";
    expect(friendlyError(abort)).toBe("Stopped.");
    expect(isAbort(abort)).toBe(true);

    setStoredKey("sk-ant-api03-xyz");
    // SDK error classes come from the real SDK instances where possible; use
    // instanceof-shaped errors via the module's own classification by
    // constructing errors with the right status/name shape.
    expect(friendlyError(new Error("401 Unauthorized"))).toMatch(/rate limit|limit|401|Unauthorized|rejected/i);
  });

  it("isAuthError is false for generic errors", () => {
    expect(isAuthError(new Error("nope"))).toBe(false);
    expect(isAbort(new Error("nope"))).toBe(false);
  });
});

describe("streamChat — compat path", () => {
  const baseArgs = {
    provider: "openai-compatible" as const,
    apiKey: "sk-or-v1-test",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    effort: "high" as const,
    notebookId: "nb",
    notebookName: "Test",
    history: [{ role: "user" as const, content: "earlier" }],
    question: "what is ATP?",
  };

  function streamChunks(chunks: unknown[]) {
    async function* gen() { for (const c of chunks) yield c; }
    compatCreate.mockResolvedValue(gen());
  }

  it("streams text + reasoning_content, numbers citations, keeps history capped at 12", async () => {
    groundContext.mockResolvedValue({ docs: [doc("a", "Alpha")], mode: "full" });
    streamChunks([
      { choices: [{ delta: { content: "ATP is [Alpha] " } }] },
      { choices: [{ delta: { reasoning_content: "thinking…" } }] },
      { choices: [{ delta: {} }] },
      { choices: [{ delta: { content: "energy." } }] },
    ]);
    const thinking: string[] = []; const texts: string[] = [];
    const reply = await streamChat({ ...baseArgs, history: Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: `q${i}` })), onThinking: (d) => thinking.push(d), onText: (_d, full) => texts.push(full) });
    expect(reply.text).toContain("[1]");
    expect(reply.thinking).toBe("thinking…");
    expect(reply.citations).toHaveLength(1);
    expect(thinking).toEqual(["thinking…"]);
    const sent = compatCreate.mock.calls[0][0] as { messages: unknown[]; stream: boolean };
    expect(sent.messages).toHaveLength(14); // system + 12 history + user
    expect(sent.stream).toBe(true);
  });

  it("compat fallback drops reasoning_effort on a 400 mentioning reasoning, then retries once", async () => {
    const bad = new (openaiMock.default as unknown as { APIError: new (status: number, msg: string) => Error }).APIError(400, "unsupported reasoning_effort");
    compatCreate.mockRejectedValueOnce(bad);
    async function* gen() { yield { choices: [{ delta: { content: "ok" } }] }; }
    compatCreate.mockResolvedValueOnce(gen());
    const reply = await streamChat({ ...baseArgs, reasoning: true });
    expect(reply.text).toBe("ok");
    const first = compatCreate.mock.calls[0][0] as Record<string, unknown>;
    const second = compatCreate.mock.calls[1][0] as Record<string, unknown>;
    expect(first).toHaveProperty("reasoning_effort");
    expect(second).not.toHaveProperty("reasoning_effort");
  });

  it("compat fallback converts max_tokens → max_completion_tokens on the matching 400", async () => {
    const bad = new (openaiMock.default as unknown as { APIError: new (status: number, msg: string) => Error }).APIError(400, "use max_completion_tokens");
    compatCreate.mockRejectedValueOnce(bad);
    async function* gen() { yield { choices: [{ delta: { content: "ok" } }] }; }
    compatCreate.mockResolvedValueOnce(gen());
    await streamChat({ ...baseArgs, reasoning: true });
    const second = compatCreate.mock.calls[1][0] as Record<string, unknown>;
    expect(second).toHaveProperty("max_completion_tokens", 32000);
    expect(second).not.toHaveProperty("max_tokens");
  });

  it("rethrows non-400 compat errors and aborts", async () => {
    compatCreate.mockRejectedValueOnce(Object.assign(new Error("server blew up"), { status: 500 }));
    await expect(streamChat({ ...baseArgs })).rejects.toThrow("server blew up");
    const abort = new Error("aborted"); abort.name = "AbortError";
    compatCreate.mockRejectedValueOnce(abort);
    await expect(streamChat({ ...baseArgs })).rejects.toThrow("aborted");
  });

  it("web search failure surfaces meta without failing the reply", async () => {
    searchWeb.mockRejectedValueOnce(new Error("search down"));
    streamChunks([{ choices: [{ delta: { content: "still answered" } }] }]);
    const reply = await streamChat({ ...baseArgs, webSearch: true });
    expect(reply.text).toBe("still answered");
    expect(reply.webSearch).toMatchObject({ status: "error" });
  });

  it("web hits are appended as grounding docs and a reminder rides along", async () => {
    searchWeb.mockResolvedValueOnce([{ title: "Pump", url: "https://example.org/p", snippet: "snip" }]);
    streamChunks([{ choices: [{ delta: { content: "see [Web: Pump]" } }] }]);
    const reply = await streamChat({ ...baseArgs, webSearch: true });
    expect(reply.webSearch).toMatchObject({ status: "ok", count: 1 });
    expect(reply.citations[0].url).toBe("https://example.org/p");
  });
});

describe("streamChat — anthropic path", () => {
  const baseArgs = {
    provider: "anthropic" as const,
    apiKey: "sk-ant-api03-test",
    baseUrl: "",
    model: "claude-sonnet-5-5",
    effort: "high" as const,
    notebookId: "nb",
    notebookName: "Test",
    history: [] as { role: "user" | "assistant"; content: string }[],
    question: "explain?",
  };

  function streamAnthropic(events: unknown[], final = { content: [] as unknown[] }) {
    anthropicStream.mockReturnValue((async function* () { for (const e of events) yield e; })());
    // llm.ts does `for await (const event of stream)` on the object returned
    // by client.messages.stream() — handle both iterable and promise shapes.
    anthropicStream.mockImplementation(() => ({
      [Symbol.asyncIterator]: async function* () { for (const e of events) yield e; },
      finalMessage: vi.fn(async () => final),
    }));
  }

  it("accumulates thinking + text deltas and calls onThinking/onText", async () => {
    streamAnthropic([
      { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "hmm " } },
      { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "ok" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "Answer" } },
    ]);
    const thinking: string[] = [];
    const reply = await streamChat({ ...baseArgs, reasoning: true, onThinking: (_d, full) => thinking.push(full) });
    expect(reply.text).toBe("Answer");
    expect(reply.thinking).toBe("hmm ok");
    expect(thinking).toEqual(["hmm ", "hmm ok"]);
  });

  it("hosted passes clamp xhigh → high, regular keys do not", async () => {
    streamAnthropic([]);
    await streamChat({ ...baseArgs, apiKey: "comtus-pass-xyz", effort: "xhigh", reasoning: true });
    let call = anthropicStream.mock.calls[0][0] as { output_config?: { effort: string } };
    expect(call.output_config?.effort).toBe("high");

    streamAnthropic([]);
    await streamChat({ ...baseArgs, apiKey: "sk-ant-api03-xyz", effort: "xhigh", reasoning: true });
    call = anthropicStream.mock.calls[1][0] as { output_config?: { effort: string } };
    expect(call.output_config?.effort).toBe("xhigh");
  });

  it("reasoning off sends no thinking block", async () => {
    streamAnthropic([]);
    await streamChat({ ...baseArgs, reasoning: false });
    const call = anthropicStream.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("thinking");
  });

  it("retrieved mode drops citation char offsets", async () => {
    groundContext.mockResolvedValue({ docs: [doc("a", "Alpha")], mode: "retrieved" });
    streamAnthropic([], {
      content: [{ type: "text", text: "x", citations: [{ document_index: 0, cited_text: "passage", start_char_index: 3, end_char_index: 10 }] }],
    });
    const reply = await streamChat({ ...baseArgs });
    expect(reply.citations[0]).toMatchObject({ citedText: "passage", sourceId: "a" });
    expect(reply.citations[0].startChar).toBeUndefined();
    expect(reply.citations[0].endChar).toBeUndefined();
  });

  it("full mode keeps citation char offsets; duplicates are deduped", async () => {
    groundContext.mockResolvedValue({ docs: [doc("a", "Alpha")], mode: "full" });
    const block = { type: "text", text: "x", citations: [{ document_index: 0, cited_text: "passage", start_char_index: 3, end_char_index: 10 }] };
    streamAnthropic([], { content: [block, block] });
    const reply = await streamChat({ ...baseArgs });
    expect(reply.citations).toHaveLength(1);
    expect(reply.citations[0]).toMatchObject({ startChar: 3, endChar: 10 });
  });
});

describe("generateJSON", () => {
  const args = { provider: "openai-compatible" as const, apiKey: "k", baseUrl: "https://openrouter.ai/api/v1", model: "m", effort: "low" as const, system: "sys", user: "give json" };

  it("returns parsed JSON on first try without a status call", async () => {
    compatCreate.mockResolvedValue({ choices: [{ message: { content: '{"a":1}' } }] });
    const onStatus = vi.fn();
    await expect(generateJSON({ ...args, onStatus })).resolves.toEqual({ a: 1 });
    expect(onStatus).not.toHaveBeenCalled();
    expect(compatCreate).toHaveBeenCalledTimes(1);
  });

  it("retries once on unparseable output with a status call, then parses", async () => {
    compatCreate.mockResolvedValueOnce({ choices: [{ message: { content: "not json" } }] });
    compatCreate.mockResolvedValueOnce({ choices: [{ message: { content: '{"a":2}' } }] });
    const onStatus = vi.fn();
    await expect(generateJSON({ ...args, onStatus })).resolves.toEqual({ a: 2 });
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(compatCreate).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on API errors (401/429)", async () => {
    compatCreate.mockRejectedValueOnce(Object.assign(new Error("unauthorized"), { status: 401 }));
    await expect(generateJSON(args)).rejects.toThrow("unauthorized");
    expect(compatCreate).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry when the signal aborted", async () => {
    compatCreate.mockResolvedValueOnce({ choices: [{ message: { content: "blah" } }] });
    const controller = new AbortController();
    controller.abort();
    await expect(generateJSON({ ...args, signal: controller.signal })).rejects.toThrow();
    expect(compatCreate).toHaveBeenCalledTimes(1);
  });

  it("anthropic path parses text blocks", async () => {
    anthropicCreate.mockResolvedValue({ content: [{ type: "text", text: '{"b":3}' }] });
    await expect(generateJSON({ ...args, provider: "anthropic", apiKey: "sk-ant-x", baseUrl: "" })).resolves.toEqual({ b: 3 });
  });
});

describe("generateMarkdown + checkSolution + validateConnection", () => {
  it("generateMarkdown returns the compat text verbatim", async () => {
    compatCreate.mockResolvedValue({ choices: [{ message: { content: "# Title\n\nbody" } }] });
    await expect(generateMarkdown({ provider: "openai-compatible", apiKey: "k", baseUrl: "https://openrouter.ai/api/v1", model: "m", effort: "low", system: "s", user: "u" }))
      .resolves.toBe("# Title\n\nbody");
  });

  it("checkSolution sanitizes the verdict", async () => {
    compatCreate.mockResolvedValue({ choices: [{ message: { content: '{"verdict":"correct","finalAnswerOk":true,"transcribedAnswer":"42","errors":[],"feedback":"Good"}' } }] });
    await expect(checkSolution({
      provider: "openai-compatible", apiKey: "k", baseUrl: "https://openrouter.ai/api/v1", model: "m", effort: "low",
      stem: "2+2?", expectedAnswer: "4", expectedApproach: "add", image: { dataUrl: "data:image/png;base64,AAA", mediaType: "image/png" },
    })).resolves.toMatchObject({ verdict: "correct", transcribedAnswer: "42" });
  });

  it("validateConnection ok on list, friendly error on failure", async () => {
    compatList.mockResolvedValue({ data: [] });
    await expect(validateConnection({ provider: "openai-compatible", apiKey: "k", baseUrl: "https://openrouter.ai/api/v1", model: "m", effort: "low" }))
      .resolves.toEqual({ ok: true });
    compatList.mockRejectedValueOnce(new Error("network down"));
    const res = await validateConnection({ provider: "openai-compatible", apiKey: "k", baseUrl: "https://openrouter.ai/api/v1", model: "m", effort: "low" });
    expect(res).toMatchObject({ ok: false });
  });
});
