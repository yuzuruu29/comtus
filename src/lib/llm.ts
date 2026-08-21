import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AnthropicModelId, Citation, Effort, ProviderId } from "./types";
import { groundContext, type GroundingDoc } from "./retrieval";

/**
 * The lamp. Two ways to light it:
 *  - Anthropic (official SDK): adaptive thinking, streaming with visible
 *    reasoning, API-native citations on source documents.
 *  - OpenAI-compatible (OpenAI SDK against any baseURL): OpenRouter,
 *    Ollama, LM Studio, Groq, DeepSeek, Together, vLLM, OpenAI itself.
 *    Reasoning surfaces when the model exposes reasoning deltas; grounding
 *    works everywhere, citations degrade to inline [Title] mentions.
 */

/* ── Catalogue ────────────────────────────────────────────── */

export const MODELS: {
  id: AnthropicModelId;
  label: string;
  note: string;
  ctx: string;
  badge: string;
}[] = [
  {
    id: "claude-opus-5",
    label: "Opus 5",
    note: "Deepest reasoning · complex synthesis",
    ctx: "200k ctx",
    badge: "Deepest",
  },
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    note: "Faster, lighter · swift revisions",
    ctx: "200k ctx",
    badge: "Fast",
  },
];

export const EFFORTS: { id: Effort; label: string }[] = [
  { id: "medium", label: "Steady" },
  { id: "high", label: "Deep" },
  { id: "xhigh", label: "Exhaustive" },
];

export const COMPAT_PRESETS: { id: string; label: string; baseUrl: string; note: string }[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    note: "hundreds of open & closed models, one key",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    note: "very fast open models · free tier",
  },
  {
    id: "zen",
    label: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    note: "curated frontier open models · free",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    note: "wafer-scale speed · free tier",
  },
  {
    id: "google",
    label: "Google AI Studio",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    note: "Gemini models · free tier",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    note: "cheap reasoners",
  },
  {
    id: "together",
    label: "Together",
    baseUrl: "https://api.together.xyz/v1",
    note: "hosted open models",
  },
  {
    id: "ollama",
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    note: "local & free — no key needed",
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    note: "local & free — no key needed",
  },
];

/** Everything a call needs, resolved from the settings store. */
export interface CallSettings {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string; // anthropic: "" = official; compat: full base incl /v1
  model: string;
  effort: Effort;
}

export const HOSTED_ANTHROPIC_KEY =
  (import.meta.env.VITE_HOSTED_ANTHROPIC_KEY as string) ||
  "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";

export function resolveAnthropicKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.startsWith("sk-ant-")) return trimmed;
  if (trimmed.startsWith("comtus-pass-") || trimmed.length > 5) {
    return HOSTED_ANTHROPIC_KEY;
  }
  return HOSTED_ANTHROPIC_KEY || trimmed;
}

/* ── Clients ──────────────────────────────────────────────── */

function getAnthropic(cs: CallSettings): Anthropic {
  return new Anthropic({
    apiKey: resolveAnthropicKey(cs.apiKey),
    ...(cs.baseUrl.trim() ? { baseURL: cs.baseUrl.trim() } : {}),
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  });
}

function getCompat(cs: CallSettings): OpenAI {
  return new OpenAI({
    // Local endpoints (Ollama/LM Studio) need no key; the SDK demands a
    // non-empty string, so stand-ins are fine — they're never validated.
    apiKey: cs.apiKey.trim() || "comtus-local",
    baseURL: cs.baseUrl,
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
    defaultHeaders: { "X-Title": "Comtus" },
  });
}

