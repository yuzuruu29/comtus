import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { MAX_CHUNK_CHARS, chunkText } from "./chunking";
import { buildIndex, clearRetrievalCache, estTokens, groundContext, pickChunks, scoreChunks, tokenize } from "./retrieval";
import type { Chunk, Source } from "./types";

describe("groundContext", () => {
  const notebookId = "nb-test-1";

  const sourceA: Source = {
    id: "src-a",
    notebookId,
    title: "Quantum Physics Notes",
    kind: "txt",
    content: "Quantum entanglement describes particles that interact in ways such that the quantum state of each particle cannot be described independently of the state of the others.",
    chars: 172,
    tokens: 30,
    addedAt: 1000,
  };

  const sourceB: Source = {
    id: "src-b",
    notebookId,
    title: "General Relativity",
    kind: "txt",
    content: "General relativity is Einstein's geometric theory of gravitation, describing gravity as curvature of spacetime caused by mass and energy.",
    chars: 142,
    tokens: 25,
    addedAt: 2000,
  };

  beforeEach(async () => {
    await db.sources.clear();
    await db.sources.bulkAdd([sourceA, sourceB]);
  });

  afterEach(async () => {
    await db.sources.clear();
  });

  it("grounds across all sources when sourceIds is undefined", async () => {
    const res = await groundContext(notebookId, "quantum gravity", undefined);
    expect(res.docs).toHaveLength(2);
    expect(res.docs.map((d) => d.source.id)).toEqual(["src-a", "src-b"]);
  });

  it("returns zero docs when sourceIds is an empty array (0 sources focused)", async () => {
    const res = await groundContext(notebookId, "quantum gravity", []);
    expect(res.docs).toEqual([]);
    expect(res.mode).toBe("full");
  });

  it("filters to specified sources when sourceIds contains IDs", async () => {
    const res = await groundContext(notebookId, "spacetime curvature", ["src-b"]);
    expect(res.docs).toHaveLength(1);
    expect(res.docs[0].source.id).toBe("src-b");
  });
});

describe("tokenize", () => {
  it("folds accents and keeps non-English words", () => {
    expect(tokenize("Résumé of the niño's café")).toEqual(["resume", "nino", "cafe"]);
    expect(tokenize("Ang pagkakaisa ng bayan")).toEqual(["ang", "pagkakaisa", "ng", "bayan"]);
  });

  it("indexes unspaced scripts as character bigrams", () => {
    expect(tokenize("光合作用")).toEqual(["光合", "合作", "作用"]);
    expect(tokenize("ATP合成")).toEqual(["atp", "合成"]);
    // Voiced kana and Hangul syllables survive normalization.
    expect(tokenize("が")).toEqual(["が"]);
    expect(tokenize("한국어")).toEqual(["한국", "국어"]);
  });

  it("folds common English plurals without mangling short words", () => {
    expect(tokenize("enzymes classes boxes theories analysis bus gas")).toEqual([
      "enzyme",
      "class",
      "box",
      "theory",
      "analysis",
      "bus",
      "gas",
    ]);
  });

  it("folds full-width characters", () => {
    expect(tokenize("ＡＴＰ")).toEqual(["atp"]);
  });
});

describe("chunk ranking", () => {
  const chunk = (sourceId: string, idx: number, text: string): Chunk => ({
    id: `${sourceId}:${idx}`,
    sourceId,
    notebookId: "nb",
    idx,
    text,
    tokens: 1000,
  });

  const chunks = [
    chunk("bio", 0, "Cells divide by mitosis. The cell cycle has phases."),
    chunk("bio", 1, "Photosynthesis converts light into chemical energy in chloroplasts."),
    chunk("bio", 2, "Enzymes lower activation energy. An enzyme is a biological catalyst."),
    chunk("law", 0, "A contract needs offer, acceptance and consideration."),
    chunk("law", 1, "Torts are civil wrongs; negligence requires a duty of care."),
  ];
  const index = buildIndex(chunks, [
    { id: "bio", title: "Biology lecture" },
    { id: "law", title: "Contracts and torts" },
  ]);

  it("ranks the chunk that answers the question first", () => {
    const scores = scoreChunks(index, "What does an enzyme do?");
    expect(scores.indexOf(Math.max(...scores))).toBe(2);
  });

  it("matches across singular and plural", () => {
    const scores = scoreChunks(index, "chloroplast");
    expect(scores[1]).toBeGreaterThan(0);
  });

  it("nudges chunks whose source title matches", () => {
    const scores = scoreChunks(index, "biology");
    expect(scores.slice(0, 3).every((s) => s > 0)).toBe(true);
    expect(scores.slice(3).every((s) => s === 0)).toBe(true);
  });

  it("reads every source from its opening when the query has no signal", () => {
    const picked = pickChunks(index, "summarize this", 2000);
    expect(picked.map((c) => c.id)).toEqual(["bio:0", "law:0"]);
  });

  it("keeps a floor of picks when the budget has room", () => {
    const picked = pickChunks(index, "negligence", 5000);
    expect(picked[0].id).toBe("law:1");
    expect(picked).toHaveLength(5);
  });

  it("never picks past the budget, floor or not", () => {
    expect(pickChunks(index, "negligence", 2500).map((c) => c.id)).toEqual(["law:1", "bio:0"]);
    expect(pickChunks(index, "summarize this", 1500).map((c) => c.id)).toEqual(["bio:0"]);
  });
});

