import { db } from "./db";
import { loadPomodoro } from "./pomodoro";
import type { GenerationKind } from "./types";

export type MilestoneAccent = "brass" | "moon" | "sage" | "rust";

export interface DeskSnapshot {
  notebooks: number;
  sources: number;
  userMessages: number;
  generations: number;
  kinds: Partial<Record<GenerationKind, number>>;
  streakDays: number;
  nightStudy: boolean;
  /** Focus sessions that ran to the bell. */
  focusSessions: number;
  /** Flashcards with a review on record. */
  reviews: number;
}

export interface MilestoneDef {
  id: string;
  title: string;
  line: string;
  accent: MilestoneAccent;
  met: (s: DeskSnapshot) => boolean;
}

export interface MilestoneRecord {
  seeded: boolean;
  unlockedAt: Record<string, number>;
  streakDays: number;
  lastActiveDay: string | null;
  nightStudy: boolean;
}

export const MILESTONE_STORAGE_KEY = "comtus-milestones";

const AID_KINDS: GenerationKind[] = ["study-guide", "brief", "faq", "timeline"];

function kindCount(s: DeskSnapshot, kind: GenerationKind): number {
  return s.kinds[kind] ?? 0;
}

export const MILESTONES: MilestoneDef[] = [
  {
    id: "first-desk",
    title: "A desk of your own",
    line: "The first notebook is open.",
    accent: "brass",
    met: (s) => s.notebooks >= 1,
  },
  {
    id: "first-source",
    title: "The first page",
    line: "A source sits on the desk.",
    accent: "moon",
    met: (s) => s.sources >= 1,
  },
  {
    id: "first-margin",
    title: "A question in the margin",
    line: "You asked the lamp something.",
    accent: "brass",
    met: (s) => s.userMessages >= 1,
  },
  {
    id: "first-quiz",
    title: "First check",
    line: "A practice quiz is saved.",
    accent: "brass",
    met: (s) => kindCount(s, "quiz") >= 1,
  },
  {
    id: "first-exam",
    title: "Under the clock",
    line: "A mock exam is on the shelf.",
    accent: "rust",
    met: (s) => kindCount(s, "exam") >= 1,
  },
  {
    id: "first-cards",
    title: "Cards on the table",
    line: "A flashcard deck is ready.",
    accent: "sage",
    met: (s) => kindCount(s, "flashcards") >= 1,
  },
  {
    id: "first-recall",
    title: "From memory",
    line: "You reviewed a card and rated your recall.",
    accent: "sage",
    met: (s) => s.reviews >= 1,
  },
  {
    id: "first-focus",
    title: "One session kept",
    line: "A focus session ran to the bell.",
    accent: "sage",
    met: (s) => s.focusSessions >= 1,
  },
  {
    id: "full-round",
    title: "A full round",
    line: "Four focus sessions, with rests between.",
    accent: "brass",
    met: (s) => s.focusSessions >= 4,
  },
  {
    id: "first-essay",
    title: "Ink on the page",
    line: "The essay coach has spoken.",
    accent: "moon",
    met: (s) => kindCount(s, "essay-review") >= 1,
  },
  {
    id: "first-aid",
    title: "A map of the text",
    line: "A study aid was generated.",
    accent: "moon",
    met: (s) => AID_KINDS.some((k) => kindCount(s, k) >= 1),
  },
  {
    id: "five-sources",
    title: "A growing shelf",
    line: "Five sources, grounded.",
    accent: "sage",
    met: (s) => s.sources >= 5,
  },
  {
    id: "ten-works",
    title: "Ten polished pieces",
    line: "Ten saved works in the studio.",
    accent: "brass",
    met: (s) => s.generations >= 10,
  },
  {
    id: "night-watch",
    title: "After midnight",
    line: "The lamp was still on past twelve.",
    accent: "moon",
    met: (s) => s.nightStudy,
  },
  {
    id: "seven-nights",
    title: "Seven nights at the lamp",
    line: "A week of returning to the desk.",
    accent: "sage",
    met: (s) => s.streakDays >= 7,
  },
];

export function emptyMilestoneRecord(): MilestoneRecord {
  return {
    seeded: false,
    unlockedAt: {},
    streakDays: 0,
    lastActiveDay: null,
    nightStudy: false,
  };
}