export function isAbort(err: unknown): boolean {
  return (
    err instanceof Anthropic.APIUserAbortError ||
    err instanceof OpenAI.APIUserAbortError ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export function friendlyError(err: unknown): string {
  if (isAbort(err)) return "Stopped.";
  const auth = err instanceof Anthropic.AuthenticationError || err instanceof OpenAI.AuthenticationError;
  if (auth)
    return "The API key was rejected. Check it in Settings — the lamp can't light without it.";
  const rate = err instanceof Anthropic.RateLimitError || err instanceof OpenAI.RateLimitError;
  if (rate) return "Rate limited by the API. Wait a moment and try again.";
  if (err instanceof Anthropic.APIError || err instanceof OpenAI.APIError)
    return `The API returned ${err.status}. ${err.message.slice(0, 180)}`;
  return err instanceof Error ? err.message : "Something went wrong.";
}

/* ── Shared prompt furniture ──────────────────────────────── */

const HOUSE_RULES = `Rules of the house:
- Ground every substantive claim in the provided source documents. Never invent page numbers or quotes.
- If the sources don't contain the answer, say so plainly and answer from general knowledge only if you flag that you've stepped outside the sources.
- Non-Text / Scanned / Image Sources & Hybrid OCR:
  * For non-text based sources, scanned PDFs, diagrams, handwriting, or image files:
  * 1. Force hybrid OCR & visual extraction: Exhaustively transcribe and interpret all visible text, tables, formulas, diagrams, and handwriting from the source.
  * 2. Transparently admit capability limitations: If your active model endpoint lacks direct multimodal vision / OCR capability, or if the scanned content is unreadable or degraded, YOU MUST ADMIT THIS HONESTLY to the user in your response. State plainly: "This document is a non-text / scanned image source. My current model endpoint lacks direct vision/OCR capability to decipher this content reliably. Please switch to a vision-capable model (such as Claude Sonnet 5 / Opus 5 or Gemini 2.0 Flash) or upload a text-transcribed version."
  * 3. Never invent, hallucinate, or pretend to read text from unreadable or non-transcribed scanned imagery.
- Think before answering on anything nontrivial: plan, weigh, verify.
- Format with markdown: short paragraphs, headers when structure helps, tables for comparisons, math in plain notation.
- Tone: calm, encouraging, never sycophantic. No exclamation marks. Treat the user as a capable adult preparing for something that matters.`;

const CHAT_SYSTEM = `You are Comtus, a thinking study companion — a warm, precise scholar working by lamplight.

${HOUSE_RULES}`;

const CHAT_SYSTEM_COMPAT = `You are Comtus, a thinking study companion — a warm, precise scholar working by lamplight.

${HOUSE_RULES}
- Cite sources inline by wrapping the source's exact title in square brackets, e.g. [Title], wherever a claim leans on it.`;

function groundingPreamble(docs: GroundingDoc[], mode: "full" | "retrieved", notebookName: string, anthropic: boolean): string {
  const sourceList = docs.map((d, i) => `[${i}] ${d.source.title}`).join("\n");
  return `Notebook: "${notebookName}" — ${docs.length} source document(s) attached:
${sourceList || "(no sources yet — be honest that the notebook is empty)"}
Grounding mode: ${mode === "full" ? "the complete sources are attached" : "the most relevant segments are attached"}.${anthropic ? "" : "\nSources follow, each wrapped in <<<SOURCE: Title>>> markers."}`;
}

/* ── Grounded chat ────────────────────────────────────────── */

export interface StreamChatArgs extends CallSettings {
  notebookId: string;
  notebookName: string;
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
  signal?: AbortSignal;
  onThinking?: (delta: string, full: string) => void;
  onText?: (delta: string, full: string) => void;
}

export interface ChatReply {
  text: string;
  thinking: string;
  citations: Citation[];
}

export async function streamChat(args: StreamChatArgs): Promise<ChatReply> {
  const { docs, mode } = await groundContext(args.notebookId, args.question);
  const reply =
    args.provider === "anthropic"
      ? await streamAnthropic(args, docs, mode)
      : await streamCompatible(args, docs, mode);
  return reply;
}

async function streamAnthropic(
  args: StreamChatArgs,
  docs: GroundingDoc[],
  mode: "full" | "retrieved",
): Promise<ChatReply> {
  const client = getAnthropic(args);

  const content: Anthropic.ContentBlockParam[] = docs.map((d, i) => ({
    type: "document" as const,
    source: { type: "text" as const, media_type: "text/plain", data: d.text },
    title: d.source.title,
    citations: { enabled: true },
    context: `Source [${i}] of this notebook`,
  }));
  content.push({ type: "text", text: args.question });

  const stream = client.messages.stream(
    {
      model: args.model,
      max_tokens: 64000,
      system: `${CHAT_SYSTEM}\n\n${groundingPreamble(docs, mode, args.notebookName, true)}`,
      messages: [
        ...args.history.slice(-12),
        { role: "user", content },
      ] satisfies Anthropic.MessageParam[],
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: args.effort },
    },
    { signal: args.signal },
  );

  let thinking = "";
  let text = "";

  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      if (event.delta.type === "thinking_delta") {
        thinking += event.delta.thinking;
        args.onThinking?.(event.delta.thinking, thinking);
      } else if (event.delta.type === "text_delta") {
        text += event.delta.text;
        args.onText?.(event.delta.text, text);
      }
    }
  }

  const final = await stream.finalMessage();
  // In retrieved mode the model saw stitched segments, so its char
  // offsets don't line up with the stored source text — drop them
  // rather than highlight the wrong passage.
  const citations = mapCitations(final, docs).map((c) =>
    mode === "retrieved" ? { ...c, startChar: undefined, endChar: undefined } : c,
  );
  return { text, thinking, citations };
}

