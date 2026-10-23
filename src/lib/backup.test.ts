import { describe, expect, it } from "vitest";
import { parseBackupPayload } from "./backup";
import { formatBytes } from "./storageStats";

describe("formatBytes", () => {
  it("formats byte sizes in a short human unit", () => {
    expect(formatBytes(400)).toBe("400 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("parseBackupPayload", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseBackupPayload("{")).toThrow(/valid JSON/);
  });

  it("rejects a non-Comtus file", () => {
    expect(() => parseBackupPayload(JSON.stringify({ app: "other", data: {} }))).toThrow(
      /Comtus backup/,
    );
  });

  it("accepts a Comtus payload", () => {
    const payload = parseBackupPayload(
      JSON.stringify({ app: "comtus", data: { notebooks: [] } }),
    );
    expect(payload.app).toBe("comtus");
  });

  it.each([
    { app: "comtus", data: [] },
    { app: "comtus", schema: 99, data: {} },
    { app: "comtus", data: { notebooks: "bad" } },
    { app: "comtus", data: { notebooks: [null] } },
    { app: "comtus", data: { notebooks: [{ id: "n", name: {}, createdAt: 1, updatedAt: 1 }] } },
    { app: "comtus", data: { notebooks: [{ id: "n", name: "N", createdAt: 1, updatedAt: 1 }, { id: "n", name: "N", createdAt: 1, updatedAt: 1 }] } },
    { app: "comtus", data: { generations: [{ id: "g", notebookId: "n", kind: "flashcards", title: "G", createdAt: 1, payload: { cards: {} } }] } },
  ])("rejects malformed backup data before it reaches storage", (payload) => {
    expect(() => parseBackupPayload(JSON.stringify(payload))).toThrow();
  });

  const question = {
    id: "q0", format: "mcq", topic: "Cells", difficulty: "easy", stem: "What makes ATP?",
    options: ["Mitochondria", "Ribosome"], answerIndex: 0, answer: "Mitochondria", rationale: "Respiration.",
  };
  const blueprint = { preset: "custom", title: "Mock", totalItems: 1, minutes: 30, sections: [{ topic: "Cells", items: 1 }], difficulty: "mixed" };
  const withGeneration = (kind: string, payload: unknown) =>
    JSON.stringify({ app: "comtus", data: { generations: [{ id: "g", notebookId: "n", kind, title: "G", createdAt: 1, payload }] } });

  it.each([
    ["quiz", {}],
    ["quiz", { questions: [{ ...question, options: "Mitochondria" }] }],
    ["exam", { questions: [question] }],
    ["exam", { questions: [question], blueprint: { ...blueprint, minutes: "30" } }],
    ["essay-review", { prompt: "P", criteria: [] }],
    ["study-guide", {}],
    ["note", { content: { text: "hi" } }],
    ["presentation", { slides: [{ title: { text: "Slide" } }] }],
    ["audio-overview", { title: "T", summary: "S", script: [{ speaker: "Alex" }] }],
  ])("rejects a %s whose payload its viewer cannot open", (kind, payload) => {
    expect(() => parseBackupPayload(withGeneration(kind, payload))).toThrow(/Invalid backup row in generations/);
  });

  it.each([
    ["quiz", { questions: [question], config: { count: 1, formats: ["mcq"], difficulty: "easy", scope: "all" } }],
    ["exam", { questions: [{ ...question, format: "solution", options: [] }], blueprint }],
    ["essay-review", { prompt: "P", rubricName: "R", essay: "E", overall: 7, overallMax: 10, criteria: [{ name: "C", score: 7, max: 10, comment: "" }], strengths: [], improvements: ["x"], reasoning: "" }],
    ["study-guide", { markdown: "# Guide" }],
    ["note", { content: "hi", tags: [] }],
    // Decks are stored as the model returned them, so gaps are allowed.
    ["presentation", { topic: "T", deckTitle: "D", slides: [{ id: "s1", slideNumber: 1, title: "One" }] }],
    ["audio-overview", { title: "T", summary: "S", script: [{ speaker: "Alex", text: "Hi" }] }],
  ])("accepts a well-formed %s", (kind, payload) => {
    expect(() => parseBackupPayload(withGeneration(kind, payload))).not.toThrow();
  });

  it("gives messages from before chat sessions a thread the chat can show", () => {
    const message = (id: string, role: string, content: string, createdAt: number) => ({ id, notebookId: "n", role, content, createdAt });
    const payload = parseBackupPayload(JSON.stringify({
      app: "comtus",
      schema: 1,
      data: {
        messages: [
          message("m2", "assistant", "In mitochondria.", 2),
          message("m1", "user", "Where is ATP made?", 1),
        ],
      },
    }));
    const sessions = payload.data!.chatSessions as Array<{ id: string; notebookId: string; title: string }>;
    expect(sessions).toEqual([expect.objectContaining({ id: "legacy-n", notebookId: "n", title: "Where is ATP made?", createdAt: 1, updatedAt: 2 })]);
    expect((payload.data!.messages as Array<{ sessionId?: string }>).map((m) => m.sessionId)).toEqual(["legacy-n", "legacy-n"]);
  });
});
