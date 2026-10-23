import type { Table } from "dexie";
import { db, uid } from "./db";
import { notifyDeskActivity } from "./activity";
import type {
  Attempt,
  CardProgress,
  ChatMessage,
  ChatSession,
  Chunk,
  FlashcardsPayload,
  Generation,
  Highlight,
  Notebook,
  Source,
} from "./types";
import { saveTextFile } from "./saveFile";
import { useSettings } from "./settings";
import { validateQuestionGraph } from "./assessmentContent";
import { DEFAULT_SESSION_TITLE, deriveSessionTitle } from "./sessionText";

const TABLES = [
  "notebooks",
  "sources",
  "chunks",
  "messages",
  "chatSessions",
  "generations",
  "cardProgress",
  "attempts",
  "highlights",
] as const;

type TableName = (typeof TABLES)[number];

export interface BackupPayload {
  app?: string;
  schema?: number;
  exportedAt?: string;
  /** "notebook" when the file holds a single notebook; absent for a full backup. */
  scope?: "notebook";
  data?: Partial<Record<TableName, unknown[]>>;
}

function backupFilename(): string {
  return `comtus-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

async function buildPayload(): Promise<BackupPayload> {
  const data: Partial<Record<TableName, unknown[]>> = {};
  for (const t of TABLES) data[t] = await db[t].toArray();
  return {
    app: "comtus",
    schema: 2,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** One notebook with everything that hangs off it — sources, chunks, chats,
 *  saved work and review history — in the same shape as a full backup, so
 *  Settings → Restore merges it straight back in. */
export async function buildNotebookPayload(notebookId: string): Promise<BackupPayload> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) throw new Error("This notebook is no longer on this device.");
  const data: Partial<Record<TableName, unknown[]>> = { notebooks: [notebook] };
  for (const t of TABLES) {
    if (t === "notebooks") continue;
    data[t] = await db[t].where("notebookId").equals(notebookId).toArray();
  }
  return {
    app: "comtus",
    schema: 2,
    scope: "notebook",
    exportedAt: new Date().toISOString(),
    data,
  };
}

function notebookFilename(name: string): string {
  const slug = name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "notebook";
  return `${slug}-comtus-${new Date().toISOString().slice(0, 10)}.json`;
}

function markBackedUp(): void {
  useSettings.getState().update({ lastBackupAt: Date.now() });
}

const JSON_FILE = { name: "JSON", extensions: ["json"], mime: "application/json" };

/** Native save dialog on Tauri, browser download otherwise. False = cancelled. */
const saveJson = (json: string, filename: string) => saveTextFile(json, filename, JSON_FILE);

/** Full local store → a file. */
export async function exportBackup(): Promise<boolean> {
  const saved = await saveJson(JSON.stringify(await buildPayload()), backupFilename());
  if (saved) markBackedUp();
  return saved;
}

/** One notebook → a restorable file. */
export async function exportNotebook(notebook: Pick<Notebook, "id" | "name">): Promise<boolean> {
  return saveJson(JSON.stringify(await buildNotebookPayload(notebook.id)), notebookFilename(notebook.name));
}

type BackupRow = Record<string, unknown> & { id: string; notebookId?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStr = (value: unknown): value is string => typeof value === "string";
const isNum = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isStrList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isStr);
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);

const QUIZ_FORMATS = new Set(["mcq", "truefalse", "identification", "solution"]);
const isQuestion = (q: unknown) =>
  isRecord(q) && isStr(q.id) && QUIZ_FORMATS.has(String(q.format)) && isStr(q.topic) && isStr(q.stem) &&
  isStrList(q.options) && Number.isInteger(q.answerIndex) && isStr(q.answer) && isStr(q.rationale) &&
  optional(q.sourceHint, isStr) && optional(q.graph, (graph) => validateQuestionGraph(graph) !== null);

/** The shape each saved-work viewer reads. A row that passes the table
 *  check but not this would throw the moment it is opened. */
function validGenerationPayload(kind: unknown, p: Record<string, unknown>): boolean {
  switch (kind) {
    case "quiz":
      return Array.isArray(p.questions) && p.questions.every(isQuestion) && optional(p.config, isRecord);
    case "exam": {
      const bp = p.blueprint;
      return Array.isArray(p.questions) && p.questions.every(isQuestion) &&
        isRecord(bp) && isStr(bp.title) && isNum(bp.minutes) && bp.minutes > 0 && isNum(bp.totalItems) &&
        optional(bp.sections, (s) => Array.isArray(s) && s.every((x) => isRecord(x) && isStr(x.topic) && isNum(x.items)));
    }
    case "essay-review":
      return isStr(p.prompt) && isStr(p.rubricName) && isNum(p.overall) && isNum(p.overallMax) && p.overallMax > 0 &&
        Array.isArray(p.criteria) && p.criteria.every((c) => isRecord(c) && isStr(c.name) && isNum(c.score) && isNum(c.max) && isStr(c.comment)) &&
        isStrList(p.strengths) && isStrList(p.improvements) && isStr(p.reasoning);
    case "flashcards":
      return Array.isArray(p.cards) && p.cards.every((c) => isRecord(c) && isStr(c.id) && isStr(c.front) && isStr(c.back));
    case "presentation":
    case "slideshow":
      // Decks are saved as the model returned them; the viewer tolerates gaps but not wrong types.
      return optional(p.deckTitle, isStr) && optional(p.deckSubtitle, isStr) &&
        optional(p.slides, (slides) => Array.isArray(slides) && slides.every((s) =>
          isRecord(s) && optional(s.title, isStr) && optional(s.subtitle, isStr) && optional(s.notes, isStr) &&
          optional(s.visualLayoutHint, isStr) && optional(s.bullets, isStrList)));
    case "note":
      return isStr(p.content) && optional(p.tags, isStrList);
    case "audio-overview":
      return isStr(p.title) && isStr(p.summary) &&
        Array.isArray(p.script) && p.script.every((t) => isRecord(t) && isStr(t.speaker) && isStr(t.text));
    default:
      return isStr(p.markdown);
  }
}

/** Validate imported rows before any database writes or typed payload access. */
export function validateBackupPayload(payload: unknown): asserts payload is BackupPayload {
  if (!isRecord(payload) || payload.app !== "comtus" || !isRecord(payload.data)) {
    throw new Error("That isn't a Comtus backup file.");
  }
  if (payload.schema !== undefined && payload.schema !== 1 && payload.schema !== 2) {
    throw new Error("This backup uses an unsupported format. Update Comtus before opening it.");
  }
  if (payload.scope !== undefined && payload.scope !== "notebook") throw new Error("Invalid backup scope.");
  const fields: Record<TableName, [string[], string[]]> = {
    notebooks: [["name"], ["createdAt", "updatedAt"]],
    sources: [["title", "kind", "content"], ["chars", "tokens", "addedAt"]],
    chunks: [["sourceId", "text"], ["idx", "tokens"]],
    messages: [["role", "content"], ["createdAt"]],
    chatSessions: [["title"], ["createdAt", "updatedAt"]],
    generations: [["kind", "title"], ["createdAt"]],
    cardProgress: [["generationId"], ["ease", "intervalDays", "dueAt", "reps"]],
    attempts: [["generationId", "kind", "scope"], ["score", "total", "finishedAt"]],
    highlights: [["sourceId", "quote", "note"], ["start", "end", "createdAt", "updatedAt"]],
  };
  for (const table of TABLES) {
    const rows = payload.data[table];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new Error(`Invalid backup table: ${table}.`);
    const ids = new Set<string>();
    for (const row of rows) {
      const invalid = () => new Error(`Invalid backup row in ${table}.`);
      if (!isRecord(row) || typeof row.id !== "string" || !row.id || ids.has(row.id)) throw invalid();
      ids.add(row.id);
      if (table !== "notebooks" && (typeof row.notebookId !== "string" || !row.notebookId)) throw invalid();
      const [strings, numbers] = fields[table];
      if (strings.some((key) => typeof row[key] !== "string") || numbers.some((key) => typeof row[key] !== "number" || !Number.isFinite(row[key]))) throw invalid();
      if (row.updatedAt !== undefined && (typeof row.updatedAt !== "number" || !Number.isFinite(row.updatedAt))) throw invalid();
      if (table === "sources" && !["pdf", "docx", "txt", "md", "json", "url", "paste", "img"].includes(String(row.kind))) throw invalid();
      if (table === "chunks" && (!Number.isInteger(row.idx) || Number(row.idx) < 0 || row.id !== `${row.sourceId}:${row.idx}`)) throw invalid();
      if (table === "cardProgress" && !row.id.startsWith(`${row.generationId}:`)) throw invalid();
      if (table === "messages") {
        if (row.role !== "user" && row.role !== "assistant") throw invalid();
        if (row.sessionId !== undefined && typeof row.sessionId !== "string") throw invalid();
        if (row.citations !== undefined && (!Array.isArray(row.citations) || row.citations.some((c) => !isRecord(c) || typeof c.documentIndex !== "number" || typeof c.sourceTitle !== "string" || typeof c.citedText !== "string" || (c.sourceId !== undefined && typeof c.sourceId !== "string")))) throw invalid();
      }
      if (table === "generations") {
        if (!["quiz", "exam", "essay-review", "study-guide", "brief", "faq", "timeline", "flashcards", "presentation", "slideshow", "note", "audio-overview"].includes(String(row.kind)) || !isRecord(row.payload)) throw invalid();
        if (!validGenerationPayload(row.kind, row.payload)) throw invalid();
      }
      if (table === "attempts" && (!Array.isArray(row.items) || row.items.some((item) => !isRecord(item) || typeof item.questionId !== "string" || typeof item.topic !== "string" || typeof item.credit !== "number" || typeof item.answered !== "boolean"))) throw invalid();
    }
  }
  if (payload.scope === "notebook") {
    const notebooks = payload.data.notebooks;
    if (!Array.isArray(notebooks) || notebooks.length !== 1 || !isRecord(notebooks[0])) throw new Error("A notebook file must contain exactly one notebook.");
    const notebookId = notebooks[0].id;
    for (const table of TABLES) {
      if (table === "notebooks") continue;
      const rows = payload.data[table];
      if (Array.isArray(rows) && rows.some((row) => !isRecord(row) || row.notebookId !== notebookId)) throw new Error("A notebook file contains rows from another notebook.");
    }
  }
}

/** Must run inside the same write transaction as the import. Historical
 * references may be absent after deletion, but may never cross notebooks. */
export async function assertBackupOwnership(payload: BackupPayload, allowCollidingRows = false): Promise<void> {
  const incoming = new Map(TABLES.map((table) => [table, new Map((payload.data?.[table] ?? []).map((row) => {
    const record = row as BackupRow;
    return [record.id, record] as const;
  }))]));
  for (const table of TABLES) {
    if (table === "notebooks") continue;
    for (const row of incoming.get(table)!.values()) {
      const existing = await db[table].get(row.id);
      if (existing && existing.notebookId !== row.notebookId && !allowCollidingRows) {
        throw new Error("This backup would overwrite a row belonging to another notebook.");
      }
      const refs: Array<[TableName, unknown]> = [["notebooks", row.notebookId]];
      if (table === "chunks" || table === "highlights") refs.push(["sources", row.sourceId]);
      if (table === "messages") {
        refs.push(["chatSessions", row.sessionId]);
        for (const citation of (row.citations ?? []) as Array<{ sourceId?: string }>) refs.push(["sources", citation.sourceId]);
      }
      if (table === "cardProgress" || table === "attempts") refs.push(["generations", row.generationId]);
      for (const [target, id] of refs) {
        if (typeof id !== "string") continue;
        const references = [incoming.get(target)?.get(id), await db[target].get(id)];
        if (references.some((referenced) => referenced && (target === "notebooks" ? referenced.id : (referenced as BackupRow).notebookId) !== row.notebookId)) throw new Error("This backup links records belonging to another notebook.");
      }
    }
  }
}

/** Files from before chat sessions (schema 1) hold messages with no
 *  session, which no chat view lists. Fold each notebook's into one thread,
 *  as the v2 database upgrade does. The id is stable, so restoring the same
 *  file twice reuses the thread instead of stranding the first one. */
function adoptLegacyMessages(payload: BackupPayload): BackupPayload {
  const messages = (payload.data?.messages ?? []) as ChatMessage[];
  if (messages.every((m) => m.sessionId)) return payload;
  const sessions = new Map<string, ChatSession>();
  const titledAt = new Map<string, number>();
  const adopted = messages.map((m) => {
    if (m.sessionId) return m;
    const id = `legacy-${m.notebookId}`;
    const session = sessions.get(id) ?? { id, notebookId: m.notebookId, title: "", createdAt: m.createdAt, updatedAt: m.createdAt };
    session.createdAt = Math.min(session.createdAt, m.createdAt);
    session.updatedAt = Math.max(session.updatedAt, m.createdAt);
    if (m.role === "user" && m.createdAt < (titledAt.get(id) ?? Infinity)) {
      session.title = deriveSessionTitle(m.content);
      titledAt.set(id, m.createdAt);
    }
    sessions.set(id, session);
    return { ...m, sessionId: id };
  });
  const existing = new Set(((payload.data?.chatSessions ?? []) as ChatSession[]).map((s) => s.id));
  const added = [...sessions.values()]
    .filter((s) => !existing.has(s.id))
    .map((s) => ({ ...s, title: s.title || DEFAULT_SESSION_TITLE }));
  return {
    ...payload,
    data: { ...payload.data, messages: adopted, chatSessions: [...(payload.data?.chatSessions ?? []), ...added] },
  };
}

export function parseBackupPayload(text: string): BackupPayload {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  validateBackupPayload(payload);
  return adoptLegacyMessages(payload);
}

export async function importBackupText(text: string): Promise<number> {
  const payload = parseBackupPayload(text);
  const tables: Array<Table<Record<string, unknown>, string>> = TABLES.map(
    (t) => db[t] as unknown as Table<Record<string, unknown>, string>,
  );
  let count = 0;
  await db.transaction("rw", tables, async () => {
    await assertBackupOwnership(payload);
    for (let i = 0; i < TABLES.length; i++) {
      const rows = payload.data?.[TABLES[i]];
      if (Array.isArray(rows) && rows.length) {
        await tables[i].bulkPut(rows as Record<string, unknown>[]);
        count += rows.length;
      }
    }
  });
  return count;
}

/** Merge rows from a backup file into the local store; a row whose id
 *  is already here is replaced by the file's copy. */
export async function importBackup(file: File): Promise<number> {
  return importBackupText(await file.text());
}

/** Native open dialog on Tauri. Returns 0 if the user cancelled. */
export async function importBackupNative(): Promise<number | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path || Array.isArray(path)) return null;
  return importBackupText(await readTextFile(path));
}

/* ── Opening a notebook file ──────────────────────────────── */

type NotebookData = {
  notebooks: Notebook[];
  sources: Source[];
  chunks: Chunk[];
  messages: ChatMessage[];
  chatSessions: ChatSession[];
  generations: Generation[];
  cardProgress: CardProgress[];
  attempts: Attempt[];
  highlights: Highlight[];
};

const rowsOf = <K extends keyof NotebookData>(payload: BackupPayload, table: K): NotebookData[K] => {
  const rows = payload.data?.[table];
  return (Array.isArray(rows) ? rows : []) as NotebookData[K];
};

/**
 * A notebook export with every id replaced, so it can sit beside the
 * notebook it came from: sources, chats, saved work, review history,
 * attempts and highlights all keep pointing at each other.
 */
export function copyNotebookPayload(payload: BackupPayload, newId = uid, now = Date.now()): NotebookData {
  const [notebook] = rowsOf(payload, "notebooks");
  const notebookId = newId();
  const oldNotebookId = notebook.id;
  const sourceIds = new Map(rowsOf(payload, "sources").map((s) => [s.id, newId()]));
  const sessionIds = new Map(rowsOf(payload, "chatSessions").map((s) => [s.id, newId()]));
  // The notebook's own decks keep their per-notebook ids.
  const genIds = new Map(
    rowsOf(payload, "generations").map((g) => {
      for (const prefix of ["misses-", "reading-"]) {
        if (g.id === `${prefix}${oldNotebookId}`) return [g.id, `${prefix}${notebookId}`] as const;
      }
      return [g.id, newId()] as const;
    }),
  );
  const source = (id: string) => sourceIds.get(id) ?? id;
  const gen = (id: string) => genIds.get(id) ?? id;
  const card = (generationId: string, cardId: string) => {
    const generation = rowsOf(payload, "generations").find((g) => g.id === generationId);
    if (generation?.kind === "flashcards" && generationId.startsWith("misses-")) {
      for (const [from, to] of genIds) {
        if (cardId.startsWith(`m-${from}-`)) return `m-${to}-${cardId.slice(from.length + 3)}`;
      }
    }
    return cardId;
  };

  return {
    notebooks: [{ ...notebook, id: notebookId, name: `${notebook.name} (copy)`, updatedAt: now }],
    sources: rowsOf(payload, "sources").map((s) => ({ ...s, id: source(s.id), notebookId })),
    chunks: rowsOf(payload, "chunks").map((c) => ({ ...c, id: `${source(c.sourceId)}:${c.idx}`, sourceId: source(c.sourceId), notebookId })),
    chatSessions: rowsOf(payload, "chatSessions").map((s) => ({ ...s, id: sessionIds.get(s.id) ?? s.id, notebookId })),
    messages: rowsOf(payload, "messages").map((m) => ({
      ...m,
      id: newId(),
      notebookId,
      ...(m.sessionId ? { sessionId: sessionIds.get(m.sessionId) ?? m.sessionId } : {}),
      ...(m.citations
        ? { citations: m.citations.map((c) => (c.sourceId ? { ...c, sourceId: source(c.sourceId) } : c)) }
        : {}),
    })),
    generations: rowsOf(payload, "generations").map((g) => {
      const copy: Generation = { ...g, id: gen(g.id), notebookId };
      // Cards made from quiz misses are named after the quiz they came from.
      if (g.kind === "flashcards" && g.id.startsWith("misses-")) {
        const cards = (g.payload as FlashcardsPayload | undefined)?.cards ?? [];
        copy.payload = {
          cards: cards.map((c) => ({ ...c, id: card(g.id, c.id) })),
        } satisfies FlashcardsPayload;
      }
      return copy;
    }),
    cardProgress: rowsOf(payload, "cardProgress").map((p) => {
      const cardId = card(p.generationId, p.id.slice(p.generationId.length + 1));
      return { ...p, id: `${gen(p.generationId)}:${cardId}`, generationId: gen(p.generationId), notebookId };
    }),
    attempts: rowsOf(payload, "attempts").map((a) => ({ ...a, id: newId(), generationId: gen(a.generationId), notebookId })),
    highlights: rowsOf(payload, "highlights").map((h) => ({ ...h, id: newId(), sourceId: source(h.sourceId), notebookId })),
  };
}

export type OpenedFile =
  | { kind: "notebook"; notebookId: string; name: string; copied: boolean }
  | { kind: "backup"; count: number };

/**
 * Opens an exported notebook (or a full backup) from the shelf. A
 * notebook already on this device comes in as a separate copy, so an
 * older file never overwrites newer work.
 */
export async function openNotebookText(text: string): Promise<OpenedFile> {
  const payload = parseBackupPayload(text);
  const [notebook] = rowsOf(payload, "notebooks");
  if (payload.scope !== "notebook" || !notebook?.id) {
    const count = await importBackupText(text);
    notifyDeskActivity();
    return { kind: "backup", count };
  }
  const tables = TABLES.map((t) => db[t] as unknown as Table<Record<string, unknown>, string>);
  const opened = await db.transaction("rw", tables, async () => {
    const copied = !!(await db.notebooks.get(notebook.id));
    await assertBackupOwnership(payload, copied);
    const data = copied ? copyNotebookPayload(payload) : payload.data!;
    // References omitted from a partial file may have survived in the original
    // notebook. A copy must not retain links back into that notebook.
    if (copied) await assertBackupOwnership({ ...payload, data });
    for (let i = 0; i < TABLES.length; i++) {
      const rows = (data[TABLES[i]] ?? []) as unknown as Record<string, unknown>[];
      if (rows.length) await tables[i].bulkAdd(rows);
    }
    const openedNotebook = (data.notebooks as Notebook[])[0];
    return { kind: "notebook", notebookId: openedNotebook.id, name: openedNotebook.name, copied } as const;
  });
  notifyDeskActivity();
  return opened;
}

/** The native open dialog on desktop; null when cancelled. */
export async function readNotebookFileNative(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({ multiple: false, filters: [{ name: "Comtus notebook", extensions: ["json"] }] });
  if (!path || Array.isArray(path)) return null;
  return readTextFile(path);
}
