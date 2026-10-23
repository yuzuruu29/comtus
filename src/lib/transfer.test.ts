import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import relayHandler from "../../api/relay";
import { db } from "./db";
import { pickRow, mergeNotebookPayload } from "./notebookMerge";
import {
  TransferError,
  formatCode,
  newTransferCode,
  parseTransferCode,
  receiveNotebook,
  seal,
  sendNotebook,
  splitParts,
  transferLink,
  unseal,
} from "./transfer";

/** The relay, running in-process on an in-memory Redis. */
function wireRelay() {
  const store = new Map<string, string>();
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://upstash.test")) {
        const [cmd, key, ...args] = JSON.parse(String(init!.body)) as string[];
        let result: unknown = null;
        if (cmd === "SET" && !(args.includes("NX") && store.has(key))) {
          store.set(key, args[0]);
          result = "OK";
        } else if (cmd === "GET") result = store.get(key) ?? null;
        else if (cmd === "INCR") {
          result = Number(store.get(key) ?? 0) + 1;
          store.set(key, String(result));
        } else if (cmd === "EXPIRE") result = 1;
        else if (cmd === "EXISTS") result = [key, ...args].filter((k) => store.has(k)).length;
        else if (cmd === "DEL") [key, ...args].forEach((k) => store.delete(k));
        return new Response(JSON.stringify({ result }));
      }
      if (typeof init?.body === "string") bodies.push(init.body);
      return relayHandler(new Request(url, init));
    }),
  );
  return { store, bodies };
}

const tables = [db.notebooks, db.sources, db.chunks, db.messages, db.chatSessions, db.generations, db.cardProgress, db.attempts, db.highlights];

async function seedNotebook() {
  await db.notebooks.add({ id: "nb", name: "Cell biology", examAt: 1_900_000_000_000, createdAt: 1, updatedAt: 10 });
  const content = "Mitochondria make ATP.\n\nRibosomes build proteins.";
  await db.sources.add({ id: "src", notebookId: "nb", title: "Lecture", kind: "txt", content, chars: content.length, tokens: 12, addedAt: 1 });
  await db.chunks.add({ id: "src:0", sourceId: "src", notebookId: "nb", idx: 0, text: content, tokens: 12 });
  await db.chatSessions.add({ id: "chat", notebookId: "nb", title: "Energy", createdAt: 1, updatedAt: 5 });
  await db.messages.add({ id: "m1", notebookId: "nb", sessionId: "chat", role: "user", content: "What makes ATP?", createdAt: 2 });
  await db.generations.add({ id: "deck", notebookId: "nb", kind: "flashcards", title: "Deck", payload: { cards: [{ id: "c0", front: "ATP?", back: "Energy" }] }, createdAt: 3 });
  await db.cardProgress.add({ id: "deck:c0", generationId: "deck", notebookId: "nb", ease: 2.5, intervalDays: 1, dueAt: 100, reps: 1 });
  await db.highlights.add({ id: "h1", notebookId: "nb", sourceId: "src", start: 0, end: 12, quote: "Mitochondria", note: "", createdAt: 1, updatedAt: 1 });
}

