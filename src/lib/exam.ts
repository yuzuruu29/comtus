import { db } from "./db";
import { notifyDeskActivity } from "./activity";
import { DAY_MS, startOfLocalDay } from "./srs";
import type { Notebook } from "./types";

/**
 * A notebook's exam date. Everything here is calendar days in the
 * student's own time zone: an exam "in 3 days" is three midnights away.
 */

/** 0 on exam day, 1 the day before, negative once it has passed. */
export function daysUntil(examAt: number, now = Date.now()): number {
  return Math.round((startOfLocalDay(examAt) - startOfLocalDay(now)) / DAY_MS);
}

/** "Midterm in 12 days", "Exam tomorrow", "Exam today"; null when there
 *  is no upcoming exam. */
export function examCountdown(notebook: Pick<Notebook, "examAt" | "examName">, now = Date.now()): string | null {
  if (!notebook.examAt) return null;
  const days = daysUntil(notebook.examAt, now);
  if (days < 0) return null;
  const what = notebook.examName?.trim() || "Exam";
  if (days === 0) return `${what} today`;
  if (days === 1) return `${what} tomorrow`;
  return `${what} in ${days} days`;
}

/** The exam day written out: "Thursday, October 10". */
export function examDateLabel(examAt: number): string {
  return new Date(examAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A timestamp as an <input type="date"> value, in local time. */
export function toDateInput(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** An <input type="date"> value as local midnight, or null if invalid. */
export function fromDateInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.getMonth() === Number(m[2]) - 1 ? date.getTime() : null;
}

/** Sets or clears (null) a notebook's exam. */
export async function setNotebookExam(notebookId: string, examAt: number | null, examName = ""): Promise<void> {
  await db.notebooks.update(notebookId, {
    examAt: examAt === null ? undefined : startOfLocalDay(examAt),
    examName: examAt === null ? undefined : examName.trim() || undefined,
    updatedAt: Date.now(),
  });
  notifyDeskActivity();
}
