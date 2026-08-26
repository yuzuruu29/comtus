import { useState } from "react";
import { useLandingPlay } from "./LandingPlay";

const BOOKS = [
  { id: "notes", label: "Notes", fill: "#7FA8C9" },
  { id: "margin", label: "Margin", fill: "#8FBF98" },
  { id: "ink", label: "Ink", fill: "#C96A5E" },
] as const;

/** Tiny pixel desk under the hero. Click the lamp to bloom the page; books are skippable. */
export default function DeskDiorama() {
  const { lampLit, ignite, poke } = useLandingPlay();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="desk-diorama" aria-label="Pixel desk">
      <button
        type="button"
        className="desk-prop"
        data-on={lampLit}
        onClick={poke}
        aria-pressed={lampLit}
      >
        <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden>
          <rect x="9" y="1" width="6" height="4" fill="#FF8F00" />
          <rect x="10" y="2" width="4" height="3" fill="#FFC107" />
          <rect x="6" y="6" width="12" height="5" fill="#E3B04B" />
          <rect x="11" y="11" width="2" height="7" fill="#C99236" />
          <rect x="7" y="18" width="10" height="3" fill="#C99236" />
        </svg>
        <span>{lampLit ? "Lamp lit" : "Light the lamp"}</span>
      </button>

      {BOOKS.map((book) => (
        <button
          key={book.id}
          type="button"
          className="desk-prop"
          data-on={open === book.id}
          onClick={() => {
            setOpen((cur) => (cur === book.id ? null : book.id));
            ignite();
          }}
          aria-pressed={open === book.id}
        >
          <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden>
            <rect x="4" y="5" width="16" height="14" fill={book.fill} />
            <rect x="5" y="6" width="14" height="12" fill="#0B0F1A" opacity="0.35" />
            <rect x="7" y="9" width="10" height="2" fill="#F2EDE3" />
            <rect x="7" y="13" width="7" height="2" fill="#F2EDE3" opacity="0.6" />
          </svg>
          <span>{open === book.id ? "Open" : book.label}</span>
        </button>
      ))}
    </div>
  );
}
