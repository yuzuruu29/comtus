import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { groundContext } from "./retrieval";
import type { Source } from "./types";

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
