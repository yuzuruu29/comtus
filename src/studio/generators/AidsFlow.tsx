import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mathRemarkPlugins, mathRehypePlugins } from "../../lib/markdownMath";
import { externalMarkdownComponents } from "../ExternalLink";

import type {
  DocPayload,
  FlashcardsPayload,
  Generation,
  GenerationKind,
  PresentationPayload,
} from "../../lib/types";
import { generateJSON, generateMarkdown, friendlyError } from "../../lib/llm";
import { useCallSettings } from "../../lib/settings";
import { saveGeneration } from "../../lib/db";
import { GENERATOR_SYSTEM, buildSourceBlock, sanitizeCards } from "./common";
import DeckImport from "./DeckImport";
import { Field, inputCls, btnLamp, btnGhost, LampPulse, ErrorNote } from "../ui";
import { ArrowsIn, ArrowsOut, CaretLeft, Check, Copy, Crown, Presentation, Stack } from "@phosphor-icons/react";
import { ICON } from "../../ui/iconScale";

export { FlashcardsView } from "./FlashcardReview";

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
  sourceIds,
  initialKind,
  onDone,
  onCancel,
}: {
  notebookId: string;
  sourceIds?: string[];
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
      const src = await buildSourceBlock(notebookId, aid.name, sourceIds);
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
            className={`rounded-[var(--radius-dialog)] border p-4 text-left transition-colors disabled:opacity-60 ${
              kind === a.kind
                ? "border-brass/50 bg-brass/[0.08]"
                : "border-hairline bg-ink/[0.02] hover:border-hairline-strong"
            }`}
          >
            <div className="font-display text-[1.02rem] font-[440] text-ink">{a.name}</div>
            <div className="mt-1 text-label leading-snug text-muted">{a.line}</div>
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
        className="absolute right-0 top-0 z-10 flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-hairline bg-ground/70 px-3 py-1.5 text-label font-medium text-muted backdrop-blur transition-colors hover:text-ink"
      >
        {copied ? <Check size={ICON.xs} className="text-sage" /> : <Copy size={ICON.xs} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <div className="md pt-10">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, ...mathRemarkPlugins]}
          rehypePlugins={[...mathRehypePlugins]}
          components={externalMarkdownComponents}
        >
          {payload.markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}

/* ── Flashcards (Custom Card Count + Manual Addition) ─────── */

