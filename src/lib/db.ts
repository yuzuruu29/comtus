import Dexie, { type Table } from "dexie";
import type {
  Attempt,
  Notebook,
  Source,
  Chunk,
  ChatMessage,
  ChatSession,
  Generation,
  CardProgress,
  Highlight,
} from "./types";
import { DEFAULT_SESSION_TITLE, deriveSessionTitle } from "./sessionText";
import { notifyDeskActivity, notifyWorkSaved } from "./activity";

/** Local-first store. Everything lives in IndexedDB on this device.
 *  (Settings live in localStorage via zustand — not here.) */
class ComtusDB extends Dexie {
  notebooks!: Table<Notebook, string>;
  sources!: Table<Source, string>;
  chunks!: Table<Chunk, string>;
  messages!: Table<ChatMessage, string>;
  chatSessions!: Table<ChatSession, string>;
  generations!: Table<Generation, string>;
  cardProgress!: Table<CardProgress, string>;
  attempts!: Table<Attempt, string>;
  highlights!: Table<Highlight, string>;

  constructor() {
    super("comtus");
    this.version(1).stores({
      notebooks: "id, updatedAt",
      sources: "id, notebookId, addedAt",
      chunks: "id, sourceId, notebookId",
      messages: "id, notebookId, createdAt",
      generations: "id, notebookId, kind, createdAt",
      cardProgress: "id, generationId, notebookId, dueAt",
    });
    // v2 — chatbot sessions. Every notebook's original flat thread is
    // folded into one titled session so history survives the upgrade.
    this.version(2)
      .stores({
        notebooks: "id, updatedAt",
        sources: "id, notebookId, addedAt",
        chunks: "id, sourceId, notebookId",
        messages: "id, notebookId, sessionId, createdAt",
        chatSessions: "id, notebookId, updatedAt",
        generations: "id, notebookId, kind, createdAt",
        cardProgress: "id, generationId, notebookId, dueAt",
      })
      .upgrade(async (tx) => {
        const messages = tx.table("messages");
        // Rows read through an upgrade transaction are untyped — this is
        // the v1 message shape the migration walks.
        const groups = new Map<
          string,
          { ids: string[]; first: number; title: string }
        >();
        await messages.each(
          (msg: {
            id: string;
            notebookId: string;
            sessionId?: string;
            role: string;
            content: string;
            createdAt: number;
          }) => {
          if (msg.sessionId) return;
          const group = groups.get(msg.notebookId) ?? {
            ids: [] as string[],
            first: msg.createdAt,
            title: "",
          };
          group.ids.push(msg.id);
          if (msg.role === "user" && !group.title) {
            group.title = deriveSessionTitle(msg.content);
          }
          groups.set(msg.notebookId, group);
        });
        for (const [notebookId, group] of groups) {
          const now = Date.now();
          const session: ChatSession = {
            id: uid(),
            notebookId,
            title: group.title || DEFAULT_SESSION_TITLE,
            createdAt: group.first,
            updatedAt: now,
          };
          await tx.table("chatSessions").add(session);
          await messages.where("id").anyOf(group.ids).modify({
            sessionId: session.id,
          });
        }
      });
    // v3 — quiz and exam attempts. A new table; nothing to migrate.
    this.version(3).stores({
      attempts: "id, notebookId, generationId, finishedAt",
    });
    // v4 — highlights and margin notes on sources. A new table.
    this.version(4).stores({
      highlights: "id, notebookId, sourceId, updatedAt",
    });
  }
}

export const db = new ComtusDB();

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/* ── Notebooks ────────────────────────────────────────────── */

export async function createNotebook(name: string): Promise<Notebook> {
  const now = Date.now();
  const nb: Notebook = { id: uid(), name, createdAt: now, updatedAt: now };
  await db.notebooks.add(nb);
  notifyDeskActivity();
  return nb;
}

export async function touchNotebook(id: string) {
  await db.notebooks.update(id, { updatedAt: Date.now() });
}

export async function deleteNotebook(id: string) {
  await db.transaction(
    "rw",
    [
      db.notebooks,
      db.sources,
      db.chunks,
      db.messages,
      db.chatSessions,
      db.generations,
      db.cardProgress,
      db.attempts,
      db.highlights,
    ],
    async () => {
      await db.notebooks.delete(id);
      await db.sources.where("notebookId").equals(id).delete();
      await db.chunks.where("notebookId").equals(id).delete();
      await db.messages.where("notebookId").equals(id).delete();
      await db.chatSessions.where("notebookId").equals(id).delete();
      await db.generations.where("notebookId").equals(id).delete();
      await db.cardProgress.where("notebookId").equals(id).delete();
      await db.attempts.where("notebookId").equals(id).delete();
      await db.highlights.where("notebookId").equals(id).delete();
    },
  );
}

/* ── Sources ──────────────────────────────────────────────── */

