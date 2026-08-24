import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Hero from "./Hero";
import LearningLoop from "./LearningLoop";
import ProductDemo from "./ProductDemo";
import WhyComtus from "./WhyComtus";
import AcademicIntegrity from "./AcademicIntegrity";
import TrustPrivacy from "./TrustPrivacy";
import FAQSection from "./FAQSection";
import OnboardingModal from "./OnboardingModal";
import { AboutPage, PrivacyPage, TermsPage, ResponsibleAIPage, ContactPage, StudyCompanionPage } from "./StaticPages";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock GSAP and ScrollTrigger in JSDOM
vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    context: vi.fn((fn: () => void) => {
      try { fn(); } catch {}
      return { revert: vi.fn(), add: vi.fn() };
    }),
    fromTo: vi.fn(),
    set: vi.fn(),
    to: vi.fn(),
    timeline: vi.fn(() => ({
      fromTo: vi.fn().mockReturnThis(),
    })),
    utils: {
      toArray: vi.fn(() => []),
    },
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
    },
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {
    update: vi.fn(),
  },
}));

describe("Hero Component", () => {
  it("renders AI Study Companion eyebrow, main headline, supporting brand line, and CTAs", () => {
    const onStartMock = vi.fn();
    render(
      <BrowserRouter>
        <Hero ready={true} onStartStudying={onStartMock} />
      </BrowserRouter>
    );

    expect(screen.getByText("AI STUDY COMPANION")).toBeDefined();
    expect(screen.getByText("Study smarter with Comtus.")).toBeDefined();
    expect(screen.getByText("Rough thought,")).toBeDefined();
    expect(screen.getByText("polished.")).toBeDefined();
    expect(screen.getAllByText("Start Studying").length).toBeGreaterThan(0);
    expect(screen.getAllByText("See How Comtus Works").length).toBeGreaterThan(0);
    cleanup();
  });
});

describe("LearningLoop Component", () => {
  it("renders the four core learning stages: Understand, Organize, Practice, Master", () => {
    render(<LearningLoop />);

    expect(screen.getByText(/01 — Understand/i)).toBeDefined();
    expect(screen.getByText(/02 — Organize/i)).toBeDefined();
    expect(screen.getByText(/03 — Practice/i)).toBeDefined();
    expect(screen.getByText(/04 — Master/i)).toBeDefined();
    cleanup();
  });
});

describe("ProductDemo Component", () => {
  it("renders step tabs and allows switching between demo stages", () => {
    render(<ProductDemo />);

    expect(screen.getByText("1. Student Note")).toBeDefined();
    expect(screen.getByText("2. Explanation & Analogy")).toBeDefined();
    expect(screen.getByText("3. Study Guide")).toBeDefined();
    expect(screen.getByText("4. Practice Quiz")).toBeDefined();

    // Click on Practice Quiz
    const quizBtn = screen.getByText("4. Practice Quiz");
    fireEvent.click(quizBtn);

    expect(screen.getByText(/Why does cellular ATP production drastically decrease/i)).toBeDefined();
    cleanup();
  });
});

describe("WhyComtus Component", () => {
  it("renders comparison between generic chatbots and Comtus", () => {
    render(<WhyComtus />);

    expect(screen.getByText(/Why not just use a/i)).toBeDefined();
    expect(screen.getByText("Generic AI Chatbot")).toBeDefined();
    expect(screen.getByText("Comtus Study Companion")).toBeDefined();
    expect(screen.getByText("Study Context")).toBeDefined();
    cleanup();
  });
});

describe("AcademicIntegrity Component", () => {
  it("renders the academic integrity pledge and pedagogical pillars", () => {
    render(<AcademicIntegrity />);

    expect(screen.getByText(/Built to support learning/i)).toBeDefined();
    expect(screen.getByText("Hints First, Answers Second")).toBeDefined();
    expect(screen.getByText("Source-Grounded Transparency")).toBeDefined();
    cleanup();
  });
});