export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayOffset(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00`);
  const b = Date.parse(`${to}T12:00:00`);
  return Math.round((b - a) / 86_400_000);
}

export function isNightHour(hour: number): boolean {
  return hour >= 0 && hour < 5;
}

export function tickActivity(record: MilestoneRecord, now: Date): MilestoneRecord {
  const today = localDayKey(now);
  let streakDays = record.streakDays;
  if (!record.lastActiveDay) {
    streakDays = 1;
  } else if (record.lastActiveDay === today) {
    streakDays = Math.max(1, record.streakDays);
  } else if (dayOffset(record.lastActiveDay, today) === 1) {
    streakDays = record.streakDays + 1;
  } else {
    streakDays = 1;
  }
  return {
    ...record,
    streakDays,
    lastActiveDay: today,
    nightStudy: record.nightStudy || isNightHour(now.getHours()),
  };
}

export function evolveRecord(
  record: MilestoneRecord,
  snapshot: DeskSnapshot,
  now: number,
): { record: MilestoneRecord; unlocked: MilestoneDef[] } {
  const next: MilestoneRecord = {
    ...record,
    unlockedAt: { ...record.unlockedAt },
  };
  const unlocked: MilestoneDef[] = [];
  const silent = !record.seeded;
  for (const milestone of MILESTONES) {
    if (next.unlockedAt[milestone.id]) continue;
    if (!milestone.met(snapshot)) continue;
    next.unlockedAt[milestone.id] = now;
    if (!silent) unlocked.push(milestone);
  }
  next.seeded = true;
  return { record: next, unlocked };
}

export function loadMilestoneRecord(): MilestoneRecord {
  if (typeof localStorage === "undefined") return emptyMilestoneRecord();
  try {
    const raw = localStorage.getItem(MILESTONE_STORAGE_KEY);
    if (!raw) return emptyMilestoneRecord();
    const parsed = JSON.parse(raw) as Partial<MilestoneRecord>;
    return {
      seeded: Boolean(parsed.seeded),
      unlockedAt: parsed.unlockedAt && typeof parsed.unlockedAt === "object" ? parsed.unlockedAt : {},
      streakDays: Number.isFinite(parsed.streakDays) ? Number(parsed.streakDays) : 0,
      lastActiveDay: typeof parsed.lastActiveDay === "string" ? parsed.lastActiveDay : null,
      nightStudy: Boolean(parsed.nightStudy),
    };
  } catch {
    return emptyMilestoneRecord();
  }
}

export function saveMilestoneRecord(record: MilestoneRecord): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(MILESTONE_STORAGE_KEY, JSON.stringify(record));
}

export async function gatherDeskSnapshot(record: MilestoneRecord): Promise<DeskSnapshot> {
  const [notebooks, sources, messages, generations, reviews] = await Promise.all([
    db.notebooks.count(),
    db.sources.count(),
    db.messages.toArray(),
    db.generations.toArray(),
    db.cardProgress.count(),
  ]);
  const kinds: Partial<Record<GenerationKind, number>> = {};
  for (const gen of generations) {
    kinds[gen.kind] = (kinds[gen.kind] ?? 0) + 1;
  }
  return {
    notebooks,
    sources,
    userMessages: messages.filter((m) => m.role === "user").length,
    generations: generations.length,
    kinds,
    streakDays: record.streakDays,
    nightStudy: record.nightStudy,
    focusSessions: loadPomodoro().kept,
    reviews,
  };
}

export function kindAccent(kind: GenerationKind): MilestoneAccent {
  switch (kind) {
    case "quiz":
    case "note":
    case "presentation":
    case "slideshow":
      return "brass";
    case "exam":
    case "audio-overview":
      return "rust";
    case "essay-review":
    case "study-guide":
    case "brief":
    case "faq":
    case "timeline":
      return "moon";
    case "flashcards":
      return "sage";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function accentClass(accent: MilestoneAccent): string {
  switch (accent) {
    case "brass":
      return "text-brass bg-brass/12 border-brass/30";
    case "moon":
      return "text-moon bg-moon/12 border-moon/30";
    case "sage":
      return "text-sage bg-sage/12 border-sage/30";
    case "rust":
      return "text-rust bg-rust/12 border-rust/30";
    default: {
      const _never: never = accent;
      return _never;
    }
  }
}