async function streamCompatible(
  args: StreamChatArgs,
  docs: GroundingDoc[],
  mode: "full" | "retrieved",
): Promise<ChatReply> {
  const client = getCompat(args);
  const sourcesText = docs
    .map((d) => `<<<SOURCE: ${d.source.title}>>>\n${d.text}\n<<<END SOURCE>>>`)
    .join("\n\n");
  const userContent = docs.length
    ? `Sources:\n\n${sourcesText}\n\n---\n\nQuestion: ${args.question}`
    : `Question: ${args.question}`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: `${CHAT_SYSTEM_COMPAT}\n\n${groundingPreamble(docs, mode, args.notebookName, false)}` },
    ...args.history.slice(-12),
    { role: "user", content: userContent },
  ];

  type StreamingBody = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming;

  // Some endpoints reject optional params (reasoning_effort, max_tokens).
  // Fall back through progressively plainer request shapes.
  const base = {
    model: args.model,
    messages,
    stream: true as const,
    max_tokens: 32000,
    reasoning_effort: args.effort === "xhigh" ? ("high" as const) : args.effort,
  };
  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await client.chat.completions.create(base as StreamingBody, {
      signal: args.signal,
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    const msg = err instanceof Error ? err.message : "";
    if (!(err instanceof OpenAI.APIError && err.status === 400)) throw err;
    if (/reasoning/i.test(msg)) {
      const { reasoning_effort: _drop, ...rest } = base;
      stream = await client.chat.completions.create(rest as StreamingBody, {
        signal: args.signal,
      });
    } else if (/max_completion_tokens/i.test(msg)) {
      const { max_tokens: _mt, ...rest } = base;
      stream = await client.chat.completions.create(
        { ...rest, max_completion_tokens: 32000 } as unknown as StreamingBody,
        { signal: args.signal },
      );
    } else {
      throw err;
    }
  }

  let thinking = "";
  let text = "";
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta as
      | (OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta & {
          reasoning_content?: string | null;
          reasoning?: string | null;
        })
      | undefined;
    if (!delta) continue;
    const think = delta.reasoning_content ?? delta.reasoning;
    if (typeof think === "string" && think) {
      thinking += think;
      args.onThinking?.(think, thinking);
    }
    if (typeof delta.content === "string" && delta.content) {
      text += delta.content;
      args.onText?.(delta.content, text);
    }
  }

  // No citation API here — mine the inline [Title] mentions instead.
  return { text, thinking, citations: extractTextCitations(text, docs) };
}

/** Match [Title] mentions in the answer against known source titles. */
export function extractTextCitations(text: string, docs: GroundingDoc[]): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<number>();
  const re = /\[([^\[\]\n]{2,80})\]/g;
  for (const match of text.matchAll(re)) {
    const mention = match[1].trim();
    const idx = docs.findIndex(
      (d) => d.source.title.toLowerCase() === mention.toLowerCase(),
    );
    if (idx === -1 || seen.has(idx)) continue;
    seen.add(idx);
    out.push({
      documentIndex: idx,
      sourceId: docs[idx].source.id,
      sourceTitle: docs[idx].source.title,
      citedText: "",
    });
  }
  return out;
}

/* ── Anthropic citation mapping ───────────────────────────── */

/** Version-proof view of a citation block — the SDK's union shape has
 *  shifted across releases, so read it structurally. */
interface LooseCitation {
  document_index?: number;
  cited_text: string;
  start_char_index?: number;
  end_char_index?: number;
}

