import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Books,
  Database,
  FileText,
  Flame,
  GearSix,
  Plus,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { liveQuery } from "dexie";
import { db } from "../lib/db";
import type { Generation, Notebook } from "../lib/types";
import { detectPlatform, greeting, todayLine } from "../lib/desktop";
import { useSettings } from "../lib/settings";
import { BorderBeam } from "../studio/fx";
import { btnGhost, btnLamp, timeAgo } from "../studio/ui";
import { modLabel } from "../studio/shortcuts";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type DeskSnapshot = {
  notebookCount: number;
  sourceCount: number;
  workCount: number;
  recentNotebooks: Notebook[];
  recentWork: Array<Generation & { notebookName: string }>;
};

/** The desktop's working home: a returnable dashboard for resuming,
 * starting, and understanding the local desk—not a marketing landing page. */
export default function DeskHome({
  hasKey,
  resume,
  modelLabel,
  effortLabel,
  onOpenResume,
  onOpenWork,
  onNew,
  onImport,
  onSettings,
}: {
  hasKey: boolean;
  resume: Notebook | null;
  modelLabel: string;
  effortLabel: string;
  onOpenResume: (id: string) => void;
  onOpenWork: (notebookId: string, generationId: string) => void;
  onNew: () => void;
  onImport: () => void;
  onSettings: () => void;
}) {
  const g = greeting();
  const mod = modLabel(detectPlatform());
  const lastBackupAt = useSettings((s) => s.lastBackupAt) ?? 0;
  const [snapshot, setSnapshot] = useState<DeskSnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const sub = liveQuery(async (): Promise<DeskSnapshot> => {
      const [notebookCount, sourceCount, workCount, recentNotebooks, generations] =
        await Promise.all([
          db.notebooks.count(),
          db.sources.count(),
          db.generations.count(),
          db.notebooks.orderBy("updatedAt").reverse().limit(5).toArray(),
          db.generations.orderBy("createdAt").reverse().limit(4).toArray(),
        ]);
      const notebookIds = [...new Set(generations.map((work) => work.notebookId))];
      const workNotebooks = await db.notebooks.bulkGet(notebookIds);
      const names = new Map(
        notebookIds.map((id, index) => [id, workNotebooks[index]?.name ?? "Notebook"]),
      );
      return {
        notebookCount,
        sourceCount,
        workCount,
        recentNotebooks,
        recentWork: generations.map((work) => ({
          ...work,
          notebookName: names.get(work.notebookId) ?? "Notebook",
        })),
      };
    }).subscribe({
      next: (value) => {
        setSnapshot(value);
        setLoadError(false);
      },
      error: () => setLoadError(true),
    });
    return () => sub.unsubscribe();
  }, []);

  const backupDue =
    snapshot !== null && snapshot.notebookCount > 0 && Date.now() - lastBackupAt > WEEK_MS;

  return (
    <main
      aria-labelledby="desk-home-title"
      className="relative min-h-0 flex-1 overflow-y-auto bg-ground"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(62%_90%_at_28%_0%,rgba(227,176,75,0.075),transparent_74%)]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-8 sm:px-9 sm:py-10 xl:px-12">
        <section className="grid items-end gap-8 border-b border-hairline pb-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-muted">
              {todayLine()} · Your desk
            </p>
            <h1
              id="desk-home-title"
              className="mt-4 max-w-2xl font-display text-[clamp(2rem,4vw,3.35rem)] font-[390] leading-[1.02] tracking-[-0.025em] text-ink"
            >
              {g.hello}. <em className="font-[420] text-lamp">The lamp is lit.</em>
            </h1>
            <p className="mt-4 max-w-xl text-[13.5px] leading-6 text-muted">
              Return to a subject, gather new material, or begin a clean notebook. Your library and study history stay on this device.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <button onClick={onNew} className={`${btnLamp} !min-h-[36px]`}>
                <BorderBeam size={48} duration={8} />
                <Plus size={14} weight="light" /> New notebook
              </button>
              <button onClick={onImport} className={btnGhost}>
                Add sources
              </button>
            </div>
          </div>

          <div className="border-l border-hairline pl-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Continue
            </div>
            {resume && snapshot?.notebookCount !== 0 ? (
              <button
                onClick={() => onOpenResume(resume.id)}
                className="group mt-3 w-full text-left"
              >
                <span className="block truncate font-display text-[1.35rem] font-[430] text-ink">
                  {resume.name}
                </span>
                <span className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                  Last opened {timeAgo(resume.updatedAt)}
                  <ArrowRight
                    size={14}
                    weight="light"
                    className="transition-transform duration-med group-hover:translate-x-0.5 group-hover:text-brasspale"
                  />
                </span>
              </button>
            ) : (
              <p className="mt-3 text-[12.5px] leading-5 text-muted">
                Your most recent notebook will wait here.
              </p>
            )}
          </div>
        </section>

        {!hasKey && (
          <section className="mt-6 flex flex-col gap-4 border-y border-brass/25 bg-brass/[0.045] px-4 py-4 sm:flex-row sm:items-center">
            <Flame className="h-5 w-5 shrink-0 text-brass" weight="light" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[13.5px] font-medium text-ink">Connect a model to begin</h2>
              <p className="mt-0.5 text-[12px] leading-5 text-muted">
                Use OpenRouter, Claude access, a custom endpoint, or a local Ollama / LM Studio model.
              </p>
            </div>
            <button onClick={onSettings} className={`${btnGhost} shrink-0`}>
              <GearSix size={14} weight="light" /> Configure
            </button>
          </section>
        )}

        {loadError && (
          <div role="alert" className="mt-6 flex items-center gap-2 border border-rust/30 bg-rust/[0.06] px-4 py-3 text-[12.5px] text-rust">
            <WarningCircle size={16} weight="light" />
            The desk could not read your library. No data was removed; reopen the app and try again.
          </div>
        )}

        <section aria-labelledby="recent-heading" className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex items-end justify-between gap-4 border-b border-hairline pb-2.5">
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted">Library</p>
                <h2 id="recent-heading" className="mt-1 font-display text-[1.2rem] font-[430] text-ink">
                  Recent notebooks
                </h2>
              </div>
              <span className="font-mono text-[10px] text-muted">
                {snapshot ? `${snapshot.notebookCount} total` : "Reading…"}
              </span>
            </div>

            <div className="divide-y divide-hairline">
              {snapshot?.recentNotebooks.map((notebook, index) => (
                <button
                  key={notebook.id}
                  onClick={() => onOpenResume(notebook.id)}
                  className="group grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left hover:text-brasspale"
                >
                  <span className="font-mono text-[10px] text-muted/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] text-ink/90 group-hover:text-ink">
                      {notebook.name}
                    </span>
                    <span className="block text-[10.5px] text-muted">Updated {timeAgo(notebook.updatedAt)}</span>
                  </span>
                  <ArrowRight size={14} weight="light" className="text-muted transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
              {snapshot && snapshot.recentNotebooks.length === 0 && (
                <div className="py-6 text-[12.5px] leading-5 text-muted">
                  Start with one notebook per subject. Add sources, then ask grounded questions or make study material in Studio.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="border-b border-hairline pb-2.5">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted">Studio bench</p>
              <h2 className="mt-1 font-display text-[1.2rem] font-[430] text-ink">Recent saved work</h2>
            </div>
            <div className="divide-y divide-hairline">
              {snapshot?.recentWork.map((work) => (
                <button
                  key={work.id}
                  onClick={() => onOpenWork(work.notebookId, work.id)}
                  className="group flex w-full items-center gap-3 py-3 text-left"
                >
                  <FileText size={15} weight="light" className="shrink-0 text-brasspale/80" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.75px] text-ink/90 group-hover:text-ink">{work.title}</span>
                    <span className="block truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
                      {kindLabel(work.kind)} · {work.notebookName}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted">{timeAgo(work.createdAt)}</span>
                </button>
              ))}
              {snapshot && snapshot.recentWork.length === 0 && (
                <p className="py-5 text-[12px] leading-5 text-muted">
                  Quizzes, mock exams, essay feedback, flashcards, study guides, briefs, FAQs, timelines, and slide decks collect here.
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-label="Desk health" className="mt-8 grid border-y border-hairline sm:grid-cols-3 sm:divide-x sm:divide-hairline">
          <DeskMetric
            icon={<Database size={15} weight="light" />}
            label="Local library"
            value={snapshot ? `${snapshot.sourceCount} sources` : "Reading…"}
            note={snapshot ? `${snapshot.workCount} saved pieces` : "On this device"}
          />
          <DeskMetric
            icon={<Books size={15} weight="light" />}
            label="Active model"
            value={hasKey ? modelLabel : "Not connected"}
            note={hasKey ? `${effortLabel} reasoning` : "Open Settings to connect"}
            onClick={onSettings}
          />
          <DeskMetric
            icon={<ShieldCheck size={15} weight="light" />}
            label="Backup"
            value={lastBackupAt ? timeAgo(lastBackupAt) : "Not yet backed up"}
            note={backupDue ? "A fresh copy is recommended" : "Your desk copy is current"}
            onClick={onSettings}
          />
        </section>

        {snapshot?.notebookCount === 0 && (
          <section className="mt-8 grid gap-5 border-l border-hairline pl-5 sm:grid-cols-3">
            <FirstStep number="01" title="Create a notebook">One subject or exam per notebook.</FirstStep>
            <FirstStep number="02" title="Add your sources">PDFs, documents, notes, links, and images.</FirstStep>
            <FirstStep number="03" title="Ask, drill, make">Cited chat and the full Studio share the same material.</FirstStep>
          </section>
        )}

        <footer className="mt-9 flex flex-col gap-3 pb-2 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            Your content is sent only when you ask the model you selected. Local endpoints can keep inference on-device.
          </span>
          <span className="shrink-0 font-mono">
            <Kbd>{mod}K</Kbd> commands · <Kbd>{mod}N</Kbd> new · <Kbd>{mod}1–3</Kbd> panes
          </span>
        </footer>
      </div>
    </main>
  );
}

function DeskMetric({
  icon,
  label,
  value,
  note,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
        {icon} {label}
      </span>
      <span className="mt-2 block truncate text-[13px] text-ink">{value}</span>
      <span className="mt-0.5 block text-[10.5px] text-muted">{note}</span>
    </>
  );
  const cls = "block min-w-0 px-4 py-4 text-left first:pl-0 last:pr-0";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} w-full hover:bg-ink/[0.025]`}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

function FirstStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div>
      <span className="font-mono text-[10px] tracking-[0.12em] text-brass/80">{number}</span>
      <h2 className="mt-1 text-[13px] font-medium text-ink">{title}</h2>
      <p className="mt-1 text-[11.5px] leading-5 text-muted">{children}</p>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-hairline-strong bg-ink/[0.04] px-1.5 py-px text-[9.5px] text-ink/85">
      {children}
    </kbd>
  );
}

function kindLabel(kind: Generation["kind"]): string {
  return kind.replace("essay-review", "essay feedback").replace("study-guide", "study guide");
}
