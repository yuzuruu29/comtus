import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { Cards, ChatCircleText, Highlighter, NotePencil, Trash, X } from "@phosphor-icons/react";
import { Button, Dialog, Segmented, Textarea } from "../ui";
import type { Highlight, Source } from "../lib/types";
import { createCustomNote } from "../lib/db";
import {
  READING_DECK,
  addHighlight,
  addReadingCard,
  highlightsMarkdown,
  listSourceHighlights,
  passagePrompt,
  quoteLine,
  removeHighlight,
  setHighlightNote,
} from "../lib/highlights";
import {
  blockIndexAt,
  estimatedPage,
  inlineMarkup,
  readerBlocks,
  styledPieces,
  textRuns,
  type InlineSpan,
  type ReaderBlock,
  type TextRun,
} from "../lib/readerBlocks";
import { useMediaQuery } from "../lib/useMediaQuery";
import ExternalLink from "./ExternalLink";
import { popoverPosition, selectedRange } from "./readerSelection";
import "./source-reader.css";
import { ICON } from "../ui/iconScale";

type View = "read" | "marks";

/** The source reader: Literata at --text-read on a 68ch measure, the
 *  source's own paragraphs, headings and page breaks, and the student's
 *  highlights and margin notes on top. Select any passage to mark it,
 *  note it, or ask about it in chat. */
