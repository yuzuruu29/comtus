import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { List, X } from "@phosphor-icons/react";
import "../ui/ui.css";
import "./landing.css";
import "./landing-motion.css";
import { ICON } from "../ui/iconScale";

const LINKS = [
  { label: "How it works", hash: "#how-it-works" },
  { label: "Model access", hash: "#model-access" },
  { label: "Desktop app", hash: "#desktop" },
  { label: "Questions", hash: "#faq" },
];

/** The section the reader is in, so the link that points at it can say so.
 *  A thin band across the upper part of the viewport decides: a section counts
 *  once it reaches the line of reading, not the moment its edge peeks in. */
function useCurrentSection(enabled: boolean) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const sections = LINKS.map((link) => document.querySelector<HTMLElement>(link.hash)).filter(
      (section): section is HTMLElement => section !== null,
    );
    if (sections.length === 0) return;

    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        // Where two sections meet inside the band, the one being scrolled into wins.
        setCurrent([...LINKS].reverse().find((link) => inBand.has(link.hash.slice(1)))?.hash ?? null);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [enabled]);

  return current;
}

export default function Nav({ onLanding = false }: { onLanding?: boolean }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const current = useCurrentSection(onLanding);

  useEffect(() => {
    if (!open) return;
    navigationRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="landing-nav">
      <div className="landing-container landing-nav-inner">
        <Link to="/" className="landing-wordmark" aria-label="Comtus home">comtus<span aria-hidden="true">.</span></Link>
        <nav ref={navigationRef} id="landing-navigation" className="landing-nav-links" aria-label="Main navigation" data-open={open}>
          {LINKS.map((link) => (
            <a
              href={`${onLanding ? "" : "/"}${link.hash}`}
              key={link.hash}
              aria-current={current === link.hash ? "location" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="landing-nav-actions">
          <Link to="/studio" className="btn btn-primary btn-sm">Open the desk</Link>
          <button ref={toggleRef} className="landing-nav-toggle" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="landing-navigation" onClick={() => setOpen(!open)}>
            <List className="landing-nav-icon-open" size={ICON.xxl} aria-hidden="true" />
            <X className="landing-nav-icon-close" size={ICON.xxl} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
