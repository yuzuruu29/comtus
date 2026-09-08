import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { List, X } from "@phosphor-icons/react";
import "../ui/ui.css";
import "./landing.css";

const LINKS = [
  { label: "How it works", hash: "#how-it-works" },
  { label: "Model access", hash: "#model-access" },
  { label: "Questions", hash: "#faq" },
];

export default function Nav({ onLanding = false }: { onLanding?: boolean }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);

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
          {LINKS.map((link) => <a href={`${onLanding ? "" : "/"}${link.hash}`} key={link.hash} onClick={() => setOpen(false)}>{link.label}</a>)}
        </nav>
        <div className="landing-nav-actions">
          <Link to="/studio" className="btn btn-primary btn-sm">Open Studio</Link>
          <button ref={toggleRef} className="landing-nav-toggle" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="landing-navigation" onClick={() => setOpen(!open)}>
            {open ? <X size={22} aria-hidden="true" /> : <List size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