beforeEach(async () => {
  vi.stubEnv("VITE_API_ORIGIN", "https://comtus-ai.vercel.app");
  process.env.UPSTASH_REDIS_REST_URL = "https://upstash.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "t";
  await Promise.all(tables.map((t) => t.clear()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("transfer codes", () => {
  it("are 24 unambiguous characters, forgiving to type", () => {
    const code = newTransferCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{24}$/);
    expect(formatCode(code)).toMatch(/^(\w{4}-){5}\w{4}$/);
    expect(parseTransferCode(formatCode(code).toLowerCase())).toBe(code);
    expect(parseTransferCode(transferLink(code, "https://comtus-ai.vercel.app/"))).toBe(code);
    expect(transferLink(code, "https://comtus-ai.vercel.app/")).toBe(`https://comtus-ai.vercel.app/studio#receive=${code}`);
    expect(parseTransferCode("0000-1111-2222-3333-4444-555O")).toBe("000011112222333344445550");
    expect(parseTransferCode("IL00-1111-2222-3333-4444-5555")).toBe("110011112222333344445555");
    expect(parseTransferCode("too short")).toBeNull();
  });

  it("seal and open text only with the right code", async () => {
    const code = newTransferCode();
    const sealed = await seal("Mitochondria make ATP. ".repeat(200), code);
    expect(sealed).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sealed.length).toBeLessThan(1000); // compressed before sealing
    expect(await unseal(sealed, code)).toBe("Mitochondria make ATP. ".repeat(200));
    await expect(unseal(sealed, newTransferCode())).rejects.toBeInstanceOf(TransferError);
    expect(splitParts("abcdefg", 3)).toEqual(["abc", "def", "g"]);
  });
});

describe("sending a notebook to another device", () => {
  it("arrives whole on a device that didn't have it, and the relay never sees it", async () => {
    const { store, bodies } = wireRelay();
    await seedNotebook();
    const { code, expiresAt } = await sendNotebook("nb");
    expect(expiresAt).toBeGreaterThan(Date.now());
    // What went over the wire and what the relay holds is sealed text.
    for (const text of [...bodies, ...store.values()]) {
      expect(text).not.toContain("Mitochondria");
      expect(text).not.toContain("Cell biology");
    }

    await Promise.all(tables.map((t) => t.clear()));
    const result = await receiveNotebook(formatCode(code));
    expect(result).toMatchObject({ notebookId: "nb", name: "Cell biology", isNew: true });
    expect(await db.notebooks.get("nb")).toMatchObject({ examAt: 1_900_000_000_000 });
    expect(await db.messages.get("m1")).toMatchObject({ sessionId: "chat" });
    expect(await db.cardProgress.get("deck:c0")).toMatchObject({ reps: 1 });
    // Chunks aren't sent; they're rebuilt from the source.
    expect(await db.chunks.where("sourceId").equals("src").count()).toBe(1);
    // Picked up once: the relay forgets it.
    expect([...store.keys()].filter((k) => k.startsWith("relay:"))).toEqual([]);
    await expect(receiveNotebook(code)).rejects.toThrow("This code has expired or was already used.");
  });

  it("merges into the same notebook when both devices have it", async () => {
    wireRelay();
    await seedNotebook();
    const { code } = await sendNotebook("nb");

    // Meanwhile, on the receiving device: an older copy with its own work.
    await Promise.all(tables.map((t) => t.clear()));
    await seedNotebook();
    await db.notebooks.update("nb", { name: "Bio (renamed later)", updatedAt: 50 });
    await db.messages.add({ id: "m2", notebookId: "nb", sessionId: "chat", role: "user", content: "Only here", createdAt: 9 });
    await db.generations.update("deck", { payload: { cards: [{ id: "c0", front: "ATP?", back: "Energy" }, { id: "c9", front: "Mine", back: "Only" }] } });
    await db.cardProgress.update("deck:c0", { reps: 4, dueAt: 900 });

    const result = await receiveNotebook(code);
    expect(result).toMatchObject({ isNew: false, name: "Bio (renamed later)" });
    expect(await db.messages.where("notebookId").equals("nb").count()).toBe(2);
    expect((await db.cardProgress.get("deck:c0"))?.reps).toBe(4);
    expect(((await db.generations.get("deck"))?.payload as { cards: unknown[] }).cards).toHaveLength(2);
  });

  it("won't touch rows that belong to another notebook", async () => {
    await db.notebooks.add({ id: "other", name: "Other", createdAt: 1, updatedAt: 1 });
    await db.sources.add({ id: "theirs", notebookId: "other", title: "Keep me", kind: "txt", content: "x", chars: 1, tokens: 1, addedAt: 1 });
    await mergeNotebookPayload({
      app: "comtus",
      data: {
        notebooks: [{ id: "nb", name: "Sneaky", createdAt: 1, updatedAt: 1 }],
        sources: [
          { id: "theirs", notebookId: "nb", title: "Overwritten", kind: "txt", content: "y", chars: 1, tokens: 1, addedAt: 2 },
          { id: "stray", notebookId: "other", title: "Stray", kind: "txt", content: "z", chars: 1, tokens: 1, addedAt: 2 },
        ],
      },
    });
    expect((await db.sources.get("theirs"))?.title).toBe("Keep me");
    expect(await db.sources.get("stray")).toBeUndefined();
  });

  it("rejects imported chunk keys that could overwrite another notebook's retrieval text", async () => {
    await seedNotebook();
    await expect(mergeNotebookPayload({
      app: "comtus",
      data: {
        notebooks: [{ id: "new", name: "New", createdAt: 1, updatedAt: 1 }],
        sources: [{ id: "new-src", notebookId: "new", title: "New", kind: "txt", content: "x", chars: 1, tokens: 1, addedAt: 1 }],
        chunks: [{ id: "src:0", sourceId: "new-src", notebookId: "new", idx: 0, text: "poisoned", tokens: 1 }],
      },
    })).rejects.toThrow(/backup row/i);
    expect((await db.chunks.get("src:0"))?.text).not.toBe("poisoned");
    expect(await db.notebooks.get("new")).toBeUndefined();
  });

  it("rejects links to another notebook even when a conflicting source row was skipped", async () => {
    await seedNotebook();
    await expect(mergeNotebookPayload({
      app: "comtus",
      data: {
        notebooks: [{ id: "new", name: "New", createdAt: 1, updatedAt: 1 }],
        sources: [{ id: "src", notebookId: "new", title: "New", kind: "txt", content: "x", chars: 1, tokens: 1, addedAt: 1 }],
        highlights: [{ id: "new-h", notebookId: "new", sourceId: "src", start: 0, end: 1, quote: "x", note: "", createdAt: 1, updatedAt: 1 }],
      },
    })).rejects.toThrow(/another notebook/i);
    expect(await db.notebooks.get("new")).toBeUndefined();
    expect(await db.highlights.get("new-h")).toBeUndefined();
  });
});

describe("choosing between two copies", () => {
  it("keeps newer edits, every card, and the longer review history", () => {
    const deck = (cards: string[], updatedAt?: number) =>
      ({ id: "d", notebookId: "nb", kind: "flashcards", title: "D", createdAt: 1, updatedAt, payload: { cards: cards.map((id) => ({ id, front: id, back: id })) } });
    const merged = pickRow("generations", deck(["a", "b"]), deck(["b", "c"], 5)) as unknown as { payload: { cards: { id: string }[] } };
    expect(merged.payload.cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(pickRow("generations", deck(["a"]), deck(["a"]))).toBeNull();

    const note = (content: string, updatedAt?: number) => ({ id: "n", notebookId: "nb", kind: "note", title: "N", createdAt: 1, updatedAt, payload: { content } });
    expect(pickRow("generations", note("old"), note("new", 9))).toMatchObject({ payload: { content: "new" } });
    expect(pickRow("generations", note("mine", 9), note("theirs", 3))).toBeNull();

    const progress = (reps: number, dueAt: number) => ({ id: "p", notebookId: "nb", generationId: "d", ease: 2.5, intervalDays: 1, reps, dueAt });
    expect(pickRow("cardProgress", progress(3, 100), progress(2, 999))).toBeNull();
    expect(pickRow("cardProgress", progress(3, 100), progress(3, 200))).toMatchObject({ dueAt: 200 });
    expect(pickRow("messages", { id: "m", content: "a" }, { id: "m", content: "b" })).toBeNull();
  });
});
