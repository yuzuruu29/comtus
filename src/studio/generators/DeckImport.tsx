import { useId, useRef, useState } from "react";
import { FileArrowUp } from "@phosphor-icons/react";
import { MAX_IMPORT_CARDS, parseCardFile, type ParsedDeck } from "../../lib/cardInterop";
import { saveGeneration } from "../../lib/db";
import type { Generation } from "../../lib/types";
import { Button } from "../../ui";
import { ErrorNote } from "../ui";
import { AssessmentContent } from "../../components/AssessmentContent";
import "./deck-import.css";
import { ICON } from "../../ui/iconScale";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * Brings an existing deck in: Anki's plain-text export, a CSV or a
 * tab-separated file. Shows what was found before anything is saved.
 */
export default function DeckImport({ notebookId, onDone }: { notebookId: string; onDone: (gen: Generation) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [deck, setDeck] = useState<ParsedDeck | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const read = async (file: File) => {
    setError("");
    setDeck(null);
    if (/\.(apkg|colpkg)$/i.test(file.name)) {
      setError("Comtus reads Anki's plain-text export rather than .apkg packages. In Anki, choose File → Export → Notes in Plain Text.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over 20 MB. Split the deck and import it in parts.");
      return;
    }
    try {
      const parsed = parseCardFile(await file.text(), file.name);
      if (parsed.cards.length === 0) {
        setError("No cards were found in that file. Each row needs a front and a back.");
        return;
      }
      setDeck(parsed);
    } catch {
      setError("That file could not be read as a deck.");
    }
  };

  const save = async () => {
    if (!deck || saving) return;
    setSaving(true);
    try {
      const gen: Generation = {
        id: `${Date.now().toString(36)}-f`,
        notebookId,
        kind: "flashcards",
        title: deck.title,
        payload: { cards: deck.cards },
        createdAt: Date.now(),
      };
      await saveGeneration(gen);
      onDone(gen);
    } catch {
      setError("The deck was not saved. Please try again.");
      setSaving(false);
    }
  };

  const notes = deck
    ? [
        deck.skipped > 0 &&
          (deck.cards.length >= MAX_IMPORT_CARDS
            ? `Only the first ${plural(MAX_IMPORT_CARDS, "card")} were taken; split larger decks.`
            : `${plural(deck.skipped, "row")} had no front or no back and ${deck.skipped === 1 ? "was" : "were"} left out.`),
        deck.mediaDropped > 0 &&
          `${plural(deck.mediaDropped, "card")} had images or sounds, which stay in Anki; the text came across.`,
      ].filter(Boolean)
    : [];

  return (
    <section className="deck-import" aria-label="Import a deck">
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".txt,.csv,.tsv,.apkg,text/plain,text/csv,text/tab-separated-values"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void read(file);
        }}
      />
      {deck ? (
        <div className="deck-import-found" role="status">
          <p className="deck-import-title">
            Found {plural(deck.cards.length, "card")} in “{deck.title}”.
          </p>
          <ul className="deck-import-sample">
            {deck.cards.slice(0, 3).map((card) => (
              <li key={card.id}>
                <span className="deck-import-front">
                  <AssessmentContent inline>{card.front}</AssessmentContent>
                </span>
                {card.back && (
                  <span className="deck-import-back">
                    <AssessmentContent inline>{card.back}</AssessmentContent>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {notes.map((note) => (
            <p key={String(note)} className="deck-import-note">
              {note}
            </p>
          ))}
          <div className="deck-import-actions">
            <Button variant="ghost" size="sm" onClick={() => setDeck(null)}>
              Choose another file
            </Button>
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Add {plural(deck.cards.length, "card")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="deck-import-ask">
          <Button
            variant="secondary"
            size="sm"
            icon={<FileArrowUp size={ICON.md} aria-hidden="true" />}
            aria-describedby={hintId}
            onClick={() => fileRef.current?.click()}
          >
            Import a deck
          </Button>
          <p id={hintId}>
            From Anki (File → Export → Notes in Plain Text) or a spreadsheet saved as CSV, with the front and back in
            the first two columns.
          </p>
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </section>
  );
}
