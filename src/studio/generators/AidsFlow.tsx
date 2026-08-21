import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "motion/react";
import { Copy, Check, RotateCcw, Layers } from "lucide-react";
import type {
  DocPayload,
  FlashcardsPayload,
  Flashcard,
  Generation,
  GenerationKind,
} from "../../lib/types";
import { db } from "../../lib/db";
import { generateJSON, generateMarkdown, friendlyError } from "../../lib/llm";
import { useCallSettings } from "../../lib/settings";
import { saveGeneration } from "../../lib/db";
import { SPRING } from "../fx";
import { GENERATOR_SYSTEM, buildSourceBlock, sanitizeCards } from "./common";
import { Field, inputCls, btnLamp, btnGhost, LampPulse, ErrorNote } from "../ui";

/* ── Document aids: study guide, brief, FAQ, timeline ─────── */

const AIDS: { kind: GenerationKind; name: string; line: string; ask: string }[] = [
  {
    kind: "study-guide",
    name: "Study guide",
    line: "The whole notebook, organized for revision",
    ask: "a complete study guide: organized by topic with key concepts defined, essential facts, and a self-test question list at the end",
  },
  {
    kind: "brief",
    name: "Briefing doc",
    line: "Two pages a busy person would actually read",
    ask: "an executive briefing: the situation in one paragraph, the key points, the numbers that matter, and what it implies",
  },
  {
    kind: "faq",
    name: "FAQ",
    line: "The questions an examiner would ask",
    ask: "10–15 frequently asked questions with precise, sourced answers — the kind a careful examiner or client would ask",
  },
  {
    kind: "timeline",
    name: "Timeline",
    line: "Chronology of events, procedures, or arguments",
    ask: "a chronological timeline of the events, stages, or intellectual developments across the sources, with dates or sequence made explicit",
  },
];