export default function SourceReader({
  source,
  startChar,
  onClose,
  onAsk,
  onHighlightsChanged,
}: {
  source: Source;
  startChar?: number;
  onClose: () => void;
  /** Hands a quoted passage to the chat composer. */
  onAsk?: (prompt: string) => void;
  onHighlightsChanged?: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const coarse = useMediaQuery("(pointer: coarse)");
  const blocks = useMemo(() => readerBlocks(source.content), [source.content]);
  const hasPageMarkers = useMemo(() => blocks.some((b) => b.kind === "page"), [blocks]);

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [view, setView] = useState<View>("read");
  const [selection, setSelection] = useState<{ start: number; end: number; anchor: DOMRect } | null>(null);
  const [editing, setEditing] = useState<{ id: string; focusNote: boolean } | null>(null);
  const [draft, setDraft] = useState("");
  // Bumped on every jump so the cite-flash animation replays (an unchanged
  // className does not restart a CSS animation).
  const [flash, setFlash] = useState<{ block: number; tick: number } | null>(null);
  const [pendingJump, setPendingJump] = useState<number | null>(null);
  const [saved, setSaved] = useState("");
  const [notice, setNotice] = useState("");
  const toolbarPressed = useRef(false);

  const reload = useCallback(async () => {
    setHighlights(await listSourceHighlights(source.id));
  }, [source.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const changed = useCallback(async () => {
    await reload();
    onHighlightsChanged?.();
  }, [onHighlightsChanged, reload]);

  const jumpTo = useCallback(
    (offset: number) => {
      const index = blockIndexAt(blocks, offset);
      const el = bodyRef.current?.querySelector(`[data-block="${index}"]`);
      el?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      setFlash((prev) => ({ block: index, tick: (prev?.tick ?? 0) + 1 }));
    },
    [blocks, reduceMotion],
  );

  useEffect(() => {
    if (startChar !== undefined) jumpTo(startChar);
  }, [jumpTo, startChar]);

  // A jump from the highlights list lands once the text is back on screen.
  useEffect(() => {
    if (view !== "read" || pendingJump === null) return;
    jumpTo(pendingJump);
    setPendingJump(null);
  }, [jumpTo, pendingJump, view]);

  /* ── Selecting text ─────────────────────────────────────── */

  useEffect(() => {
    if (view !== "read") return;
    let frame = 0;
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const body = bodyRef.current;
        if (!body) return;
        const range = selectedRange(body);
        if (range) setSelection({ start: range.start, end: range.end, anchor: range.rect });
        else if (!toolbarPressed.current) setSelection(null);
      });
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [view]);

  const clearSelection = () => {
    toolbarPressed.current = false;
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  const placeToolbar = useCallback(
    (el: HTMLDivElement | null) => {
      const body = bodyRef.current;
      if (!el || !body || !selection) return;
      const { top, left } = popoverPosition(
        selection.anchor,
        body,
        { width: el.offsetWidth, height: el.offsetHeight },
        coarse,
      );
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.dataset.placed = "true";
    },
    [coarse, selection],
  );

  /* ── Highlights and notes ───────────────────────────────── */

  const openEditor = (id: string, focusNote: boolean) => {
    const h = highlights.find((x) => x.id === id);
    setDraft(h?.note ?? "");
    setEditing({ id, focusNote });
  };

  const closeEditor = async () => {
    const current = editing && highlights.find((h) => h.id === editing.id);
    setEditing(null);
    if (current && draft.trim() !== current.note) {
      await setHighlightNote(current.id, draft);
      await changed();
    }
  };

  const markSelection = async (withNote: boolean) => {
    if (!selection) return;
    const saved = await addHighlight(source, selection.start, selection.end);
    clearSelection();
    await changed();
    if (saved && withNote) {
      setDraft(saved.note);
      setEditing({ id: saved.id, focusNote: true });
    }
  };

  const makeCard = async () => {
    if (!selection) return;
    const result = await addReadingCard(source, selection.start, selection.end, pageOf(selection.start));
    clearSelection();
    if (!result) return;
    setNotice(
      result.added
        ? `Added a cloze card to “${READING_DECK}” in your study tools.`
        : `That card is already in “${READING_DECK}”.`,
    );
  };

  const askAbout = (passage: string) => {
    if (!onAsk) return;
    onAsk(passagePrompt(source.title, passage));
    onClose();
  };

  const placeEditor = useCallback(
    (el: HTMLDivElement | null) => {
      const body = bodyRef.current;
      if (!el || !body || !editing) return;
      const mark = body.querySelector(`[data-mark="${editing.id}"]`);
      if (!mark) return;
      const rect = mark.getClientRects()[0] ?? mark.getBoundingClientRect();
      const { top, left } = popoverPosition(rect, body, { width: el.offsetWidth, height: el.offsetHeight }, true);
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.dataset.placed = "true";
      // Focus only once visible: a hidden field can't take focus, which is
      // why this isn't autoFocus.
      if (editing.focusNote) el.querySelector("textarea")?.focus({ preventScroll: true });
      el.scrollIntoView?.({ block: "nearest" });
    },
    [editing],
  );

  const onMarkKey = (event: KeyboardEvent<HTMLElement>, id: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openEditor(id, true);
  };

  const editingHighlight = editing ? highlights.find((h) => h.id === editing.id) : undefined;

  const pageOf = useCallback(
    (offset: number) => {
      const block = blocks[blockIndexAt(blocks, offset)];
      return hasPageMarkers ? block?.page : estimatedPage(offset, source.content.length, source.meta?.pages);
    },
    [blocks, hasPageMarkers, source.content.length, source.meta?.pages],
  );

  const saveAsNote = async () => {
    const title = `Highlights · ${source.title}`;
    await createCustomNote(source.notebookId, title, highlightsMarkdown(source.title, highlights, pageOf), [
      "highlights",
    ]);
    setSaved(`Saved “${title}” to your notes.`);
  };

  /* ── Rendering ──────────────────────────────────────────── */

  // Notes sit under the block where their highlight starts.
  const notesByBlock = useMemo(() => {
    const map = new Map<number, Highlight[]>();
    for (const h of highlights) {
      if (!h.note) continue;
      const i = blockIndexAt(blocks, h.start);
      map.set(i, [...(map.get(i) ?? []), h]);
    }
    return map;
  }, [blocks, highlights]);

  // Without printed page markers, the margin shows an estimated page
  // where each new page begins.
  const marginPages = useMemo(() => {
    let last: number | undefined;
    return blocks.map((b) => {
      if (hasPageMarkers) return undefined;
      const page = estimatedPage(b.at, source.content.length, source.meta?.pages);
      const shown = page !== last ? page : undefined;
      last = page;
      return shown;
    });
  }, [blocks, hasPageMarkers, source.content.length, source.meta?.pages]);

  // Markdown markers are hidden, not removed, so offsets stay exact.
  const markupByBlock = useMemo(
    () => blocks.map((b) => (b.kind === "page" || /^\s*(```|~~~)/.test(b.text) ? [] : inlineMarkup(b.text))),
    [blocks],
  );

  const renderText = (b: ReaderBlock, run: TextRun, spans: InlineSpan[]) =>
    spans.length === 0
      ? run.text
      : styledPieces(b.at, run, spans).map((piece) => (
          <span
            key={piece.at}
            data-at={piece.at}
            className={piece.styles.map((style) => `reader-md-${style}`).join(" ") || undefined}
          >
            {piece.text}
          </span>
        ));

  const renderRuns = (b: ReaderBlock, spans: InlineSpan[]) =>
    textRuns(b.at, b.text, highlights).map((run) =>
      run.mark ? (
        // A span, not <mark>: it is also the button that opens the note, and
        // its accessible name is the passage itself.
        <span
          key={run.at}
          data-at={run.at}
          data-mark={run.mark}
          className="reader-mark"
          tabIndex={0}
          role="button"
          aria-roledescription="highlight"
          title="Open the note on this highlight"
          onClick={() => {
            // A drag that starts inside a highlight is a new selection.
            if (window.getSelection()?.isCollapsed !== false) openEditor(run.mark!, false);
          }}
          onKeyDown={(event) => onMarkKey(event, run.mark!)}
        >
          {renderText(b, run, spans)}
        </span>
      ) : spans.length === 0 ? (
        <span key={run.at} data-at={run.at}>
          {run.text}
        </span>
      ) : (
        <span key={run.at}>{renderText(b, run, spans)}</span>
      ),
    );

  const rendered: ReactNode[] = blocks.map((b, i) => {
    const flashing = flash?.block === i;
    const key = flashing ? `${b.at}:${flash.tick}` : String(b.at);
    if (b.kind === "page") {
      return (
        <div key={key} data-block={i} className={`reader-page${flashing ? " cite-flash" : ""}`}>
          <span>Page {b.page}</span>
        </div>
      );
    }
    const margin = marginPages[i];
    const notes = notesByBlock.get(i);
    const text =
      b.kind === "heading" ? (
        b.level && b.level <= 2 ? (
          <h3 className="reader-text reader-heading">{renderRuns(b, markupByBlock[i])}</h3>
        ) : (
          <h4 className="reader-text reader-heading reader-heading-minor">{renderRuns(b, markupByBlock[i])}</h4>
        )
      ) : (
        <p className={`reader-text${b.kind === "lines" ? " reader-lines" : ""}`}>{renderRuns(b, markupByBlock[i])}</p>
      );
    return (
      <div key={key} data-block={i} className={`reader-block${flashing ? " cite-flash" : ""}`}>
        <span aria-hidden="true" className="reader-margin">
          {margin ?? ""}
        </span>
        <div className="reader-column">
          {text}
          {notes?.map((h) => (
            <button
              key={h.id}
              type="button"
              className="reader-note"
              onClick={() => openEditor(h.id, true)}
              aria-label={`Your note: ${h.note}. Edit`}
            >
              <NotePencil size={ICON.sm} aria-hidden="true" />
              <span>{h.note}</span>
            </button>
          ))}
        </div>
      </div>
    );
  });

  const onEscape = () => {
    if (editing) {
      void closeEditor();
      return true;
    }
    if (selection) {
      clearSelection();
      return true;
    }
    return false;
  };

  return (
    <Dialog open onClose={onClose} onEscape={onEscape} title={source.title} wide>
      <div className="reader-head">
        <div className="reader-meta">
          {source.kind} · {source.tokens.toLocaleString()} tokens
          {source.meta?.url && (
            <>
              {" · "}
              <ExternalLink href={source.meta.url} className="text-moon underline-offset-2 hover:underline">
                Original link
              </ExternalLink>
            </>
          )}
        </div>
        <Segmented<View>
          aria-label="Reader view"
          value={view}
          onChange={(next) => {
            clearSelection();
            setEditing(null);
            setView(next);
          }}
          options={[
            { value: "read", label: "Text" },
            { value: "marks", label: highlights.length ? `Highlights · ${highlights.length}` : "Highlights" },
          ]}
        />
      </div>

      {view === "read" ? (
        <div
          ref={bodyRef}
          className="reader-body"
          data-margin={!hasPageMarkers && source.meta?.pages ? "pages" : undefined}
          onPointerDown={(event) => {
            const target = event.target as Element;
            if (editing && !target.closest(".reader-editor, .reader-mark, .reader-note")) void closeEditor();
            if (!target.closest(".reader-toolbar")) toolbarPressed.current = false;
          }}
        >
          {blocks.length === 0 ? (
            <p className="reader-empty">This source has no text to show.</p>
          ) : (
            rendered
          )}

          {selection && !editing && (
            <div
              ref={placeToolbar}
              role="toolbar"
              aria-label="Selected passage"
              className="reader-toolbar"
              onPointerDown={() => {
                toolbarPressed.current = true;
              }}
              // Keep the selection alive while a button is pressed.
              onMouseDown={(event) => event.preventDefault()}
            >
              <button type="button" onClick={() => void markSelection(false)}>
                <Highlighter size={ICON.md} aria-hidden="true" />
                Highlight
              </button>
              <button type="button" onClick={() => void markSelection(true)}>
                <NotePencil size={ICON.md} aria-hidden="true" />
                Note
              </button>
              <button type="button" onClick={() => void makeCard()} title="Make a fill-in-the-blank card from this sentence">
                <Cards size={ICON.md} aria-hidden="true" />
                Card
              </button>
              {onAsk && (
                <button type="button" onClick={() => askAbout(source.content.slice(selection.start, selection.end))}>
                  <ChatCircleText size={ICON.md} aria-hidden="true" />
                  Ask
                </button>
              )}
            </div>
          )}

          {editing && editingHighlight && (
            <div
              ref={placeEditor}
              role="dialog"
              aria-label="Highlight"
              className="reader-editor"
            >
              <label className="reader-editor-label" htmlFor={`note-${editing.id}`}>
                Your note
              </label>
              <Textarea
                id={`note-${editing.id}`}
                rows={3}
                value={draft}
                placeholder="Put it in your own words"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void closeEditor();
                  }
                }}
              />
              <div className="reader-editor-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash size={ICON.sm} aria-hidden="true" />}
                  onClick={async () => {
                    setEditing(null);
                    await removeHighlight(editingHighlight.id);
                    await changed();
                  }}
                >
                  Remove
                </Button>
                {onAsk && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ChatCircleText size={ICON.sm} aria-hidden="true" />}
                    onClick={() => askAbout(editingHighlight.quote)}
                  >
                    Ask
                  </Button>
                )}
                <Button size="sm" onClick={() => void closeEditor()}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="reader-body reader-marks">
          {highlights.length === 0 ? (
            <p className="reader-empty">
              Select any passage while reading to highlight it, write a note beside it, or ask about it in chat.
            </p>
          ) : (
            <>
              <ol className="reader-mark-list">
                {highlights.map((h) => {
                  const page = pageOf(h.start);
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingJump(h.start);
                          setView("read");
                        }}
                      >
                        <span className="reader-mark-quote">{quoteLine(h.quote)}</span>
                        {h.note && <span className="reader-mark-note">{h.note}</span>}
                        {page && <span className="reader-mark-page">Page {page}</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="reader-marks-foot">
                <p role="status">{saved}</p>
                <Button variant="secondary" size="sm" icon={<NotePencil size={ICON.sm} />} onClick={() => void saveAsNote()}>
                  Save as a note
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="reader-foot">
        <p role="status" className="reader-notice">
          {notice}
        </p>
        <Button variant="ghost" onClick={onClose} icon={<X size={ICON.sm} weight="light" />}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