export async function addSourceWithChunks(
  source: Source,
  chunks: Chunk[],
): Promise<void> {
  await db.transaction("rw", db.sources, db.chunks, async () => {
    await db.sources.put(source);
    await db.chunks.bulkPut(chunks);
  });
  await touchNotebook(source.notebookId);
  notifyDeskActivity();
}

export async function deleteSource(sourceId: string) {
  const notebookId = await db.transaction("rw", db.sources, db.chunks, db.highlights, async () => {
    const source = await db.sources.get(sourceId);
    await db.sources.delete(sourceId);
    await db.chunks.where("sourceId").equals(sourceId).delete();
    await db.highlights.where("sourceId").equals(sourceId).delete();
    return source?.notebookId;
  });
  if (notebookId) {
    await touchNotebook(notebookId);
    notifyDeskActivity();
  }
}

/* ── Chat sessions ────────────────────────────────────────── */

/** Sessions of a notebook, most recently active first. */
export async function listChatSessions(notebookId: string): Promise<ChatSession[]> {
  const rows = await db.chatSessions
    .where("notebookId")
    .equals(notebookId)
    .sortBy("updatedAt");
  return rows.reverse();
}

/** A notebook always has at least one thread to type into. The check and
 *  create share one write transaction so concurrent callers (the workspace
 *  mounts a desktop and a mobile ChatPane) can never both see an empty
 *  list and mint duplicate defaults. */
export async function ensureChatSessions(notebookId: string): Promise<ChatSession[]> {
  const now = Date.now();
  return db.transaction(
    "rw",
    [db.chatSessions, db.notebooks],
    async () => {
      const existing = await db.chatSessions
        .where("notebookId")
        .equals(notebookId)
        .sortBy("updatedAt");
      if (existing.length > 0) return existing.reverse();
      const session: ChatSession = {
        id: uid(),
        notebookId,
        title: "",
        createdAt: now,
        updatedAt: now,
      };
      await db.chatSessions.add(session);
      await touchNotebook(notebookId);
      return [session];
    },
  );
}

export async function createChatSession(notebookId: string): Promise<ChatSession> {
  const now = Date.now();
  const session: ChatSession = {
    id: uid(),
    notebookId,
    title: "",
    createdAt: now,
    updatedAt: now,
  };
  await db.chatSessions.add(session);
  await touchNotebook(notebookId);
  return session;
}

export async function renameChatSession(id: string, title: string) {
  await db.chatSessions.update(id, { title, updatedAt: Date.now() });
}

/** Removes the thread and every message in it. */
export async function deleteChatSession(id: string) {
  await db.transaction(
    "rw",
    [db.chatSessions, db.messages, db.notebooks],
    async () => {
      const session = await db.chatSessions.get(id);
      await db.chatSessions.delete(id);
      if (session) {
        await db.messages.where("sessionId").equals(id).delete();
        await touchNotebook(session.notebookId);
      }
    },
  );
}

/* ── Messages & generations ───────────────────────────────── */

export async function saveMessage(msg: ChatMessage) {
  await db.messages.put(msg);
  if (msg.sessionId) {
    await db.chatSessions.update(msg.sessionId, { updatedAt: Date.now() });
  }
  await touchNotebook(msg.notebookId);
  notifyDeskActivity();
}

export async function saveGeneration(gen: Generation) {
  await db.generations.put(gen);
  await touchNotebook(gen.notebookId);
  notifyDeskActivity();
  notifyWorkSaved(gen.notebookId);
}

export async function createCustomNote(
  notebookId: string,
  title: string,
  content: string,
  tags: string[] = [],
): Promise<Generation> {
  const note: Generation = {
    id: uid(),
    notebookId,
    kind: "note",
    title: title.trim() || "Untitled note",
    payload: { content, tags },
    createdAt: Date.now(),
  };
  await db.generations.put(note);
  await touchNotebook(notebookId);
  notifyDeskActivity();
  notifyWorkSaved(notebookId);
  return note;
}

export async function updateCustomNote(
  id: string,
  title: string,
  content: string,
  tags: string[] = [],
): Promise<void> {
  const existing = await db.generations.get(id);
  if (!existing) return;
  const updated: Generation = {
    ...existing,
    title: title.trim() || existing.title,
    payload: { content, tags },
  };
  await db.generations.put(updated);
  await touchNotebook(existing.notebookId);
}

export async function deleteGeneration(id: string): Promise<Generation | undefined> {
  return db.transaction("rw", [db.generations, db.notebooks], async () => {
    const existing = await db.generations.get(id);
    if (!existing) return undefined;
    await db.generations.delete(id);
    await db.notebooks.update(existing.notebookId, { updatedAt: Date.now() });
    return existing;
  });
}

export async function restoreGeneration(generation: Generation): Promise<void> {
  await db.transaction("rw", [db.generations, db.notebooks], async () => {
    await db.generations.put(generation);
    await db.notebooks.update(generation.notebookId, { updatedAt: Date.now() });
  });
  notifyDeskActivity();
}