describe("oversized sources", () => {
  const notebookId = "nb-huge";
  // 550k characters with no sentence break: ≈137,500 estimated tokens.
  const huge = Array.from({ length: 75_000 }, (_, i) => (i === 40_000 ? "mitochondria" : `word${i % 97}`)).join(" ").slice(0, 550_000);

  it("chunks text without sentence breaks to a bounded size", () => {
    const chunks = chunkText(huge);
    expect(chunks.length).toBeGreaterThan(100);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  });

  it("keeps a chunk stored before the size cap inside the retrieval budget", async () => {
    clearRetrievalCache();
    await Promise.all([db.sources.clear(), db.chunks.clear()]);
    await db.sources.add({ id: "big", notebookId, title: "Scan", kind: "pdf", content: huge, chars: huge.length, tokens: estTokens(huge), addedAt: 1 });
    await db.chunks.add({ id: "big:0", sourceId: "big", notebookId, idx: 0, text: huge, tokens: estTokens(huge) });

    for (const query of ["mitochondria", "summarize this"]) {
      const res = await groundContext(notebookId, query);
      expect(res.mode).toBe("retrieved");
      expect(res.docs).toHaveLength(1);
      expect(estTokens(res.docs[0].text)).toBeLessThanOrEqual(45_000 + 200);
    }
    expect((await groundContext(notebookId, "mitochondria")).docs[0].text).toContain("mitochondria");
  });
});

describe("groundContext retrieval mode", () => {
  const notebookId = "nb-big";
  const big = (id: string, title: string, body: string): Source => ({
    id,
    notebookId,
    title,
    kind: "txt",
    content: body,
    chars: body.length,
    tokens: 60_000,
    addedAt: 1,
  });

  beforeEach(async () => {
    clearRetrievalCache();
    await Promise.all([db.sources.clear(), db.chunks.clear()]);
    await db.sources.bulkAdd([big("s1", "Cardiology", "…"), big("s2", "Neurology", "…")]);
    await db.chunks.bulkAdd([
      { id: "s1:0", sourceId: "s1", notebookId, idx: 0, text: "The heart has four chambers.", tokens: 10 },
      { id: "s1:1", sourceId: "s1", notebookId, idx: 1, text: "Atrial fibrillation is an irregular rhythm.", tokens: 10 },
      { id: "s2:0", sourceId: "s2", notebookId, idx: 0, text: "Neurons transmit signals via synapses.", tokens: 10 },
    ]);
  });

  it("stitches retrieved chunks per source in reading order", async () => {
    const res = await groundContext(notebookId, "atrial fibrillation rhythm");
    expect(res.mode).toBe("retrieved");
    expect(res.docs.map((d) => d.source.id)).toEqual(["s1", "s2"]);
    expect(res.docs[0].text.indexOf("segment 1")).toBeLessThan(res.docs[0].text.indexOf("segment 2"));
  });

  it("rebuilds the index when the source set changes", async () => {
    await groundContext(notebookId, "heart");
    await db.sources.add(big("s3", "Pulmonology", "…"));
    await db.chunks.add({ id: "s3:0", sourceId: "s3", notebookId, idx: 0, text: "Alveoli exchange gases.", tokens: 10 });
    const res = await groundContext(notebookId, "alveoli");
    expect(res.docs.some((d) => d.source.id === "s3")).toBe(true);
  });
});