export function AidsConfigForm({
  notebookId,
  initialKind,
  onDone,
  onCancel,
}: {
  notebookId: string;
  initialKind?: GenerationKind;
  onDone: (gen: Generation) => void;
  onCancel: () => void;
}) {
  const cs = useCallSettings();
  const [kind, setKind] = useState<GenerationKind>(
    initialKind && AIDS.some((a) => a.kind === initialKind) ? initialKind : "study-guide",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    const aid = AIDS.find((a) => a.kind === kind)!;
    setError("");
    setBusy(true);
    setStatus("Reading your sources…");
    try {
      const src = await buildSourceBlock(notebookId, aid.name);
      if (!src.titles.length) throw new Error("Add at least one source first.");
      setStatus(`Writing your ${aid.name.toLowerCase()}…`);
      const markdown = await generateMarkdown({
        ...cs,
        system: `${GENERATOR_SYSTEM}\n\nYou are writing markdown documents. Use headers, bold key terms, tables where they clarify. Cite source titles inline like (Source: Title) when a claim matters.`,
        user: `Write ${aid.ask}.

Sources:
${src.block}

Return ONLY the markdown document — no preamble.`,
        onStatus: setStatus,
      });
      const gen: Generation = {
        id: `${Date.now().toString(36)}-d`,
        notebookId,
        kind,
        title: aid.name,
        payload: { markdown } satisfies DocPayload,
        createdAt: Date.now(),
      };
      await saveGeneration(gen);
      onDone(gen);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {AIDS.map((a) => (
          <button
            key={a.kind}
            onClick={() => setKind(a.kind)}
            disabled={busy}
            className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
              kind === a.kind
                ? "border-brass/50 bg-brass/[0.08]"
                : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
            }`}
          >
            <div className="font-display text-[1.02rem] font-[440] text-parchment">{a.name}</div>
            <div className="mt-1 text-[11.5px] leading-snug text-faded">{a.line}</div>
          </button>
        ))}
      </div>
      {status && <LampPulse label={status} />}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-3">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnLamp} onClick={generate} disabled={busy}>
          {busy ? "Writing…" : "Write it"}
        </button>
      </div>
    </div>
  );
}

export function DocViewer({ payload }: { payload: DocPayload }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => {
          navigator.clipboard.writeText(payload.markdown);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className="absolute right-0 top-0 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-night/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faded backdrop-blur transition-colors hover:text-parchment"
      >
        {copied ? <Check size={11} className="text-sage" /> : <Copy size={11} />}
        {copied ? "copied" : "copy"}
      </button>
      <div className="md pt-10">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{payload.markdown}</ReactMarkdown>
      </div>
    </div>
  );
}

/* ── Flashcards ───────────────────────────────────────────── */

export function FlashcardsConfigForm({
  notebookId,
  onDone,
  onCancel,
}: {
  notebookId: string;
  onDone: (gen: Generation) => void;
  onCancel: () => void;
}) {
  const cs = useCallSettings();
  const [count, setCount] = useState(20);
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    setError("");
    setBusy(true);
    setStatus("Reading your sources…");
    try {
      const src = await buildSourceBlock(notebookId, scope || "key terms, definitions, and facts");
      if (!src.titles.length) throw new Error("Add at least one source first.");
      setStatus(`Distilling ${count} cards…`);
      const payload = await generateJSON<FlashcardsPayload>({
        ...cs,
        system: GENERATOR_SYSTEM,
        user: `Make ${count} flashcards from these sources.

Sources:
${src.block}

Scope: ${scope || "the most testable material across the notebook"}
Rules: front = a precise question or term (never yes/no); back = a complete but compact answer (1–3 sentences). Tag each card with a topic.

JSON shape: {"cards":[{"front":"...","back":"...","topic":"..."}]}`,
        onStatus: setStatus,
      });
      if (!payload.cards?.length) throw new Error("No cards came back — try widening the scope.");
      const cards = sanitizeCards(payload.cards);
      if (cards.length === 0) throw new Error("The cards came back malformed — try again.");
      const gen: Generation = {
        id: `${Date.now().toString(36)}-f`,
        notebookId,
        kind: "flashcards",
        title: `Flashcards · ${cards.length}`,
        payload: { cards },
        createdAt: Date.now(),
      };
      await saveGeneration(gen);
      onDone(gen);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cards">
          <select value={count} onChange={(e) => setCount(+e.target.value)} className={inputCls}>
            {[10, 20, 30, 40].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Field>
        <Field label="Scope" hint="Empty = whole notebook">
          <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="e.g. pharmacology" className={inputCls} />
        </Field>
      </div>
      {status && <LampPulse label={status} />}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-3">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnLamp} onClick={generate} disabled={busy}>
          <Layers size={13} className="mr-1.5 inline" />
          {busy ? "Distilling…" : "Make cards"}
        </button>
      </div>
    </div>
  );
}

export function FlashcardsView({
  gen,
  notebookId,
}: {
  gen: Generation;
  notebookId: string;
}) {
  const payload = gen.payload as FlashcardsPayload;
  const [order] = useState<Flashcard[]>(payload.cards);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState(0);

  const genKey = gen.id;
  const done = pos >= order.length;
  const card = order[pos];

  useEffect(() => {
    void db.cardProgress.where("generationId").equals(genKey).count().then(setRatings);
  }, [genKey]);

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="font-display text-[2rem] font-[420] text-lamp">Deck cleared.</div>
        <p className="text-[13px] text-faded">
          Ratings saved — the cards you rated hardest will come back sooner.
        </p>
        <div className="flex justify-center gap-3">
          <button
            className={btnGhost}
            onClick={() => {
              setPos(0);
              setFlipped(false);
            }}
          >
            <RotateCcw size={13} className="mr-1.5 inline" /> Run again
          </button>
        </div>
      </div>
    );
  }

  const rate = async (quality: "again" | "hard" | "good" | "easy") => {
    const id = `${genKey}:${card.id}`;
    const existing = await db.cardProgress.get(id);
    const ease = existing?.ease ?? 2.5;
    const interval = existing?.intervalDays ?? 0;
    const reps = (existing?.reps ?? 0) + 1;
    const nextEase = Math.max(1.3, ease + { again: -0.2, hard: -0.05, good: 0.02, easy: 0.12 }[quality]);
    const nextInterval =
      quality === "again"
        ? 0
        : reps === 1
          ? { hard: 1, good: 1, easy: 2 }[quality]
          : Math.max(1, Math.round(interval * nextEase * { hard: 0.8, good: 1, easy: 1.25 }[quality]));
    await db.cardProgress.put({
      id,
      generationId: genKey,
      notebookId,
      ease: nextEase,
      intervalDays: nextInterval,
      dueAt: Date.now() + nextInterval * 86400_000,
      reps,
    });
    setRatings((r) => r + 1);
    setPos((p) => p + 1);
    setFlipped(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-faded">
        <span>
          Card {pos + 1} / {order.length}
        </span>
        <span>{card.topic}</span>
      </div>
      <div key={card.id} className="h-[260px] w-full sm:h-[280px]" style={{ perspective: 1400 }}>
        <motion.button
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Hide answer" : "Reveal answer"}
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotateY: flipped ? 180 : 0 }}
          transition={{ ...SPRING, stiffness: 260, damping: 26 }}
          className="relative block h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-[1.4rem] border border-white/[0.09] bg-study/80 p-6 text-center transition-colors duration-300 hover:border-brass/30 sm:p-7"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <div className="my-auto max-h-full overflow-y-auto px-1 py-3">
              <span className="font-display text-[1.25rem] font-[430] leading-snug text-parchment sm:text-[1.35rem]">
                {card.front}
              </span>
            </div>
            <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faded/60">
              tap to flip
            </span>
          </div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-[1.4rem] border border-brass/25 bg-study p-6 text-center shadow-[0_18px_50px_rgba(0,0,0,0.35)] sm:p-7"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="my-auto max-h-full overflow-y-auto px-1 py-3">
              <span className="text-[13.5px] leading-relaxed text-parchment/90 sm:text-[14px]">{card.back}</span>
            </div>
            <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faded/60">
              tap to flip
            </span>
          </div>
        </motion.button>
      </div>
      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ["again", "text-rust", "border-rust/40"],
              ["hard", "text-brasspale", "border-brass/40"],
              ["good", "text-sage", "border-sage/40"],
              ["easy", "text-sage", "border-sage/40"],
            ] as const
          ).map(([q, textCls, borderCls]) => (
            <button
              key={q}
              onClick={() => void rate(q)}
              className={`flex min-h-[44px] items-center justify-center rounded-xl border ${borderCls} ${textCls} bg-white/[0.02] py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all hover:bg-white/[0.06] active:scale-95`}
            >
              {q}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <button className={btnLamp} onClick={() => setFlipped(true)}>
            Reveal
          </button>
        </div>
      )}
      {ratings > 0 && (
        <div className="text-center font-mono text-[9.5px] uppercase tracking-[0.18em] text-faded/60">
          {ratings} ratings on this deck
        </div>
      )}
    </div>
  );
}