export function FlashcardsConfigForm({
  notebookId,
  sourceIds,
  onDone,
  onCancel,
}: {
  notebookId: string;
  sourceIds?: string[];
  onDone: (gen: Generation) => void;
  onCancel: () => void;
}) {
  const cs = useCallSettings();
  const [count, setCount] = useState(20);
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const PRESETS = [5, 10, 15, 20, 25, 30, 50];

  const generate = async () => {
    setError("");
    const targetCount = Math.max(1, Math.min(100, count || 20));
    setBusy(true);
    setStatus("Reading your sources…");
    try {
      const src = await buildSourceBlock(notebookId, scope || "key terms, definitions, and facts", sourceIds);
      if (!src.titles.length) throw new Error("Add at least one source first.");
      setStatus(`Distilling ${targetCount} cards…`);
      const payload = await generateJSON<FlashcardsPayload>({
        ...cs,
        system: GENERATOR_SYSTEM,
        user: `Make exactly ${targetCount} flashcards from these sources.

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
      <div>
        <div className="field-label mb-2">Number of cards</div>
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setCount(p)}
              aria-pressed={count === p}
              className={btnGhost}
            >
              {p} cards
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(100, +e.target.value)))}
            placeholder="Custom count (e.g. 15)"
            aria-label="Number of flashcards"
            className={inputCls + " font-mono text-small w-44"}
          />
          <span className="text-small text-muted">Custom count (1–100)</span>
        </div>
      </div>

      <Field label="Scope" hint="Empty = whole notebook">
        <input
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="e.g. pharmacology, jurisprudence, chapter 3"
          className={inputCls}
        />
      </Field>

      {status && <LampPulse label={status} />}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-3">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnLamp} onClick={generate} disabled={busy}>
          <Stack size={ICON.sm} className="mr-1.5 inline" />
          {busy ? "Distilling…" : `Make ${count} cards`}
        </button>
      </div>

      {!busy && <DeckImport notebookId={notebookId} onDone={onDone} />}
    </div>
  );
}

/* ── PPT & Slideshow Maker (Anthropic Exclusive) ──────────── */

export function PresentationConfigForm({
  notebookId,
  sourceIds,
  onDone,
  onCancel,
  onOpenSettings,
}: {
  notebookId: string;
  sourceIds?: string[];
  onDone: (gen: Generation) => void;
  onCancel: () => void;
  onOpenSettings?: () => void;
}) {
  const cs = useCallSettings();
  const [slideCount, setSlideCount] = useState(8);
  const [style, setStyle] = useState("Lecture Deck");
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const isAnthropic = cs.provider === "anthropic";

  const STYLES = [
    { name: "Lecture Deck", desc: "Comprehensive slide-by-slide concepts & teaching notes" },
    { name: "Executive Briefing", desc: "High-level visual summary with strategic takeaways" },
    { name: "Exam Review Deck", desc: "Core formulas, mnemonics, and high-yield board concepts" },
    { name: "Case Study Walkthrough", desc: "Scenario, clinical/legal analysis, and solution" },
  ];

  const generate = async () => {
    if (!isAnthropic) {
      setError("PPT & Slideshow Maker is exclusively available on Anthropic Claude (Opus 5.5 & Sonnet 5.5).");
      return;
    }
    setError("");
    setBusy(true);
    setStatus("Reading source materials…");
    try {
      const src = await buildSourceBlock(notebookId, focus || "comprehensive presentation deck", sourceIds);
      if (!src.titles.length) throw new Error("Add at least one source first.");
      setStatus(`Structuring ${slideCount}-slide deck with speaker notes…`);
      const payload = await generateJSON<PresentationPayload>({
        ...cs,
        system: GENERATOR_SYSTEM,
        user: `Generate a high-impact, professional ${slideCount}-slide presentation deck on: ${focus || "the notebook contents"}.

Sources:
${src.block}

Style: ${style}
Rules:
- Structure exactly ${slideCount} slides with clear progression: Title slide -> Core Concepts -> In-depth Analysis -> Applications -> Key Takeaways.
- For each slide provide: title, optional subtitle, 3-5 concise punchy bullet points, speaker notes for presenting, and a layout recommendation (e.g. "Key Definition", "2-Column Comparison", "Stat Callout", "Process Flow").

JSON shape:
{
  "topic": "...",
  "deckTitle": "...",
  "deckSubtitle": "...",
  "slides": [
    {
      "id": "1",
      "slideNumber": 1,
      "title": "...",
      "subtitle": "...",
      "bullets": ["...", "..."],
      "notes": "Speaker notes explaining the slide in detail...",
      "visualLayoutHint": "Key Definition"
    }
  ]
}`,
        onStatus: setStatus,
      });

      if (!payload.slides?.length) throw new Error("No slides returned — try adjusting topic focus.");

      const gen: Generation = {
        id: `${Date.now().toString(36)}-p`,
        notebookId,
        kind: "presentation",
        title: `${payload.deckTitle || "Presentation Deck"} · ${payload.slides.length} slides`,
        payload,
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

  if (!isAnthropic) {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-[var(--radius-dialog)] border border-brass/40 bg-gradient-to-b from-brass/[0.1] to-ground/90 p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Crown size={ICON.lg} className="text-brass" />
            <span className="font-display text-[1.2rem] font-[430] text-ink">
              Anthropic Exclusive Feature
            </span>
          </div>
          <p className="text-small leading-relaxed text-muted">
            The <strong>PPT & Slideshow Maker</strong> requires the deep architectural synthesis and structured reasoning of <strong>Claude Opus 5.5 & Sonnet 5.5</strong> to produce production-grade slide decks and speaker scripts.
          </p>
          <div className="rounded-[var(--radius-dialog)] border border-hairline bg-ground/70 p-3 text-small text-brass flex items-center justify-between">
            <span>Available with a Study Pass or Anthropic API key · First purchase from $5</span>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="rounded-[var(--radius-field)] grad-lamp px-3 py-1 text-label font-semibold text-ground"
              >
                Open Settings
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <button className={btnGhost} onClick={onCancel}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-label text-brass">
        <Crown size={ICON.sm} className="text-brass" />
        <span>Powered by Claude Opus 5.5 & Sonnet 5.5</span>
      </div>

      <div>
        <div className="field-label mb-2">Presentation style</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setStyle(s.name)}
              className={`rounded-[var(--radius-dialog)] border p-3 text-left transition-colors ${
                style === s.name
                  ? "border-brass/50 bg-brass/[0.08]"
                  : "border-hairline bg-ink/[0.02] hover:border-hairline-strong"
              }`}
            >
              <div className="font-medium text-small text-ink">{s.name}</div>
              <div className="mt-0.5 text-label text-muted">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Number of Slides">
          <div className="flex items-center gap-2">
            {[5, 8, 10, 12, 15].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSlideCount(n)}
                aria-pressed={slideCount === n}
                className={btnGhost}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Focus Topic (Optional)" hint="Empty = whole notebook">
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. Cardiovascular Pathology"
            className={inputCls}
          />
        </Field>
      </div>

      {status && <LampPulse label={status} />}
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex justify-end gap-3">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnLamp} onClick={generate} disabled={busy}>
          <Presentation size={ICON.sm} className="mr-1.5 inline" />
          {busy ? "Generating deck…" : `Build ${slideCount}-Slide Deck`}
        </button>
      </div>
    </div>
  );
}

export function SlideshowView({ gen }: { gen: Generation }) {
  const payload = gen.payload as PresentationPayload;
  const slides = payload.slides ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const slide = slides[activeIdx] || slides[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        setActiveIdx((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length, fullscreen]);

  if (!slides.length) {
    return <div className="text-center text-muted py-8">No slides found in this presentation.</div>;
  }

  const exportMarkdown = () => {
    let md = `# ${payload.deckTitle || "Presentation"}\n${payload.deckSubtitle ? `## ${payload.deckSubtitle}\n\n` : "\n"}---\n\n`;
    slides.forEach((s) => {
      md += `## ${s.title}\n`;
      if (s.subtitle) md += `*${s.subtitle}*\n\n`;
      s.bullets.forEach((b) => {
        md += `- ${b}\n`;
      });
      if (s.notes) md += `\n<!-- Presenter Notes:\n${s.notes}\n-->\n\n`;
      md += `---\n\n`;
    });
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={`space-y-4 ${fullscreen ? "fixed inset-0 z-50 bg-ground p-6 sm:p-12 overflow-y-auto flex flex-col justify-between" : ""}`}>
      {/* Top Deck Info & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-3">
        <div>
          <h3 className="font-display text-[1.25rem] font-[430] text-ink">
            {payload.deckTitle || "Presentation Deck"}
          </h3>
          {payload.deckSubtitle && (
            <p className="text-small text-muted">{payload.deckSubtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotes((v) => !v)}
            className={`rounded-[var(--radius-field)] border px-2.5 py-1 text-label transition-colors ${
              showNotes ? "border-brass/50 bg-brass/15 text-brass" : "border-hairline text-muted hover:text-ink"
            }`}
          >
            Speaker Notes {showNotes ? "On" : "Off"}
          </button>
          <button
            onClick={exportMarkdown}
            className="flex items-center gap-1 rounded-[var(--radius-field)] border border-hairline bg-ink/5 px-2.5 py-1 text-label text-muted hover:text-ink"
          >
            {copied ? <Check size={ICON.xs} className="text-sage" /> : <Copy size={ICON.xs} />}
            {copied ? "Copied" : "Copy Deck"}
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="flex items-center gap-1 rounded-[var(--radius-field)] border border-hairline bg-ink/5 px-2.5 py-1 text-label text-muted hover:text-ink"
          >
            {fullscreen ? <ArrowsIn size={ICON.xs} /> : <ArrowsOut size={ICON.xs} />}
            {fullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Active Slide Card */}
      <div className="relative min-h-[340px] sm:min-h-[380px] rounded-[var(--radius-dialog)] border border-brass/30 bg-gradient-to-b from-surface/95 to-ground p-6 sm:p-8 flex flex-col justify-between shadow-[0_15px_40px_rgba(0,0,0,0.4)]">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-label font-medium tabular-nums text-brass bg-brass/10 border border-brass/25 px-2.5 py-0.5 rounded-[var(--radius-pill)]">
              Slide {activeIdx + 1} of {slides.length}
            </span>
            {slide.visualLayoutHint && (
              <span className="text-label text-muted border border-hairline px-2 py-0.5 rounded">
                Layout: {slide.visualLayoutHint}
              </span>
            )}
          </div>

          <h2 className="mt-4 font-display text-[1.5rem] sm:text-[1.8rem] font-[430] text-ink leading-snug">
            {slide.title}
          </h2>

          {slide.subtitle && (
            <p className="mt-1 text-small text-muted italic">{slide.subtitle}</p>
          )}

          <ul className="mt-6 space-y-2.5">
            {slide.bullets?.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-body leading-relaxed text-ink/90">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-[var(--radius-pill)] bg-brass shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Speaker Notes Drawer */}
        {showNotes && slide.notes && (
          <div className="mt-6 pt-4 border-t border-hairline bg-ground/50 rounded-[var(--radius-dialog)] p-3.5 space-y-1">
            <span className="text-label text-brass font-medium">
              Speaker notes
            </span>
            <p className="text-small leading-relaxed text-muted">{slide.notes}</p>
          </div>
        )}
      </div>

      {/* Slide Navigation Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
          disabled={activeIdx === 0}
          className={btnGhost + " disabled:opacity-30"}
        >
          <CaretLeft size={ICON.sm} className="mr-1 inline" /> Previous
        </button>

        {/* Slide indicator dots */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`h-2 rounded-[var(--radius-pill)] transition-all ${
                activeIdx === idx ? "w-6 bg-brass" : "w-2 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => setActiveIdx((i) => Math.min(slides.length - 1, i + 1))}
          disabled={activeIdx === slides.length - 1}
          className={btnLamp + " disabled:opacity-30"}
        >
          Next
        </button>
      </div>
    </div>
  );
}
