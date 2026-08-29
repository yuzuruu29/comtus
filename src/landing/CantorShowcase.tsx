import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Brain,
  Layers,
  CheckCircle2,
  ShieldCheck,
  GraduationCap,
  Laptop,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import CantorStringsCanvas from "./CantorStringsCanvas";
import CantorCircuitStream from "./CantorCircuitStream";
import CantorPixelTransition from "./CantorPixelTransition";
import { playProceduralSfx } from "../studio/companion/sfx";
import "./cantor-theme.css";

gsap.registerPlugin(ScrollTrigger);

const PRODUCTS = [
  {
    id: "socratic",
    tag: "Dialectic Engine",
    title: "Socratic Inquiry & Active Recall",
    desc: "Adaptive stepped question trees that probe foundational understanding and diagnose conceptual blind spots rather than feeding passive answers.",
    status: "98.4% Pass Rate · Socratic Pass",
    span: 2,
    icon: Brain,
  },
  {
    id: "leitner",
    tag: "Spaced Retention",
    title: "Smart Leitner Flashcard Queue",
    desc: "Automated spaced repetition algorithm with confidence weighting, speed drills, and scheduled memory consolidation.",
    status: "94.2% Long-Term Retention",
    span: 1,
    icon: Layers,
  },
  {
    id: "proof",
    tag: "Symbolic Reasoning",
    title: "Step-by-Step Proof Verification",
    desc: "Strict symbolic derivation engine validating intermediate steps in calculus, physics, and formal logic with instant error localization.",
    status: "99.1% Step Precision",
    span: 1,
    icon: CheckCircle2,
  },
  {
    id: "byok",
    tag: "Open Infrastructure",
    title: "Multi-Model BYOK Workbench",
    desc: "Connect directly to Claude 3.7 Sonnet, DeepSeek R1, GPT-4o, or run local offline models via Ollama. Zero vendor lock-in and zero telemetry.",
    status: "100% Data Sovereignty · SQLite",
    span: 2,
    icon: ShieldCheck,
  },
  {
    id: "integrity",
    tag: "Pedagogy First",
    title: "Academic Integrity by Design",
    desc: "Hints first, answers second. Source-grounded citations and rubric-based essay coaching that enhances student critical thinking.",
    status: "Strict Page Citations",
    span: 1,
    icon: GraduationCap,
  },
  {
    id: "desktop",
    tag: "Native Workspace",
    title: "Native Desktop Companion",
    desc: "Dedicated desktop workspace for macOS and Windows. 100% offline-ready with local IndexedDB storage and zero cloud dependency.",
    status: "Offline Ready (macOS / Win)",
    span: 1,
    icon: Laptop,
  },
];

const CURRICULA = [
  { name: "USMLE & Medical Boards", rate: "98.1% Readiness", tag: "Medicine" },
  { name: "NCLEX / PNLE Nursing", rate: "96.4% Readiness", tag: "Nursing" },
  { name: "STEM & Engineering", rate: "97.8% Readiness", tag: "Engineering" },
  { name: "Bar Exam & Legal Logic", rate: "95.2% Readiness", tag: "Law" },
  { name: "CPA & Board Accountancy", rate: "94.9% Readiness", tag: "Finance" },
  { name: "LET Licensure for Teachers", rate: "96.2% Readiness", tag: "Education" },
  { name: "Computer Science & Algorithms", rate: "99.0% Readiness", tag: "CS" },
  { name: "University Physics & Calc", rate: "98.5% Readiness", tag: "STEM" },
];