function mapCitations(message: Anthropic.Message, docs: GroundingDoc[]): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  for (const block of message.content) {
    if (block.type !== "text" || !block.citations) continue;
    for (const c of block.citations) {
      const lc = c as unknown as LooseCitation;
      const doc = docs[lc.document_index ?? -1];
      if (!doc) continue;
      const key = `${lc.document_index}:${lc.start_char_index ?? "p"}:${lc.end_char_index ?? ""}:${lc.cited_text.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        documentIndex: lc.document_index ?? 0,
        sourceId: doc.source.id,
        sourceTitle: doc.source.title,
        citedText: lc.cited_text,
        startChar: lc.start_char_index,
        endChar: lc.end_char_index,
      });
    }
  }
  return out;
}

/* ── Structured generation (quizzes, exams, essays, aids) ── */

export interface GenerateArgs extends CallSettings {
  system: string;
  user: string;
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
}

const JSON_NAG = `\n\nCRITICAL: your previous reply was not parseable. Respond with ONLY the raw JSON value — no prose, no code fences, no commentary.`;
const JSON_ASK = `\n\nRespond with ONLY the raw JSON value matching the requested shape — no prose, no code fences.`;

/** Ask for JSON, parse defensively, retry once — but only on parse
 *  failures, never on API errors (a 401 doesn't get better by asking
 *  again, and a 429 doesn't need company). */
export async function generateJSON<T>(args: GenerateArgs): Promise<T> {
  const askRaw = async (nag: boolean): Promise<string> => {
    const prompt = args.user + (nag ? JSON_NAG : JSON_ASK);
    if (args.provider === "anthropic") {
      const response = await getAnthropic(args).messages.create(
        {
          model: args.model,
          max_tokens: 64000,
          system: args.system,
          messages: [{ role: "user", content: prompt }],
          thinking: { type: "adaptive", display: "omitted" },
          output_config: { effort: args.effort },
        },
        { signal: args.signal },
      );
      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    }
    const response = await createCompatNonStream(args, [
      { role: "system", content: args.system },
      { role: "user", content: prompt },
    ]);
    return response;
  };

  const raw = await askRaw(false);
  try {
    return parseJSON<T>(raw);
  } catch (err) {
    if (!(err instanceof SyntaxError) || args.signal?.aborted) throw err;
    args.onStatus?.("The first draft didn't parse — asking again, more firmly…");
    return parseJSON<T>(await askRaw(true));
  }
}

/** One non-streaming completion on the compatible path, with the same
 *  400-shape fallbacks as streaming. Returns text content only. */
async function createCompatNonStream(
  cs: CallSettings,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  signal?: AbortSignal,
): Promise<string> {
  const client = getCompat(cs);
  type NonStreamingBody = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
  const base = {
    model: cs.model,
    messages,
    max_tokens: 32000,
    reasoning_effort: cs.effort === "xhigh" ? ("high" as const) : cs.effort,
  };
  let text = "";
  try {
    const res = await client.chat.completions.create(base as NonStreamingBody, { signal });
    text = res.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    if (isAbort(err)) throw err;
    const msg = err instanceof Error ? err.message : "";
    if (!(err instanceof OpenAI.APIError && err.status === 400)) throw err;
    if (/reasoning/i.test(msg)) {
      const { reasoning_effort: _drop, ...rest } = base;
      const res = await client.chat.completions.create(rest as NonStreamingBody, { signal });
      text = res.choices?.[0]?.message?.content ?? "";
    } else if (/max_completion_tokens/i.test(msg)) {
      const { max_tokens: _mt, ...rest } = base;
      const res = await client.chat.completions.create(
        { ...rest, max_completion_tokens: 32000 } as unknown as NonStreamingBody,
        { signal },
      );
      text = res.choices?.[0]?.message?.content ?? "";
    } else {
      throw err;
    }
  }
  return text;
}

/** Tolerant JSON extraction: try as-is first, then strip fences and
 *  surrounding prose only if that fails. */
export function parseJSON<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* fall through to extraction */
  }
  let s = trimmed;
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.search(/[{[]/);
  if (start > 0) s = s.slice(start);
  const lastBrace = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (lastBrace !== -1 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  return JSON.parse(s) as T;
}

/* ── Markdown document generation (study aids, essay feedback) ── */

export async function generateMarkdown(args: GenerateArgs): Promise<string> {
  if (args.provider === "anthropic") {
    const response = await getAnthropic(args).messages.create(
      {
        model: args.model,
        max_tokens: 32000,
        system: args.system,
        messages: [{ role: "user", content: args.user }],
        thinking: { type: "adaptive", display: "omitted" },
        output_config: { effort: args.effort },
      },
      { signal: args.signal },
    );
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return createCompatNonStream(
    args,
    [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    args.signal,
  );
}

/* ── Connection checks & model discovery ──────────────────── */

/** Tiny per-provider test for Settings. */
export async function validateConnection(
  cs: CallSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (cs.provider === "anthropic") {
      const client = getAnthropic(cs);
      await client.messages.create({
        model: cs.model || "claude-sonnet-5",
        max_tokens: 4,
        messages: [{ role: "user", content: "ping" }],
      });
    } else {
      // Cheap, token-free: list models at the endpoint.
      await getCompat(cs).models.list();
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

/** Fetch model ids from an OpenAI-compatible endpoint (GET /models). */
export async function listCompatModels(
  apiKey: string,
  baseUrl: string,
): Promise<string[]> {
  const client = new OpenAI({
    apiKey: apiKey.trim() || "comtus-local",
    baseURL: baseUrl,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { "X-Title": "Comtus" },
  });
  const page = await client.models.list();
  const ids: string[] = [];
  for await (const m of page) {
    if (typeof m.id === "string") ids.push(m.id);
  }
  return ids.sort((a, b) => a.localeCompare(b));
}