describe("TrustPrivacy Component", () => {
  it("renders local-first and on-device privacy assurances", () => {
    render(<TrustPrivacy />);

    expect(screen.getByText(/Your study materials/i)).toBeDefined();
    expect(screen.getByText("Local-First Storage (IndexedDB)")).toBeDefined();
    expect(screen.getByText("On-Device BYOK Keys")).toBeDefined();
    cleanup();
  });
});

describe("FAQSection Component", () => {
  it("renders core questions and expands answers upon click", () => {
    render(<FAQSection />);

    const firstQuestion = screen.getByText("What is Comtus?");
    expect(firstQuestion).toBeDefined();

    const secondQuestion = screen.getByText("Is Comtus just another chatbot?");
    fireEvent.click(secondQuestion);

    expect(screen.getByText(/Unlike chatbots with temporary conversational threads/i)).toBeDefined();
    cleanup();
  });
});

describe("OnboardingModal Component", () => {
  it("allows selecting a subject and stepping through the 3-step kickstart sequence", () => {
    const onCloseMock = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onCloseMock} />
      </BrowserRouter>
    );

    expect(screen.getByText(/What are you studying right now\?/i)).toBeDefined();
    expect(screen.getByText("Medicine & Nursing")).toBeDefined();

    // Proceed to Step 2
    fireEvent.click(screen.getByText("Continue"));
    expect(screen.getByText(/What do you want help with first\?/i)).toBeDefined();

    // Proceed to Step 3
    fireEvent.click(screen.getByText("Next Step"));
    expect(screen.getByText(/What topic or material are we tackling\?/i)).toBeDefined();
    expect(screen.getByText("Launch Study Workspace")).toBeDefined();
    cleanup();
  });
});

describe("Static Public Pages", () => {
  it("renders About, Privacy, Terms, Responsible AI, Contact, and Study Companion pages", () => {
    render(
      <BrowserRouter>
        <AboutPage />
      </BrowserRouter>
    );
    expect(screen.getByRole("heading", { name: "About Comtus" })).toBeDefined();
    expect(screen.getByText(/Name & Heritage/i)).toBeDefined();
    cleanup();

    render(
      <BrowserRouter>
        <PrivacyPage />
      </BrowserRouter>
    );
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeDefined();
    cleanup();

    render(
      <BrowserRouter>
        <TermsPage />
      </BrowserRouter>
    );
    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeDefined();
    cleanup();

    render(
      <BrowserRouter>
        <ResponsibleAIPage />
      </BrowserRouter>
    );
    expect(screen.getByRole("heading", { name: "Responsible AI & Academic Integrity" })).toBeDefined();
    cleanup();

    render(
      <BrowserRouter>
        <ContactPage />
      </BrowserRouter>
    );
    expect(screen.getByRole("heading", { name: "Contact & Support" })).toBeDefined();
    cleanup();

    render(
      <BrowserRouter>
        <StudyCompanionPage />
      </BrowserRouter>
    );
    expect(screen.getByRole("heading", { name: "AI Study Companion for Students" })).toBeDefined();
    cleanup();
  });
});

describe("PixelTorch & SectionTorch Rekindling", () => {
  it("renders PixelTorch in handheld and sconce variants", async () => {
    const { default: PixelTorch } = await import("../components/PixelTorch");
    render(<PixelTorch isLit={true} variant="handheld" size={32} />);
    cleanup();

    render(<PixelTorch isLit={false} variant="sconce" size={32} />);
    cleanup();
  });

  it("handles SectionTorch mounting, ignition click, and state update", async () => {
    const { default: SectionTorch } = await import("./SectionTorch");
    const { torchManager } = await import("../lib/torchState");

    render(<SectionTorch sectionId="test-section" />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toContain("Light section test-section torch");

    // Click to ignite
    fireEvent.click(btn);
    expect(torchManager.isLit("test-section")).toBe(true);
    expect(btn.getAttribute("aria-label")).toContain("Section test-section torch is lit");
    cleanup();
  });
});