export default function CantorShowcase() {
  const rootRef = useRef<HTMLDivElement>(null);
  const bentoGridRef = useRef<HTMLDivElement>(null);
  const curriculaGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // 1. Hero Kinetic Entrance
      gsap.fromTo(
        ".c8-hero-h1",
        { y: 50, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 1.1, ease: "power4.out", delay: 0.2 }
      );
      gsap.fromTo(
        ".c8-hero-sub",
        { y: 35, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.0, ease: "power3.out", delay: 0.4 }
      );
      gsap.fromTo(
        ".c8-hero .c8-btn",
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.15, duration: 0.9, ease: "power3.out", delay: 0.6 }
      );

      // 2. Bento Cards 3D Perspective Scroll Trigger
      if (bentoGridRef.current) {
        const cards = bentoGridRef.current.querySelectorAll(".c8-bento-card");
        gsap.fromTo(
          cards,
          {
            y: 60,
            opacity: 0,
            scale: 0.94,
            rotateX: 6,
            transformPerspective: 1000,
          },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            rotateX: 0,
            stagger: 0.12,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: bentoGridRef.current,
              start: "top 82%",
              toggleActions: "play none none none",
            },
          }
        );
      }

      // 3. Curricula Grid Scroll Trigger
      if (curriculaGridRef.current) {
        const items = curriculaGridRef.current.querySelectorAll(".c8-curriculum-item");
        gsap.fromTo(
          items,
          { y: 35, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            stagger: 0.06,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: {
              trigger: curriculaGridRef.current,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          }
        );
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // 3D dynamic card spotlight tracking
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;

    card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  };

  const handleCardMouseEnter = () => {
    try {
      playProceduralSfx("click");
    } catch {}
  };

  const handleCardMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = `perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
  };

  return (
    <div ref={rootRef} className="cantor-wrapper" aria-label="Cantor8 High-Precision Study Infrastructure">
      {/* ── 1. Hero with Interactive Physics Strings Canvas ────────────────── */}
      <section className="c8-hero">
        <CantorStringsCanvas />

        <div className="c8-hero-content">
          <div className="c8-tag dark">
            <span className="c8-cube-tag" />
            <span className="c8-line-reveal">
              <span className="c8-line-inner" data-text="COMTUS COGNITIVE INFRASTRUCTURE">
                COMTUS COGNITIVE INFRASTRUCTURE
              </span>
            </span>
          </div>

          <h1 className="c8-hero-h1">
            Unified Cognitive Infrastructure for Deep Study
          </h1>

          <p className="c8-hero-sub">
            Transform complex course materials into defensible knowledge. Active recall, step-by-step proofs, and multi-model synthesis in one high-precision workspace.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/studio" className="c8-btn">
              <span className="c8-line-reveal">
                <span className="c8-line-inner" data-text="Open the Studio">
                  Open the Studio
                </span>
              </span>
              <div className="c8-arrow-wrap">
                <ArrowUpRight className="c8-arrow-icon" />
              </div>
            </Link>

            <a href="#foundations" className="c8-btn c8-btn-light">
              <span className="c8-line-reveal">
                <span className="c8-line-inner" data-text="Explore Architecture">
                  Explore Architecture
                </span>
              </span>
              <div className="c8-arrow-wrap">
                <ArrowUpRight className="c8-arrow-icon" />
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── Dynamic Pixel Matrix Transition 1 ──────────────────────────────── */}
      <CantorPixelTransition fromColor="#044AB3" toColor="#F5F3EF" accentColor="#6FE3FF" />

      {/* ── 2. Foundations Section with Circuit Pulse Stream ───────────────── */}
      <section id="foundations" className="c8-section">
        <CantorCircuitStream />

        <div className="c8-container">
          <div className="c8-header-block">
            <div className="c8-tag">
              <span className="c8-cube-tag" />
              <span>FOUNDATIONS</span>
            </div>
            <h2 className="c8-section-h2">Built for Rigorous Academic Workflows</h2>
            <p className="c8-section-desc">
              Comtus delivers a unified cognitive infrastructure layer for learners and scholars, combining active inquiry, structured knowledge synthesis, and automated recall within a single configurable system.
            </p>
          </div>

          {/* ── 3. Product Bento Grid Matrix ─────────────────────────────────── */}
          <div ref={bentoGridRef} className="c8-bento-grid">
            {PRODUCTS.map((prod) => {
              const Icon = prod.icon;
              return (
                <article
                  key={prod.id}
                  onMouseMove={handleCardMouseMove}
                  onMouseEnter={handleCardMouseEnter}
                  onMouseLeave={handleCardMouseLeave}
                  className={`c8-bento-card ${prod.span === 2 ? "span-2" : ""}`}
                >
                  <div>
                    <div className="c8-card-top-bar">
                      <span className="c8-tag">
                        <span className="c8-cube-tag" />
                        <span>{prod.tag}</span>
                      </span>
                      <Icon className="w-5 h-5 text-[#044AB3]" />
                    </div>

                    <h3 className="c8-card-h3">{prod.title}</h3>
                    <p className="c8-card-p">{prod.desc}</p>
                  </div>

                  <div className="c8-card-footer">
                    <span className="c8-card-status">
                      <Sparkles className="w-3.5 h-3.5 text-[#044AB3]" />
                      <span>{prod.status}</span>
                    </span>

                    <Link to="/studio" className="c8-arrow-wrap" aria-label={`Open ${prod.title}`}>
                      <ArrowUpRight className="c8-arrow-icon" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ── 4. Pre-Calibrated Curricula & Board Blueprints ─────────────────── */}
          <div className="mt-16">
            <div className="c8-header-block">
              <div className="c8-tag">
                <span className="c8-cube-tag" />
                <span>CALIBRATED CURRICULA</span>
              </div>
              <h2 className="c8-section-h2">Pre-Configured Examination Frameworks</h2>
            </div>

            <div ref={curriculaGridRef} className="c8-curricula-grid">
              {CURRICULA.map((curr) => (
                <div
                  key={curr.name}
                  className="c8-curriculum-item"
                  onMouseEnter={handleCardMouseEnter}
                >
                  <div className="text-[11.5px] font-mono text-[#044AB3] font-bold uppercase tracking-wider mb-1">
                    {curr.tag}
                  </div>
                  <div className="text-sm font-semibold text-[#0B132B] mb-2">{curr.name}</div>
                  <div className="text-xs text-[#334155] font-mono font-medium">{curr.rate}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Dynamic Pixel Matrix Transition 2 ──────────────────────────────── */}
      <CantorPixelTransition fromColor="#F5F3EF" toColor="#044AB3" accentColor="#6FE3FF" />
    </div>
  );
}
