import { Link } from "react-router-dom";
import "./landing.css";

export default function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <div className="landing-footer-brand">
          <Link to="/" className="landing-wordmark" aria-label="Comtus home">comtus<span aria-hidden="true">.</span></Link>
          <p>A quiet place for the work<br />of understanding.</p>
        </div>
        <nav className="landing-footer-links" aria-label="Footer navigation">
          <div><span>At your desk</span><Link to="/studio">Open Studio</Link><Link to="/study-companion">Study guide</Link><Link to="/about">About Comtus</Link></div>
          <div><span>Good to know</span><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/responsible-ai">Responsible AI</Link><Link to="/contact">Contact</Link></div>
        </nav>
      </div>
      <div className="landing-container landing-footer-bottom"><span>Rough thought, polished.</span><span>Made for deliberate study.</span></div>
    </footer>
  );
}
