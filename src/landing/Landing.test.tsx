import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ComtusShowcase, { COMTUS_CARDS_LEFT, COMTUS_CARDS_RIGHT } from "./ComtusShowcase";
import FAQSection from "./FAQSection";
import OnboardingModal from "./OnboardingModal";
import { AboutPage, PrivacyPage, TermsPage, ResponsibleAIPage, ContactPage, StudyCompanionPage } from "./StaticPages";

afterEach(() => {
  cleanup();
});

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
    quickTo: vi.fn(() => vi.fn()),
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

describe("ComtusShowcase Component", () => {
  it("renders hero headline, brand subtitle, subheader pill, and floating scholar stickers", () => {
    render(
      <BrowserRouter>
        <ComtusShowcase />
      </BrowserRouter>
    );

    expect(screen.getByText("YOUR AI STUDY COMPANION")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getByText("COMTUS")).toBeDefined();
    expect(screen.getByText("Rough thought, polished.")).toBeDefined();

    // Floating Stickers
    expect(screen.getByTitle("16-Bit Banker's Lamp")).toBeDefined();
    expect(screen.getByTitle("Antique Study Tome")).toBeDefined();
    expect(screen.getByTitle("Steaming Study Tea")).toBeDefined();
    expect(screen.getByTitle("Feather Quill")).toBeDefined();
    expect(screen.getByTitle("Wax Seal of Mastery")).toBeDefined();
    expect(screen.getByTitle("Spark of Diligence")).toBeDefined();
    cleanup();
  });

  it("renders the interactive 16-bit study console and toggles modes with D-Pad and action buttons", () => {
    render(
      <BrowserRouter>
        <ComtusShowcase />
      </BrowserRouter>
    );

    expect(screen.getByRole("region", { name: "16-Bit Study Console" })).toBeDefined();
    expect(screen.getByText(/COMTUS-16 · SOCRATIC/i)).toBeDefined();

    // Answer choice in Socratic mode
    const choiceA = screen.getByText(/A\) Magnesium block expulsion via depolarization/i);
    expect(choiceA).toBeDefined();
    fireEvent.click(choiceA);
    expect(screen.getByText(/✓ Correct!/i)).toBeDefined();

    // D-Pad Down to Flashcards mode
    const dpadDown = screen.getByRole("button", { name: "D-Pad Down" });
    fireEvent.click(dpadDown);
    expect(screen.getByText(/COMTUS-16 · FLASHCARDS/i)).toBeDefined();
    expect(screen.getByText("Hebbian Plasticity")).toBeDefined();

    // Action button A to flip card
    const btnA = screen.getByRole("button", { name: "A" });
    fireEvent.click(btnA);
    expect(screen.getByText(/Neurons that fire together wire together/i)).toBeDefined();

    // D-Pad Down to Proof mode
    fireEvent.click(dpadDown);
    expect(screen.getByText(/COMTUS-16 · PROOF/i)).toBeDefined();
    expect(screen.getByText(/PROOF: Euler's Identity/i)).toBeDefined();

    // D-Pad Down to BYOK mode
    fireEvent.click(dpadDown);
    expect(screen.getByText(/COMTUS-16 · BYOK/i)).toBeDefined();
    expect(screen.getByText(/ACTIVE INFERENCE PROVIDER/i)).toBeDefined();

    // Action button A to switch model
    fireEvent.click(btnA);
    expect(screen.getAllByText("DeepSeek R1").length).toBeGreaterThan(0);
    cleanup();
  });

  it("renders all 14 study blueprint cards in dual columns with metrics and CTA link", () => {
    render(
      <BrowserRouter>
        <ComtusShowcase />
      </BrowserRouter>
    );

    // Left Column Cards (7)
    for (const card of COMTUS_CARDS_LEFT) {
      expect(screen.getByText(card.title)).toBeDefined();
    }

    // Right Column Cards (7)
    for (const card of COMTUS_CARDS_RIGHT) {
      expect(screen.getByText(card.title)).toBeDefined();
    }

    // Bottom Sticky CTA
    const ctaLink = screen.getByRole("link", { name: /OPEN THE STUDIO/i });
    expect(ctaLink.getAttribute("href")).toBe("/studio");
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

    expect(screen.getByText(/What discipline are you studying\?/i)).toBeDefined();
    expect(screen.getByText("Medicine & Nursing")).toBeDefined();

    // Proceed to Step 2
    fireEvent.click(screen.getByText("Continue"));
    expect(screen.getByText(/What is your primary study objective\?/i)).toBeDefined();

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
  }, 20000);
});

describe("Pixel landing overlay", () => {
  it("sets and clears html[data-landing-pixel]", async () => {
    const { applyLandingPixel } = await import("./pixelMotion");
    applyLandingPixel(true);
    expect(document.documentElement.dataset.landingPixel).toBe("on");
    applyLandingPixel(false);
    expect(document.documentElement.dataset.landingPixel).toBeUndefined();
    expect(document.documentElement.dataset.lamp).toBeUndefined();
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
