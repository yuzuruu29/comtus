import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Flame, Plus } from "@phosphor-icons/react";
import { liveQuery } from "dexie";
import { db } from "../lib/db";
import type { Notebook } from "../lib/types";
import { detectPlatform, greeting, todayLine } from "../lib/desktop";
import { btnGhost, btnLamp, timeAgo } from "../studio/ui";
import { modLabel } from "../studio/shortcuts";

/** The desk at rest — no notebook open. A working home, not a marketing
    page: resume where you left off, start something, learn the keys. */
export default function DeskHome({
  hasKey,
  resume,
  onOpenResume,
  onNew,
  onImport,
  onSettings,
}: {
  hasKey: boolean;
  resume: Notebook | null;
  onOpenResume: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
  onSettings: () => void;
}) {
  const g = greeting();
  const platform = detectPlatform();
  const mod = modLabel(platform);

  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const sub = liveQuery(() => db.notebooks.count()).subscribe({
      next: (c) => setCount(c ?? 0),
      error: () => setCount(0),
    });
    return () => sub.unsubscribe();
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[46vh] bg-[radial-gradient(58%_100%_at_42%_0%,rgba(227,176,75,0.06),transparent_75%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col justify-center px-10 py-12">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-faded">
          {todayLine()}
        </div>
        <h1 className="mt-4 font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-[400] leading-[1.08] text-parchment">
          {g.hello}. <em className="font-[420] text-lamp">The lamp is lit.</em>
        </h1>

        {hasKey ? (
          <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-faded">
            Everything is where you left it. Pick a notebook from the library, or start something new.
          </p>
        ) : (
          <div className="mt-6 rounded-[var(--radius-dialog)] border border-brass/30 bg-brass/[0.06] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <Flame className="breathe mt-0.5 h-5 w-5 shrink-0 text-brass" weight="light" />
                <div>
                  <div className="text-[14px] font-medium text-parchment">Light the lamp</div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-faded">
                    Connect OpenRouter with free models, Claude via PayPal, or run offline with Ollama / LM Studio.
                  </p>
                </div>
              </div>
              <button onClick={onSettings} className={btnLamp}>
                Configure key
              </button>
            </div>
          </div>
        )}

        {resume && count !== 0 && (
          <button
            onClick={() => onOpenResume(resume.id)}
            className="group mt-7 flex w-full items-center gap-4 rounded-xl border border-white/[0.09] bg-study/40 px-5 py-4 text-left transition-colors duration-200 hover:border-brass/35 hover:bg-shelf/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10px] uppercase tracking-[0.24em] text-faded">
                Continue where you left off
              </span>
              <span className="mt-1.5 block truncate font-display text-[19px] font-[450] text-parchment">
                {resume.name}
              </span>
            </span>
            <span className="shrink-0 text-[11.5px] text-faded">{timeAgo(resume.updatedAt)}</span>
            <ArrowRight
              size={16}
              weight="light"
              className="shrink-0 text-faded transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-brasspale"
            />
          </button>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button onClick={onNew} className={`${btnLamp} !min-h-[36px]`}>
            <Plus size={14} weight="light" /> New notebook
          </button>
          <button onClick={onImport} className={btnGhost}>
            Add sources
          </button>
        </div>

        {count === 0 && (
          <ol className="mt-10 space-y-3.5 border-l border-white/[0.08] pl-5">
            {(
              [
                ["01", "Create a notebook", "One per subject or exam."],
                ["02", "Add your sources", "PDFs, docs, pastes, links — indexed locally, never uploaded."],
                ["03", "Ask, drill, grade", "Every answer cites the source it came from."],
              ] as const
            ).map(([n, title, body]) => (
              <li key={n}>
                <span className="mr-3 font-mono text-[10.5px] tracking-[0.1em] text-brass/70">{n}</span>
                <span className="text-[13.5px] font-medium text-parchment">{title}</span>
                <span className="ml-2 text-[12.5px] text-faded">{body}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-faded">At hand</div>
          <div className="mt-3 grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2">
            <Shortcut keys={[mod, "K"]} label="Command palette" />
            <Shortcut keys={[mod, "N"]} label="New notebook" />
            <Shortcut keys={[mod, "1"]} label="Sources pane" />
            <Shortcut keys={[mod, "2"]} label="Focus chat" />
            <Shortcut keys={[mod, "3"]} label="Studio pane" />
            <Shortcut keys={[`${mod}[`, `${mod}]`]} label="Cycle desk modes" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-1.5">
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </span>
      <span className="text-[12px] text-faded">{label}</span>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-white/[0.12] bg-white/[0.04] px-1.5 py-px font-mono text-[10.5px] text-parchment/85">
      {children}
    </kbd>
  );
}
