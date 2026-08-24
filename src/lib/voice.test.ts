import { afterEach, describe, expect, it, vi } from "vitest";
import { appendTranscript, transcribeClip, whisperModelFor } from "./voice";

describe("appendTranscript", () => {
  it("inserts into empty composer text as-is", () => {
    expect(appendTranscript("", "hello world")).toBe("hello world");
  });

  it("adds a single space after a word", () => {
    expect(appendTranscript("What is", "photosynthesis")).toBe("What is photosynthesis");
  });

  it("keeps existing trailing whitespace instead of doubling it", () => {
    expect(appendTranscript("What is ", "photosynthesis")).toBe("What is photosynthesis");
    expect(appendTranscript("What is\n", "photosynthesis")).toBe("What is\nphotosynthesis");
  });

  it("ignores blank transcripts", () => {
    expect(appendTranscript("Untouched", "   ")).toBe("Untouched");
    expect(appendTranscript("", "   ")).toBe("");
  });

  it("trims stray whitespace around the transcript", () => {
    expect(appendTranscript("Say", "  something  ")).toBe("Say something");
  });
});

describe("whisperModelFor", () => {
  it("picks Groq's turbo model on Groq", () => {
    expect(whisperModelFor("https://api.groq.com/openai/v1")).toBe("whisper-large-v3-turbo");
  });

  it("picks OpenAI's whisper-1 on OpenAI and unknown hosts", () => {
    expect(whisperModelFor("https://api.openai.com/v1")).toBe("whisper-1");
    expect(whisperModelFor("https://openrouter.ai/api/v1")).toBe("whisper-1");
    expect(whisperModelFor("not a url")).toBe("whisper-1");
  });
});

describe("transcribeClip", () => {
  afterEach(() => vi.unstubAllGlobals());

  const clip = () => new Blob(["fake-audio"], { type: "audio/webm" });
  const groq = { apiKey: "gsk_test", baseUrl: "https://api.groq.com/openai/v1" };

  it("posts multipart to /audio/transcriptions with the routed base and right model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "  What is osmosis?  " }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const text = await transcribeClip(clip(), groq);

    expect(text).toBe("What is osmosis?");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer gsk_test");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("response_format")).toBe("json");
    const file = form.get("file") as File;
    expect(file.name).toBe("voice.webm");
  });

  it("maps a rejected key to friendly copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 401 })),
    );
    await expect(transcribeClip(clip(), groq)).rejects.toThrow("API key was rejected");
  });

  it("maps model-less endpoints to the Groq/OpenAI hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bad model", { status: 400 })),
    );
    await expect(transcribeClip(clip(), groq)).rejects.toThrow(
      "doesn't host a transcription model",
    );
  });

  it("maps network failure to a connection message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("boom")));
    await expect(transcribeClip(clip(), groq)).rejects.toThrow("check your connection");
  });
});
